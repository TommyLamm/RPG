from __future__ import annotations

import argparse
import gc
import json
import math
import os
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "assets" / "audio"
MANIFEST_PATH = AUDIO_DIR / "audio-manifest.json"
SAMPLE_RATE = 44_100
PCM_LIMIT = 32_767
MASTER_PEAK = 10 ** (-1 / 20)
BGM_DURATION = 48.0
BGM_KEYS = ("village", "forest", "cave", "tomb", "combat")
SFX_KEYS = (
    "playerAttack",
    "playerHit",
    "criticalHit",
    "monsterAttack",
    "victory",
    "defeat",
    "flee",
    "levelUp",
    "potion",
    "purchase",
    "gold",
    "discovery",
)


def sample_count(duration: float) -> int:
    return int(round(duration * SAMPLE_RATE))


def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def normalize(signal: np.ndarray, peak: float = MASTER_PEAK) -> np.ndarray:
    maximum = float(np.max(np.abs(signal)))
    if maximum == 0:
        raise ValueError("cannot normalize silent signal")
    return np.asarray(signal, dtype=np.float64) * (peak / maximum)


def write_wav(path: Path, signal: np.ndarray, channels: int) -> None:
    data = np.asarray(signal, dtype=np.float64)
    if channels == 1:
        data = data.reshape(-1, 1)
    if data.ndim != 2 or data.shape[1] != channels:
        raise ValueError(f"invalid channel shape for {path.name}: {data.shape}")
    pcm = np.round(np.clip(data, -1, 1) * PCM_LIMIT).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
        with wave.open(str(temporary_path), "wb") as output:
            output.setnchannels(channels)
            output.setsampwidth(2)
            output.setframerate(SAMPLE_RATE)
            output.writeframes(pcm.tobytes())
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def periodic_sine(duration: float, frequency: float, phase: float = 0.0) -> np.ndarray:
    length = sample_count(duration)
    cycles = max(1, int(round(frequency * duration)))
    angles = (2.0 * math.pi * cycles * np.arange(length, dtype=np.float64) / length) + phase
    return np.sin(angles)


def triangle(duration: float, frequency: float, phase: float = 0.0) -> np.ndarray:
    sine = periodic_sine(duration, frequency, phase)
    return (2.0 / math.pi) * np.arcsin(sine)


def _moving_average(signal: np.ndarray, kernel: int, mode: str = "reflect") -> np.ndarray:
    data = np.asarray(signal, dtype=np.float64)
    kernel = max(1, min(int(kernel), len(data)))
    if kernel == 1:
        return data.copy()
    left = kernel // 2
    right = kernel - 1 - left
    padded = np.pad(data, (left, right), mode=mode)
    cumulative = np.concatenate(([0.0], np.cumsum(padded, dtype=np.float64)))
    return (cumulative[kernel:] - cumulative[:-kernel]) / kernel


def _circular_smooth(signal: np.ndarray, kernel_ms: float) -> np.ndarray:
    data = np.asarray(signal, dtype=np.float64)
    kernel = max(1, int(round(kernel_ms * SAMPLE_RATE / 1000.0)))
    kernel = min(kernel, len(data))
    if kernel == 1:
        return data.copy()
    left = kernel // 2
    right = kernel - 1 - left
    padded = np.concatenate((data[-left:] if left else data[:0], data, data[:right]))
    cumulative = np.concatenate(([0.0], np.cumsum(padded, dtype=np.float64)))
    return (cumulative[kernel:] - cumulative[:-kernel]) / kernel


def smooth_noise(duration: float, seed: int, kernel_ms: float) -> np.ndarray:
    raw = rng(seed).standard_normal(sample_count(duration))
    smoothed = _moving_average(raw, max(1, int(round(kernel_ms * SAMPLE_RATE / 1000.0))))
    deviation = float(np.std(smoothed))
    return smoothed / deviation if deviation else smoothed


def periodic_noise(duration: float, seed: int, tile_seconds: float = 8.0) -> np.ndarray:
    length = sample_count(duration)
    repetitions = max(1, int(round(duration / tile_seconds)))
    tile_length = max(1, length // repetitions)
    tile = rng(seed).standard_normal(tile_length)
    tile = _circular_smooth(tile, 8.0)
    deviation = float(np.std(tile))
    if deviation:
        tile /= deviation
    tile = circular_seam(tile, 100.0)
    return np.resize(tile, length)


def exp_envelope(length: int, attack: float, decay: float) -> np.ndarray:
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    if attack <= 0:
        attack_curve = np.ones(length, dtype=np.float64)
    else:
        attack_curve = np.minimum(1.0, time / attack)
    if decay <= 0:
        decay_curve = np.ones(length, dtype=np.float64)
    else:
        decay_curve = np.exp(-np.maximum(0.0, time - max(0.0, attack)) / decay)
    return attack_curve * decay_curve


def event_tone(duration: float, start: float, frequency: float, decay: float, gain: float) -> np.ndarray:
    output = np.zeros(sample_count(duration), dtype=np.float64)
    start_sample = max(0, min(len(output), sample_count(start)))
    length = len(output) - start_sample
    if length == 0:
        return output
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    tone = np.sin(2.0 * math.pi * frequency * time) * exp_envelope(length, 0.004, decay)
    output[start_sample:] = gain * tone
    return output


def stereo_pan(mono: np.ndarray, pan: float) -> np.ndarray:
    data = np.asarray(mono, dtype=np.float64).reshape(-1)
    angle = (max(-1.0, min(1.0, pan)) + 1.0) * math.pi / 4.0
    return np.column_stack((data * math.cos(angle), data * math.sin(angle)))


def _moving_pan(mono: np.ndarray, pan_lfo: np.ndarray) -> np.ndarray:
    data = np.asarray(mono, dtype=np.float64).reshape(-1)
    pan = np.clip(np.asarray(pan_lfo, dtype=np.float64).reshape(-1), -1.0, 1.0)
    if len(data) != len(pan):
        raise ValueError("moving pan input lengths differ")
    angle = (pan + 1.0) * math.pi / 4.0
    return np.column_stack((data * np.cos(angle), data * np.sin(angle)))


def circular_seam(signal: np.ndarray, milliseconds: float = 120.0) -> np.ndarray:
    data = np.asarray(signal, dtype=np.float64)
    was_mono = data.ndim == 1
    shaped = data.reshape(-1, 1).copy() if was_mono else data.copy()
    if shaped.ndim != 2:
        raise ValueError(f"invalid signal shape for circular seam: {data.shape}")
    window = min(sample_count(milliseconds / 1000.0), len(shaped) // 2)
    if window < 2:
        return shaped[:, 0] if was_mono else shaped
    boundary = ((shaped[0] + shaped[-1]) * 0.5).reshape(1, -1)
    fade = np.sin(np.linspace(0.0, math.pi / 2.0, window, dtype=np.float64)) ** 2
    fade = fade.reshape(-1, 1)
    shaped[:window] = boundary * (1.0 - fade) + shaped[:window] * fade
    shaped[-window:] = shaped[-window:] * (1.0 - fade) + boundary * fade
    return shaped[:, 0] if was_mono else shaped


def impact(duration: float, seed: int, body_hz: float, noise_gain: float) -> np.ndarray:
    length = sample_count(duration)
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    body = np.sin(2.0 * math.pi * body_hz * time) * np.exp(-time / max(0.04, duration * 0.28))
    raw = rng(seed).standard_normal(length)
    noise = raw - _moving_average(raw, max(3, int(0.003 * SAMPLE_RATE)))
    noise *= exp_envelope(length, 0.001, max(0.025, duration * 0.12))
    click = np.sin(2.0 * math.pi * body_hz * 3.7 * time) * np.exp(-time / 0.025)
    return 0.72 * body + noise_gain * noise + 0.18 * click


def sweep(duration: float, start_hz: float, end_hz: float) -> np.ndarray:
    length = sample_count(duration)
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    rate = (end_hz - start_hz) / max(duration, 1.0 / SAMPLE_RATE)
    phase = 2.0 * math.pi * (start_hz * time + 0.5 * rate * time * time)
    return np.sin(phase)


def resonant_chime(duration: float, frequencies: list[float], decay: float) -> np.ndarray:
    length = sample_count(duration)
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    output = np.zeros(length, dtype=np.float64)
    for index, frequency in enumerate(frequencies):
        partial_decay = max(0.03, decay / (1.0 + index * 0.22))
        output += (
            np.sin(2.0 * math.pi * frequency * time + index * 0.31)
            * np.exp(-time / partial_decay)
            / (1.0 + index * 0.42)
        )
    return output / max(1, len(frequencies))


def delayed_mix(signal: np.ndarray, delays: list[tuple[float, float]]) -> np.ndarray:
    data = np.asarray(signal, dtype=np.float64).reshape(-1)
    output = data.copy()
    for delay_seconds, gain in delays:
        delay_samples = sample_count(delay_seconds)
        if 0 < delay_samples < len(data):
            output[delay_samples:] += data[:-delay_samples] * gain
    return output


def _place(destination: np.ndarray, event: np.ndarray, start: float, gain: float = 1.0) -> None:
    start_sample = sample_count(start)
    if start_sample >= len(destination):
        return
    event_data = np.asarray(event, dtype=np.float64).reshape(-1)
    end_sample = min(len(destination), start_sample + len(event_data))
    destination[start_sample:end_sample] += gain * event_data[: end_sample - start_sample]


def _edge_fade(signal: np.ndarray, attack_ms: float = 5.0, release_ms: float = 20.0) -> np.ndarray:
    data = np.asarray(signal, dtype=np.float64).copy()
    attack = min(len(data), max(1, sample_count(attack_ms / 1000.0)))
    release = min(len(data), max(1, sample_count(release_ms / 1000.0)))
    data[:attack] *= np.linspace(0.0, 1.0, attack, dtype=np.float64)
    data[-release:] *= np.linspace(1.0, 0.0, release, dtype=np.float64)
    return data


def _master_sfx(signal: np.ndarray) -> np.ndarray:
    return normalize(_edge_fade(signal))


def _slow_mod(frequency: float, depth: float, phase: float = 0.0) -> np.ndarray:
    return 1.0 + depth * periodic_sine(BGM_DURATION, frequency, phase)


def render_village() -> np.ndarray:
    seed = 1101
    drone = (
        0.17 * periodic_sine(BGM_DURATION, 42.0) * _slow_mod(0.041, 0.22)
        + 0.11 * triangle(BGM_DURATION, 55.0, 0.7) * _slow_mod(0.063, 0.18, 1.2)
    )
    wind = periodic_noise(BGM_DURATION, seed, 8.0)
    wind = _circular_smooth(wind, 34.0) * 0.045 * _slow_mod(0.052, 0.35, 0.5)
    lanterns = np.zeros(sample_count(BGM_DURATION), dtype=np.float64)
    for index, start in enumerate((7.4, 18.6, 31.1, 42.3)):
        chime = delayed_mix(resonant_chime(1.4, [659.0, 988.5], 0.55), [(0.17, 0.25)])
        _place(lanterns, chime, start, 0.09 if index % 2 == 0 else 0.07)
    creaks = np.zeros_like(lanterns)
    for index, start in enumerate((12.2, 26.8, 38.7)):
        _place(creaks, impact(0.75, seed + 20 + index, 73.0, 0.08), start, 0.055)
    return (
        stereo_pan(drone, -0.28)
        + stereo_pan(wind, 0.42)
        + stereo_pan(lanterns, 0.72)
        + stereo_pan(creaks, -0.68)
    )


def render_forest() -> np.ndarray:
    seed = 2202
    drone = (
        0.16 * periodic_sine(BGM_DURATION, 38.0, 0.4) * _slow_mod(0.032, 0.25)
        + 0.1 * triangle(BGM_DURATION, 57.0, 1.3) * _slow_mod(0.071, 0.2, 0.7)
    )
    leaves = periodic_noise(BGM_DURATION, seed, 6.0)
    leaves = (leaves - _circular_smooth(leaves, 55.0)) * 0.028
    movement = 0.72 * periodic_sine(BGM_DURATION, 0.046, 0.8)
    chimes_left = np.zeros(sample_count(BGM_DURATION), dtype=np.float64)
    chimes_right = np.zeros_like(chimes_left)
    for index, (start, frequency) in enumerate(((5.8, 392.0), (14.9, 523.0), (24.4, 392.0), (35.7, 523.0), (44.1, 392.0))):
        target = chimes_left if index % 2 == 0 else chimes_right
        _place(target, resonant_chime(1.25, [frequency, frequency * 1.51], 0.48), start, 0.075)
    root_rub = periodic_noise(BGM_DURATION, seed + 1, 8.0)
    root_rub = _circular_smooth(root_rub, 90.0) * 0.032 * _slow_mod(0.083, 0.3)
    return (
        stereo_pan(drone, -0.36)
        + _moving_pan(leaves, movement)
        + stereo_pan(chimes_left, -0.76)
        + stereo_pan(chimes_right, 0.76)
        + stereo_pan(root_rub, 0.25)
    )


def render_cave() -> np.ndarray:
    seed = 3303
    drone = (
        0.15 * periodic_sine(BGM_DURATION, 46.0, 0.2) * _slow_mod(0.029, 0.2)
        + 0.1 * periodic_sine(BGM_DURATION, 69.0, 1.1) * _slow_mod(0.058, 0.16, 1.0)
    )
    tunnel = periodic_noise(BGM_DURATION, seed, 8.0)
    tunnel = _circular_smooth(tunnel, 110.0) * 0.052 * _slow_mod(0.038, 0.28, 0.3)
    high_bed = periodic_noise(BGM_DURATION, seed + 1, 6.0)
    high_bed = (high_bed - _circular_smooth(high_bed, 30.0)) * 0.014
    drops_left = np.zeros(sample_count(BGM_DURATION), dtype=np.float64)
    drops_right = np.zeros_like(drops_left)
    drop_times = (4.6, 9.8, 16.3, 22.7, 29.5, 36.4, 43.2)
    for index, start in enumerate(drop_times):
        frequency = 784.0 if index % 2 == 0 else 988.0
        drop = delayed_mix(resonant_chime(1.55, [frequency, frequency * 1.49], 0.27), [(0.19, 0.32), (0.41, 0.18)])
        _place(drops_left if index % 2 == 0 else drops_right, drop, start, 0.085)
    return (
        stereo_pan(drone, -0.2)
        + stereo_pan(tunnel, 0.48)
        + stereo_pan(high_bed, -0.62)
        + stereo_pan(drops_left, -0.82)
        + stereo_pan(drops_right, 0.82)
    )


def render_tomb() -> np.ndarray:
    seed = 4404
    drone = (
        0.18 * periodic_sine(BGM_DURATION, 32.0, 0.3) * _slow_mod(0.024, 0.18)
        + 0.12 * triangle(BGM_DURATION, 48.0, 1.7) * _slow_mod(0.049, 0.2, 0.6)
    )
    chamber = periodic_noise(BGM_DURATION, seed, 8.0)
    chamber = _circular_smooth(chamber, 145.0) * 0.052
    pulse = (0.5 + 0.5 * periodic_sine(BGM_DURATION, 0.25, -math.pi / 2.0)) ** 2
    ritual = periodic_sine(BGM_DURATION, 64.0) * pulse * 0.045
    bells_left = np.zeros(sample_count(BGM_DURATION), dtype=np.float64)
    bells_right = np.zeros_like(bells_left)
    for index, start in enumerate((6.2, 17.8, 30.6, 42.0)):
        bell = delayed_mix(resonant_chime(2.4, [110.0, 164.0, 247.0], 0.95), [(0.29, 0.24)])
        _place(bells_left if index % 2 == 0 else bells_right, bell, start, 0.13)
    stone = periodic_noise(BGM_DURATION, seed + 1, 12.0)
    stone = _circular_smooth(stone, 220.0) * 0.038 * _slow_mod(0.067, 0.25)
    return (
        stereo_pan(drone, -0.34)
        + stereo_pan(chamber, 0.38)
        + stereo_pan(ritual, 0.08)
        + stereo_pan(bells_left, -0.72)
        + stereo_pan(bells_right, 0.72)
        + stereo_pan(stone, -0.1)
    )


def render_combat() -> np.ndarray:
    seed = 5505
    tension = 0.62 + 0.38 * periodic_sine(BGM_DURATION, 2.0, -math.pi / 2.0)
    drone = (
        0.15 * periodic_sine(BGM_DURATION, 45.0, 0.2)
        + 0.1 * triangle(BGM_DURATION, 67.0, 1.0)
    ) * (0.76 + 0.24 * tension)
    drums = np.zeros(sample_count(BGM_DURATION), dtype=np.float64)
    beat = 60.0 / 96.0
    for index, start in enumerate(np.arange(1.25, 47.0, beat)):
        drum = impact(0.36, seed + 100 + index, 58.0 if index % 4 else 46.0, 0.035)
        _place(drums, drum, float(start), 0.14 if index % 4 else 0.19)
    scrape = periodic_noise(BGM_DURATION, seed, 6.0)
    scrape = (scrape - _circular_smooth(scrape, 75.0)) * 0.026 * tension
    danger = periodic_sine(BGM_DURATION, 90.0, 0.8) * tension * 0.035
    metal = np.zeros_like(drums)
    for index, start in enumerate((5.1, 13.4, 21.7, 30.1, 38.5, 45.2)):
        strike = delayed_mix(resonant_chime(0.9, [181.0, 307.0, 463.0], 0.24), [(0.08, 0.25)])
        _place(metal, strike, start, 0.065 if index % 2 else 0.085)
    return (
        stereo_pan(drone, -0.3)
        + stereo_pan(drums, 0.0)
        + _moving_pan(scrape, 0.65 * periodic_sine(BGM_DURATION, 0.125))
        + stereo_pan(danger, 0.45)
        + stereo_pan(metal, -0.58)
    )


def render_bgm(key: str) -> np.ndarray:
    renderers = {
        "village": render_village,
        "forest": render_forest,
        "cave": render_cave,
        "tomb": render_tomb,
        "combat": render_combat,
    }
    if key not in renderers:
        raise KeyError(f"unknown BGM key: {key}")
    return normalize(circular_seam(renderers[key]()))


def render_sfx_player_attack() -> np.ndarray:
    duration = 0.55
    length = sample_count(duration)
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    noise = smooth_noise(duration, 6101, 0.7)
    whoosh = noise * sweep(duration, 1500.0, 170.0) * np.sin(math.pi * np.clip(time / 0.38, 0.0, 1.0))
    output = 0.26 * whoosh
    _place(output, impact(0.23, 6102, 118.0, 0.2), 0.29, 0.75)
    return _master_sfx(output)


def render_sfx_player_hit() -> np.ndarray:
    duration = 0.65
    output = impact(duration, 6201, 82.0, 0.2)
    output += 0.34 * sweep(duration, 96.0, 51.0) * exp_envelope(len(output), 0.002, 0.24)
    return _master_sfx(output)


def render_sfx_critical_hit() -> np.ndarray:
    duration = 0.9
    output = 0.9 * impact(duration, 6301, 61.0, 0.27)
    metallic = delayed_mix(resonant_chime(duration, [207.0, 331.0, 512.0], 0.31), [(0.07, 0.28)])
    output += 0.38 * metallic
    output += 0.42 * sweep(duration, 74.0, 31.0) * exp_envelope(len(output), 0.003, 0.38)
    return _master_sfx(output)


def render_sfx_monster_attack() -> np.ndarray:
    duration = 0.75
    length = sample_count(duration)
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    rough = smooth_noise(duration, 6401, 1.1) * sweep(duration, 110.0, 720.0)
    rough *= np.sin(math.pi * np.clip(time / 0.52, 0.0, 1.0))
    output = 0.3 * rough
    _place(output, impact(0.28, 6402, 91.0, 0.18), 0.43, 0.72)
    return _master_sfx(output)


def render_sfx_victory() -> np.ndarray:
    duration = 2.2
    output = np.zeros(sample_count(duration), dtype=np.float64)
    _place(output, resonant_chime(1.55, [220.0, 261.6, 329.6], 0.65), 0.05, 0.48)
    _place(output, resonant_chime(1.45, [220.0, 329.6, 440.0], 0.72), 0.62, 0.56)
    pulse = sweep(duration, 72.0, 48.0) * exp_envelope(len(output), 0.01, 0.7)
    output += 0.24 * pulse
    return _master_sfx(output)


def render_sfx_defeat() -> np.ndarray:
    duration = 2.4
    length = sample_count(duration)
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    collapse = sweep(duration, 132.0, 34.0) * np.exp(-time / 0.82)
    rumble = smooth_noise(duration, 6601, 42.0) * np.exp(-time / 0.9)
    bell = resonant_chime(duration, [92.0, 139.0, 211.0], 0.78)
    output = 0.42 * collapse + 0.16 * rumble + 0.38 * bell
    return _master_sfx(output)


def render_sfx_flee() -> np.ndarray:
    duration = 1.0
    output = np.zeros(sample_count(duration), dtype=np.float64)
    for index, start in enumerate((0.04, 0.21, 0.39, 0.58)):
        step = smooth_noise(0.22, 6701 + index, 1.3) * exp_envelope(sample_count(0.22), 0.004, 0.07)
        _place(output, step, start, 0.42 / (1.0 + index * 0.28))
    breath = smooth_noise(duration, 6710, 18.0) * exp_envelope(len(output), 0.02, 0.38)
    output += 0.11 * breath
    return _master_sfx(output)


def render_sfx_level_up() -> np.ndarray:
    duration = 1.8
    output = np.zeros(sample_count(duration), dtype=np.float64)
    for start, frequency, gain in ((0.08, 392.0, 0.42), (0.46, 523.0, 0.5), (0.84, 659.0, 0.58)):
        _place(output, resonant_chime(0.96, [frequency, frequency * 1.5], 0.42), start, gain)
    output += 0.12 * sweep(duration, 98.0, 196.0) * exp_envelope(len(output), 0.18, 0.7)
    return _master_sfx(output)


def render_sfx_potion() -> np.ndarray:
    duration = 1.35
    output = np.zeros(sample_count(duration), dtype=np.float64)
    _place(output, impact(0.16, 6901, 174.0, 0.12), 0.04, 0.52)
    _place(output, resonant_chime(0.9, [711.0, 1066.0], 0.34), 0.16, 0.34)
    liquid = smooth_noise(0.72, 6902, 7.0) * exp_envelope(sample_count(0.72), 0.09, 0.3)
    liquid *= 0.6 + 0.4 * sweep(0.72, 9.0, 16.0)
    _place(output, liquid, 0.31, 0.17)
    _place(output, resonant_chime(0.72, [196.0, 294.0], 0.45), 0.56, 0.26)
    return _master_sfx(output)


def render_sfx_purchase() -> np.ndarray:
    duration = 0.8
    output = np.zeros(sample_count(duration), dtype=np.float64)
    coin = resonant_chime(0.42, [1180.0, 1770.0, 2360.0], 0.13)
    _place(output, coin, 0.06, 0.52)
    _place(output, coin, 0.23, 0.4)
    _place(output, impact(0.31, 7001, 132.0, 0.09), 0.42, 0.48)
    return _master_sfx(output)


def render_sfx_gold() -> np.ndarray:
    duration = 0.7
    output = np.zeros(sample_count(duration), dtype=np.float64)
    for index, (start, frequency) in enumerate(((0.03, 1260.0), (0.15, 1510.0), (0.29, 1810.0))):
        coin = resonant_chime(0.36, [frequency, frequency * 1.49], 0.12)
        _place(output, coin, start, 0.48 - index * 0.06)
    return _master_sfx(output)


def render_sfx_discovery() -> np.ndarray:
    duration = 1.6
    length = sample_count(duration)
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    swell_envelope = np.sin(0.5 * math.pi * np.clip(time / 1.05, 0.0, 1.0)) ** 2
    swell_envelope *= np.exp(-np.maximum(0.0, time - 1.05) / 0.3)
    swell = smooth_noise(duration, 7201, 24.0) * swell_envelope
    output = 0.16 * swell + 0.17 * sweep(duration, 146.0, 438.0) * swell_envelope
    _place(output, resonant_chime(0.82, [523.0, 784.0, 1047.0], 0.38), 0.76, 0.5)
    return _master_sfx(output)


SFX_RENDERERS = {
    "playerAttack": render_sfx_player_attack,
    "playerHit": render_sfx_player_hit,
    "criticalHit": render_sfx_critical_hit,
    "monsterAttack": render_sfx_monster_attack,
    "victory": render_sfx_victory,
    "defeat": render_sfx_defeat,
    "flee": render_sfx_flee,
    "levelUp": render_sfx_level_up,
    "potion": render_sfx_potion,
    "purchase": render_sfx_purchase,
    "gold": render_sfx_gold,
    "discovery": render_sfx_discovery,
}


def _validate_runtime() -> None:
    if sys.version_info[:2] != (3, 12):
        raise RuntimeError(f"Python 3.12 is required, found {sys.version.split()[0]}")
    if np.__version__ != "2.3.2":
        raise RuntimeError(f"NumPy 2.3.2 is required, found {np.__version__}")


def _load_manifest() -> dict[str, object]:
    with MANIFEST_PATH.open("r", encoding="utf-8") as source:
        manifest = json.load(source)
    if manifest.get("format") != {"sampleRate": SAMPLE_RATE, "bitsPerSample": 16}:
        raise ValueError("audio manifest format does not match generator constants")
    if set(manifest.get("bgm", {})) != set(BGM_KEYS):
        raise ValueError("audio manifest BGM keys do not match the required set")
    if set(manifest.get("sfx", {})) != set(SFX_KEYS):
        raise ValueError("audio manifest SFX keys do not match the required set")
    return manifest


def _resolve_asset_path(output_dir: Path, file_name: object) -> Path:
    if not isinstance(file_name, str):
        raise ValueError("audio manifest file name must be a string")
    file_path = Path(file_name)
    if file_path.name != file_name:
        raise ValueError(f"audio manifest file must be a basename: {file_name}")
    if file_path.suffix != ".wav":
        raise ValueError(f"audio manifest file must use .wav: {file_name}")
    resolved_dir = output_dir.resolve()
    resolved_path = (resolved_dir / file_name).resolve()
    if resolved_path.parent != resolved_dir:
        raise ValueError(f"audio manifest file escapes output directory: {file_name}")
    return resolved_path


def _print_metadata(path: Path, signal: np.ndarray, channels: int) -> None:
    data = np.asarray(signal, dtype=np.float64)
    duration = len(data) / SAMPLE_RATE
    peak = float(np.max(np.abs(data)))
    print(f"{path.name}: {duration:.2f}s, {channels}ch, peak={peak:.6f}")


def generate_all(output_dir: Path) -> None:
    manifest = _load_manifest()
    output_dir = output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_paths: set[Path] = set()
    for key in BGM_KEYS:
        asset = manifest["bgm"][key]
        signal = render_bgm(key)
        path = _resolve_asset_path(output_dir, asset["file"])
        if path in generated_paths:
            raise ValueError(f"duplicate audio manifest file: {path.name}")
        generated_paths.add(path)
        write_wav(path, signal, asset["channels"])
        _print_metadata(path, signal, asset["channels"])
        del signal
        gc.collect()
    for key in SFX_KEYS:
        asset = manifest["sfx"][key]
        signal = SFX_RENDERERS[key]()
        path = _resolve_asset_path(output_dir, asset["file"])
        if path in generated_paths:
            raise ValueError(f"duplicate audio manifest file: {path.name}")
        generated_paths.add(path)
        write_wav(path, signal, asset["channels"])
        _print_metadata(path, signal, asset["channels"])
        del signal
        gc.collect()


def self_check() -> None:
    first = smooth_noise(0.2, 12345, 5.0)
    second = smooth_noise(0.2, 12345, 5.0)
    assert np.array_equal(first, second), "identical seeds produced different noise"
    mastered = normalize(np.array([-0.2, 0.1, 0.4], dtype=np.float64))
    assert float(np.max(np.abs(mastered))) <= MASTER_PEAK + 1e-12, "normalizer exceeded peak"
    panned = stereo_pan(periodic_sine(0.2, 50.0), 0.25)
    assert panned.ndim == 2 and panned.shape[1] == 2, "stereo panning did not return two channels"
    loop = circular_seam(np.column_stack((first, first[::-1])))
    assert float(np.max(np.abs(loop[0] - loop[-1]))) < 0.02, "circular seam endpoints differ"
    print("audio synthesis self-check: PASS")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate deterministic dark-dungeon audio assets.")
    parser.add_argument("--self-check", action="store_true", help="run deterministic in-memory checks")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=AUDIO_DIR,
        help="directory for generated WAV files (default: assets/audio)",
    )
    arguments = parser.parse_args()
    _validate_runtime()
    if arguments.self_check:
        self_check()
    else:
        generate_all(arguments.output_dir)


if __name__ == "__main__":
    main()
