# Dark Dungeon Audio System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate five original looping dark-ambient BGM tracks and twelve gameplay sound effects, then integrate an accessible, persistent, failure-tolerant audio controller into the browser RPG.

**Architecture:** A deterministic NumPy synthesis tool owns offline WAV creation, while a JSON manifest is the source of truth for file names and channel/loop expectations. The single-page game receives one persistent `audioController` that owns two BGM decks, pooled SFX voices, autoplay unlock, crossfading, visibility attenuation, settings persistence, and semantic event playback. Node asset tests inspect PCM structure and signal quality; Playwright stubs media playback to verify runtime routing without depending on host audio hardware.

**Tech Stack:** Python 3.12, NumPy 2.3.2, PCM WAV via Python `wave`, HTML/CSS/JavaScript, HTMLAudioElement, localStorage, Node.js, Playwright 1.60.0.

---

## File Map

- Create `assets/audio/audio-manifest.json`: authoritative keys, files, loop flags, and channel counts for 17 assets.
- Create `tools/generate_audio.py`: deterministic waveform synthesis and WAV mastering.
- Create `tests/verify-audio.js`: PCM header, duration, channel, energy, peak, clipping, and loop-seam verification.
- Modify `index.html`: audio asset maps, controller, event hooks, controls, persistence, failure reporting, and responsive styling.
- Modify `tests/browser-smoke.js`: media stubs and runtime audio assertions.
- Modify `package.json`: add audio generation and verification scripts to the standard test pipeline.

## Task 1: Add The Audio Manifest And Failing Asset Test

**Files:**
- Create: `assets/audio/audio-manifest.json`
- Create: `tests/verify-audio.js`
- Modify: `package.json`

- [ ] **Step 1: Create the audio directory and manifest**

Create `assets/audio/audio-manifest.json` with this structure:

```json
{
  "format": {
    "sampleRate": 44100,
    "bitsPerSample": 16
  },
  "bgm": {
    "village": { "file": "bgm-ash-village.wav", "loop": true, "channels": 2 },
    "forest": { "file": "bgm-rotten-forest.wav", "loop": true, "channels": 2 },
    "cave": { "file": "bgm-damp-cave.wav", "loop": true, "channels": 2 },
    "tomb": { "file": "bgm-old-king-tomb.wav", "loop": true, "channels": 2 },
    "combat": { "file": "bgm-combat.wav", "loop": true, "channels": 2 }
  },
  "sfx": {
    "playerAttack": { "file": "sfx-player-attack.wav", "loop": false, "channels": 1 },
    "playerHit": { "file": "sfx-player-hit.wav", "loop": false, "channels": 1 },
    "criticalHit": { "file": "sfx-critical-hit.wav", "loop": false, "channels": 1 },
    "monsterAttack": { "file": "sfx-monster-attack.wav", "loop": false, "channels": 1 },
    "victory": { "file": "sfx-victory.wav", "loop": false, "channels": 1 },
    "defeat": { "file": "sfx-defeat.wav", "loop": false, "channels": 1 },
    "flee": { "file": "sfx-flee.wav", "loop": false, "channels": 1 },
    "levelUp": { "file": "sfx-level-up.wav", "loop": false, "channels": 1 },
    "potion": { "file": "sfx-potion.wav", "loop": false, "channels": 1 },
    "purchase": { "file": "sfx-purchase.wav", "loop": false, "channels": 1 },
    "gold": { "file": "sfx-gold.wav", "loop": false, "channels": 1 },
    "discovery": { "file": "sfx-discovery.wav", "loop": false, "channels": 1 }
  }
}
```

- [ ] **Step 2: Write a WAV parser and failing verification test**

Create `tests/verify-audio.js` using only Node built-ins. It must:

```javascript
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const audioDir = path.join(root, "assets", "audio");
const manifest = JSON.parse(fs.readFileSync(path.join(audioDir, "audio-manifest.json"), "utf8"));

function readWav(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`invalid WAV container: ${path.basename(file)}`);
  }
  let offset = 12;
  let format;
  let pcm;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        bitsPerSample: buffer.readUInt16LE(start + 14)
      };
    }
    if (id === "data") pcm = buffer.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (!format || !pcm) throw new Error(`missing WAV chunks: ${path.basename(file)}`);
  return { format, pcm };
}
```

Flatten the manifest into exactly 17 entries and initially assert every file exists. Then add complete checks in Task 4.

- [ ] **Step 3: Add npm scripts**

Update `package.json`:

```json
{
  "scripts": {
    "generate:audio": "python tools/generate_audio.py",
    "test": "node tests/verify-assets.js && node tests/verify-audio.js && node tests/browser-smoke.js",
    "test:assets": "node tests/verify-assets.js && node tests/verify-audio.js",
    "test:audio": "node tests/verify-audio.js",
    "test:browser": "node tests/browser-smoke.js"
  }
}
```

- [ ] **Step 4: Run the test and confirm the red state**

Run:

```powershell
node tests/verify-audio.js
```

Expected: FAIL with `ENOENT` for `bgm-ash-village.wav`.

## Task 2: Build Deterministic Audio Synthesis Primitives

**Files:**
- Create: `tools/generate_audio.py`

- [ ] **Step 1: Add constants, PCM writer, and deterministic random sources**

Implement:

```python
from __future__ import annotations

import json
import math
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AUDIO_DIR = ROOT / "assets" / "audio"
MANIFEST_PATH = AUDIO_DIR / "audio-manifest.json"
SAMPLE_RATE = 44_100
PCM_LIMIT = 32_767
MASTER_PEAK = 10 ** (-1 / 20)

def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)

def normalize(signal: np.ndarray, peak: float = MASTER_PEAK) -> np.ndarray:
    maximum = float(np.max(np.abs(signal)))
    if maximum == 0:
        raise ValueError("cannot normalize silent signal")
    return signal * (peak / maximum)

def write_wav(path: Path, signal: np.ndarray, channels: int) -> None:
    data = np.asarray(signal, dtype=np.float64)
    if channels == 1:
        data = data.reshape(-1, 1)
    if data.ndim != 2 or data.shape[1] != channels:
        raise ValueError(f"invalid channel shape for {path.name}: {data.shape}")
    pcm = np.round(np.clip(data, -1, 1) * PCM_LIMIT).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())
```

- [ ] **Step 2: Add reusable synthesis helpers**

Implement helpers with explicit signatures:

```python
def periodic_sine(duration: float, frequency: float, phase: float = 0.0) -> np.ndarray: ...
def triangle(duration: float, frequency: float, phase: float = 0.0) -> np.ndarray: ...
def smooth_noise(duration: float, seed: int, kernel_ms: float) -> np.ndarray: ...
def periodic_noise(duration: float, seed: int, tile_seconds: float = 8.0) -> np.ndarray: ...
def exp_envelope(length: int, attack: float, decay: float) -> np.ndarray: ...
def event_tone(duration: float, start: float, frequency: float, decay: float, gain: float) -> np.ndarray: ...
def stereo_pan(mono: np.ndarray, pan: float) -> np.ndarray: ...
def circular_seam(signal: np.ndarray, milliseconds: float = 120.0) -> np.ndarray: ...
```

`periodic_sine()` must quantize frequency to an integer number of cycles over the track duration. `periodic_noise()` must build one circularly crossfaded tile and repeat it an integer number of times. `circular_seam()` must blend the first and last window toward a shared boundary waveform without fading the whole track to silence.

- [ ] **Step 3: Add a deterministic self-check mode**

Support:

```powershell
python tools/generate_audio.py --self-check
```

The command generates short in-memory signals and asserts:

- Identical seeds produce identical arrays.
- `normalize()` stays below `MASTER_PEAK`.
- Stereo panning returns two channels.
- Circular seam endpoint difference is below `0.02` in normalized units.

Expected output: `audio synthesis self-check: PASS`.

## Task 3: Synthesize Five Seamless BGM Tracks

**Files:**
- Modify: `tools/generate_audio.py`
- Create: `assets/audio/bgm-ash-village.wav`
- Create: `assets/audio/bgm-rotten-forest.wav`
- Create: `assets/audio/bgm-damp-cave.wav`
- Create: `assets/audio/bgm-old-king-tomb.wav`
- Create: `assets/audio/bgm-combat.wav`

- [ ] **Step 1: Implement the shared BGM renderer**

Use a fixed duration of 48 seconds and return stereo arrays:

```python
BGM_DURATION = 48.0

def render_bgm(key: str) -> np.ndarray:
    renderers = {
        "village": render_village,
        "forest": render_forest,
        "cave": render_cave,
        "tomb": render_tomb,
        "combat": render_combat,
    }
    return normalize(circular_seam(renderers[key]()))
```

Each renderer must combine at least three independently panned layers and keep event transients at least one second away from the loop boundary.

- [ ] **Step 2: Implement each environment palette**

Use these deterministic recipes:

- Village, seed 1101: 42/55 Hz drone, filtered wind, sparse 659 Hz lantern chime, low wood creak impulses.
- Forest, seed 2202: 38/57 Hz drone, wet leaf noise, irregular 392/523 Hz candle chimes, slow stereo movement.
- Cave, seed 3303: 46/69 Hz drone, periodic water drops at 784/988 Hz, long synthetic echoes, steel-blue high bed.
- Tomb, seed 4404: 32/48 Hz drone, burial bell partials at 110/164/247 Hz, stone resonance, slow ritual pulse.
- Combat, seed 5505: 45/67 Hz danger drone, 96 BPM low drum impulses, metallic scrape noise, 2 Hz tension pulse.

- [ ] **Step 3: Write BGM assets from the manifest**

The normal script entry point must read the manifest and write every BGM file with stereo channels. It must print one line per file containing name, duration, channels, and peak.

- [ ] **Step 4: Generate and inspect metadata**

Run:

```powershell
python tools/generate_audio.py
```

Expected: five `bgm-*.wav` files, each exactly 48 seconds, 44.1 kHz, 16-bit stereo.

## Task 4: Synthesize Twelve Gameplay Sound Effects

**Files:**
- Modify: `tools/generate_audio.py`
- Create: `assets/audio/sfx-player-attack.wav`
- Create: `assets/audio/sfx-player-hit.wav`
- Create: `assets/audio/sfx-critical-hit.wav`
- Create: `assets/audio/sfx-monster-attack.wav`
- Create: `assets/audio/sfx-victory.wav`
- Create: `assets/audio/sfx-defeat.wav`
- Create: `assets/audio/sfx-flee.wav`
- Create: `assets/audio/sfx-level-up.wav`
- Create: `assets/audio/sfx-potion.wav`
- Create: `assets/audio/sfx-purchase.wav`
- Create: `assets/audio/sfx-gold.wav`
- Create: `assets/audio/sfx-discovery.wav`

- [ ] **Step 1: Implement SFX component helpers**

Add:

```python
def impact(duration: float, seed: int, body_hz: float, noise_gain: float) -> np.ndarray: ...
def sweep(duration: float, start_hz: float, end_hz: float) -> np.ndarray: ...
def resonant_chime(duration: float, frequencies: list[float], decay: float) -> np.ndarray: ...
def delayed_mix(signal: np.ndarray, delays: list[tuple[float, float]]) -> np.ndarray: ...
```

Every SFX must receive a 5 ms attack edge and 20 ms release edge before normalization.

- [ ] **Step 2: Implement the twelve SFX recipes**

Use semantic renderers named `render_sfx_player_attack()` through `render_sfx_discovery()`. Durations:

- Player attack 0.55 s: downward noise sweep plus iron impact.
- Player hit 0.65 s: blunt body impact plus low resonance.
- Critical hit 0.9 s: heavier impact, metallic accent, short sub drop.
- Monster attack 0.75 s: rough upward noise lunge plus impact.
- Victory 2.2 s: minor-to-open chime progression and fading low pulse.
- Defeat 2.4 s: downward bell and collapsing rumble.
- Flee 1.0 s: fast filtered noise steps moving away.
- Level up 1.8 s: rising ritual chimes at 392/523/659 Hz.
- Potion 1.35 s: cork impulse, glass ring, liquid noise, warm resonance.
- Purchase 0.8 s: two coin strikes and wood counter impact.
- Gold 0.7 s: three small coin partials.
- Discovery 1.6 s: reversed-like swell synthesized with a rising envelope and one bell.

- [ ] **Step 3: Write all SFX assets and rerun generation**

Run `python tools/generate_audio.py` and expect 12 mono SFX plus five stereo BGM files.

- [ ] **Step 4: Complete asset quality verification**

Extend `tests/verify-audio.js` to calculate:

```javascript
const sampleCount = wav.pcm.length / 2;
const samples = new Int16Array(
  wav.pcm.buffer,
  wav.pcm.byteOffset,
  sampleCount
);
const duration = sampleCount / wav.format.channels / wav.format.sampleRate;
let peak = 0;
let energy = 0;
let clipped = 0;
for (const sample of samples) {
  const absolute = Math.abs(sample);
  peak = Math.max(peak, absolute);
  energy += sample * sample;
  if (absolute >= 32767) clipped += 1;
}
const rms = Math.sqrt(energy / samples.length) / 32768;
```

Assert:

- 17 unique files.
- PCM format 1, 44.1 kHz, 16-bit.
- Manifest channel counts match.
- BGM duration 45-60 seconds; SFX duration 0.25-2.5 seconds.
- RMS greater than `0.003`.
- Peak no greater than 32735 and no clipped samples.
- For each BGM channel, average absolute difference between the first and last 1024 samples is below `1800` PCM units.

Run `node tests/verify-audio.js` and expect `audio verification: PASS (17 files)`.

## Task 5: Add The Persistent Audio Controller

**Files:**
- Modify: `index.html`
- Modify: `tests/browser-smoke.js`

- [ ] **Step 1: Add failing browser API assertions**

Before implementation, extend the browser test to assert:

```javascript
const audioApi = await page.evaluate(() => ({
  controller: typeof audioController,
  bgmKeys: Object.keys(BGM_ASSETS || {}).length,
  sfxKeys: Object.keys(SFX_ASSETS || {}).length,
  settings: audioController?.getSettings?.()
}));
assert(audioApi.controller === "object", "audio controller missing");
assert(audioApi.bgmKeys === 5, "BGM mapping missing");
assert(audioApi.sfxKeys === 12, "SFX mapping missing");
```

Run the browser test and confirm it fails because `audioController` is undefined.

- [ ] **Step 2: Add runtime asset maps and settings constants**

Add to `index.html`:

```javascript
const AUDIO_BASE = "assets/audio/";
const BGM_ASSETS = {
  village: `${AUDIO_BASE}bgm-ash-village.wav`,
  forest: `${AUDIO_BASE}bgm-rotten-forest.wav`,
  cave: `${AUDIO_BASE}bgm-damp-cave.wav`,
  tomb: `${AUDIO_BASE}bgm-old-king-tomb.wav`,
  combat: `${AUDIO_BASE}bgm-combat.wav`
};
const SFX_ASSETS = {
  playerAttack: `${AUDIO_BASE}sfx-player-attack.wav`,
  playerHit: `${AUDIO_BASE}sfx-player-hit.wav`,
  criticalHit: `${AUDIO_BASE}sfx-critical-hit.wav`,
  monsterAttack: `${AUDIO_BASE}sfx-monster-attack.wav`,
  victory: `${AUDIO_BASE}sfx-victory.wav`,
  defeat: `${AUDIO_BASE}sfx-defeat.wav`,
  flee: `${AUDIO_BASE}sfx-flee.wav`,
  levelUp: `${AUDIO_BASE}sfx-level-up.wav`,
  potion: `${AUDIO_BASE}sfx-potion.wav`,
  purchase: `${AUDIO_BASE}sfx-purchase.wav`,
  gold: `${AUDIO_BASE}sfx-gold.wav`,
  discovery: `${AUDIO_BASE}sfx-discovery.wav`
};
const AUDIO_SETTINGS_KEY = "black-candle-audio-v1";
const DEFAULT_AUDIO_SETTINGS = Object.freeze({ muted: false, musicVolume: 0.42, sfxVolume: 0.72 });
```

- [ ] **Step 3: Implement `createAudioController()`**

The returned API must expose:

```javascript
{
  unlock,
  syncBgm,
  playSfx,
  toggleMute,
  setMusicVolume,
  setSfxVolume,
  getSettings,
  getDebugState
}
```

Implementation requirements:

- Sanitize saved settings with `clamp()` and booleans.
- Use two `Audio` BGM decks with `loop = true` and `preload = "auto"`.
- `desiredBgmKey()` returns combat when `hasActiveCombat()`, otherwise maps story stages 0-3 to village/forest/cave/tomb.
- `syncBgm()` does nothing before unlock and does not restart the current matching track.
- Crossfade over 1.2 seconds using `requestAnimationFrame`; combat may use 1.0 second.
- `playSfx()` creates or reuses up to four voices per key and resets `currentTime = 0` before playback.
- Promise rejections and media `error` events call one deduplicated `reportAudioFailure(asset)` method that uses `addLog()` and `render()` without recursion.
- Page visibility changes apply a 0.25 multiplier to BGM while hidden.
- Save settings after each control change.

- [ ] **Step 4: Add first-interaction unlock**

Add delegated listeners once, outside `render()`:

```javascript
app.addEventListener("click", (event) => {
  if (event.target.closest("button, input")) audioController.unlock();
});
app.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.closest("button, input")) {
    audioController.unlock();
  }
});
```

After every game-state-changing render, call `audioController.syncBgm()` after DOM updates.

## Task 6: Add Audio Controls And Responsive Styling

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add audio control CSS**

Add `.audio-controls`, `.audio-toggle`, `.audio-slider`, and `.audio-slider input` styles. The control group must use stable dimensions, 6 px radius or less, and wrap at narrow widths. Add a media rule at 620 px that gives each slider a flexible width without exceeding the viewport.

- [ ] **Step 2: Render accessible controls in the top bar**

Add `renderAudioControls()` returning:

```html
<div class="audio-controls" aria-label="声音控制">
  <button class="audio-toggle" type="button" onclick="audioController.toggleMute()" aria-pressed="false" title="静音">...</button>
  <label class="audio-slider">音乐 <input type="range" min="0" max="1" step="0.05" ...></label>
  <label class="audio-slider">音效 <input type="range" min="0" max="1" step="0.05" ...></label>
</div>
```

Use a familiar inline speaker icon rather than a text-filled rounded button. The icon and accessible label must switch for muted/unmuted state.

- [ ] **Step 3: Preserve control focus across render**

Extend the existing focus-key handling to include range inputs. Changing either slider must not dump focus to the page body.

- [ ] **Step 4: Verify 360 px layout**

Extend the overflow selector in `tests/browser-smoke.js` to include `.audio-controls` and `.audio-slider`. Run the mobile test and expect no clipped controls or horizontal overflow.

## Task 7: Connect Music And Sound Effects To Game Events

**Files:**
- Modify: `index.html`
- Modify: `tests/browser-smoke.js`

- [ ] **Step 1: Wire BGM state changes**

Ensure `audioController.syncBgm()` is invoked after:

- Screen changes.
- Story stage changes.
- Combat starts.
- Victory, defeat, and flee end combat.

The controller's same-key guard prevents unnecessary restarts.

- [ ] **Step 2: Wire battle SFX**

Add semantic calls without changing damage calculations:

```javascript
audioController.playSfx("playerAttack");
audioController.playSfx("monsterAttack");
audioController.playSfx("playerHit");
audioController.playSfx("victory");
audioController.playSfx("defeat");
audioController.playSfx("flee");
```

Do not call `criticalHit` because no critical-hit mechanic exists.

- [ ] **Step 3: Wire economy, item, progression, and discovery SFX**

- Successful `buyPotion()` -> `purchase`.
- Successful `usePotion()` -> `potion`.
- `gainGold()` -> `gold`.
- Each loop iteration in `checkLevelUps()` -> `levelUp`.
- Clue/key/special story branches -> `discovery`.

Do not play effects for failed purchases, invalid item use, or blocked exploration.

- [ ] **Step 4: Add event-routing browser assertions**

Use `page.addInitScript()` before navigation to stub `HTMLMediaElement.prototype.play` and record source/play calls in `window.__audioProbe`. Assert:

- No play before first interaction.
- First interaction requests village BGM.
- Stage values 1/2/3 request forest/cave/tomb.
- Active combat requests combat BGM.
- Player attack requests player attack, monster attack, and player hit.
- Successful potion, purchase, gold, discovery, level up, victory, defeat, and flee request their exact SFX files.
- Critical-hit SFX is never requested by existing combat.

## Task 8: Test Settings, Failure Handling, And Persistence

**Files:**
- Modify: `tests/browser-smoke.js`

- [ ] **Step 1: Test mute and volume controls**

Set music to `0.25`, SFX to `0.55`, toggle mute, and assert `audioController.getSettings()` returns sanitized values and `aria-pressed` matches the mute state.

- [ ] **Step 2: Test reload persistence**

Reload the page and assert the sliders and controller restore the stored values. Audio must remain locked until another gesture after reload.

- [ ] **Step 3: Test invalid persisted settings**

Write `{ muted: "no", musicVolume: 9, sfxVolume: -4 }` to the settings key, reload, and assert defaults/sanitized bounds are used.

- [ ] **Step 4: Test media failure isolation**

Make the media stub reject one expected BGM and one SFX play call. Assert:

- Only one failure log per asset appears.
- Repeated calls do not repeatedly retry the failed asset.
- Gameplay buttons remain enabled and combat state still changes correctly.

## Task 9: Final Verification And Cleanup

**Files:**
- Modify: `package.json`
- Verify: all implementation and asset files

- [ ] **Step 1: Run deterministic regeneration twice**

Run the generator, hash all 17 WAV files, run it again, and compare hashes:

```powershell
python tools/generate_audio.py
$first = Get-ChildItem assets/audio/*.wav | Get-FileHash | ForEach-Object { "$($_.Path)|$($_.Hash)" }
python tools/generate_audio.py
$second = Get-ChildItem assets/audio/*.wav | Get-FileHash | ForEach-Object { "$($_.Path)|$($_.Hash)" }
Compare-Object $first $second
```

Expected: no differences.

- [ ] **Step 2: Run the complete test suite**

Run:

```powershell
npm test
```

Expected:

```text
asset verification: PASS
audio verification: PASS (17 files)
browser smoke: PASS
```

- [ ] **Step 3: Inspect runtime and output sizes**

Confirm all BGM loops are audible, distinct, and free from obvious clicks; SFX are recognizable and not louder than the mix. Print file sizes and ensure the total audio package remains below 60 MiB.

- [ ] **Step 4: Confirm project constraints**

Verify:

- No remote audio URLs.
- No autoplay before interaction.
- No changes to combat formulas or reward formulas.
- No critical-hit mechanic added.
- Game remains playable with media playback rejected.
- Workspace remains directly openable in a browser.

The workspace is not a Git repository, so no commit or branch integration step is performed.
