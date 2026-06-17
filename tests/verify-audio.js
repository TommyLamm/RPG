const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const defaultAudioDir = path.resolve(root, "assets", "audio");
const defaultManifestPath = path.join(defaultAudioDir, "audio-manifest.json");

const expectedBgmKeys = ["village", "forest", "cave", "tomb", "combat"];
const expectedSfxKeys = [
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
  "discovery"
];
const peakLimit = 29206;
const seamLimits = {
  endpointJump: 128,
  derivativeDifference: 256,
  boundaryAdjacentJump: 512
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadManifest(manifestPath = defaultManifestPath) {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

function assertExactKeys(actual, expected, label) {
  const keys = Object.keys(actual);
  assert(keys.length === expected.length, `${label} expected ${expected.length} keys, found ${keys.length}`);
  assert(expected.every((key) => keys.includes(key)), `${label} keys do not match the specification`);
}

function resolveAssetFile(fileName, audioDirectory = defaultAudioDir) {
  const resolvedAudioDir = path.resolve(audioDirectory);
  assert(typeof fileName === "string", "audio manifest file name must be a string");
  assert(path.basename(fileName) === fileName, `audio manifest file must be a basename: ${fileName}`);
  assert(path.extname(fileName) === ".wav", `audio manifest file must use .wav: ${fileName}`);
  const resolved = path.resolve(resolvedAudioDir, fileName);
  assert(path.dirname(resolved) === resolvedAudioDir, `audio manifest file escapes audio directory: ${fileName}`);
  return resolved;
}

function readWav(file) {
  const buffer = fs.readFileSync(file);
  const name = path.basename(file);
  assert(buffer.length >= 12, `WAV file is too short: ${name}`);
  assert(buffer.toString("ascii", 0, 4) === "RIFF", `invalid RIFF signature: ${name}`);
  assert(buffer.toString("ascii", 8, 12) === "WAVE", `invalid WAVE signature: ${name}`);
  assert(buffer.readUInt32LE(4) + 8 === buffer.length, `RIFF declared length mismatch: ${name}`);

  let offset = 12;
  let format;
  let pcm;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const paddedEnd = start + size + (size % 2);
    assert(start + size <= buffer.length, `truncated WAV chunk: ${name}`);
    assert(paddedEnd <= buffer.length, `truncated WAV chunk padding: ${name}`);
    if (id === "fmt ") {
      assert(size >= 16, `fmt chunk is shorter than 16 bytes: ${name}`);
      format = {
        audioFormat: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        byteRate: buffer.readUInt32LE(start + 8),
        blockAlign: buffer.readUInt16LE(start + 12),
        bitsPerSample: buffer.readUInt16LE(start + 14)
      };
    }
    if (id === "data") {
      pcm = buffer.subarray(start, start + size);
    }
    offset = paddedEnd;
  }
  assert(offset === buffer.length, `unparsed bytes remain after WAV chunks: ${name}`);
  assert(format && pcm, `missing WAV chunks: ${name}`);
  assert(format.audioFormat === 1, `${name} is not PCM format 1`);
  const expectedBlockAlign = format.channels * format.bitsPerSample / 8;
  assert(Number.isInteger(expectedBlockAlign), `invalid PCM block alignment inputs: ${name}`);
  assert(format.blockAlign === expectedBlockAlign, `blockAlign mismatch: ${name}`);
  assert(format.byteRate === format.sampleRate * format.blockAlign, `byteRate mismatch: ${name}`);
  assert(pcm.length % format.blockAlign === 0, `data chunk is not frame-aligned: ${name}`);
  return { format, pcm };
}

function loopMetrics(samples, frames, channels, channel, windowFrames = 1024) {
  assert(frames >= 3, "loop seam requires at least three frames");
  const first = samples[channel];
  const second = samples[channels + channel];
  const previous = samples[(frames - 2) * channels + channel];
  const last = samples[(frames - 1) * channels + channel];
  const endpointJump = Math.abs(first - last);
  const derivativeDifference = Math.abs((last - previous) - (second - first));
  const window = Math.min(windowFrames, frames - 1);
  let boundaryAdjacentJump = endpointJump;
  for (let frame = frames - window; frame < frames - 1; frame += 1) {
    const current = samples[frame * channels + channel];
    const next = samples[(frame + 1) * channels + channel];
    boundaryAdjacentJump = Math.max(boundaryAdjacentJump, Math.abs(next - current));
  }
  for (let frame = 0; frame < window - 1; frame += 1) {
    const current = samples[frame * channels + channel];
    const next = samples[(frame + 1) * channels + channel];
    boundaryAdjacentJump = Math.max(boundaryAdjacentJump, Math.abs(next - current));
  }
  return { endpointJump, derivativeDifference, boundaryAdjacentJump };
}

function assertLoopSeam(samples, frames, channels, channel, label) {
  const metrics = loopMetrics(samples, frames, channels, channel);
  assert(metrics.endpointJump <= seamLimits.endpointJump, `${label} endpoint jump ${metrics.endpointJump}`);
  assert(
    metrics.derivativeDifference <= seamLimits.derivativeDifference,
    `${label} derivative difference ${metrics.derivativeDifference}`
  );
  assert(
    metrics.boundaryAdjacentJump <= seamLimits.boundaryAdjacentJump,
    `${label} boundary adjacent jump ${metrics.boundaryAdjacentJump}`
  );
}

function verifySeamRegressionProbe() {
  const fullScaleJump = new Int16Array([32767, 0, 0, 0, 0, 0, 0, -32768]);
  let rejected = false;
  try {
    assertLoopSeam(fullScaleJump, fullScaleJump.length, 1, 0, "synthetic full-scale jump");
  } catch (error) {
    rejected = /jump|difference/.test(error.message);
  }
  assert(rejected, "loop seam checks did not reject a full-scale single-frame jump");
}

function verifyManifestPathRegressionProbe(audioDirectory = defaultAudioDir) {
  for (const invalidName of ["../escape.wav", "nested/escape.wav", "upper.WAV", "not-a-wave.txt"]) {
    let rejected = false;
    try {
      resolveAssetFile(invalidName, audioDirectory);
    } catch (error) {
      rejected = /basename|\.wav|escapes/.test(error.message);
    }
    assert(rejected, `manifest path validation accepted ${invalidName}`);
  }
}

function flattenManifest(manifest) {
  return [
    ...expectedBgmKeys.map((key) => ({ type: "bgm", key, ...manifest.bgm[key] })),
    ...expectedSfxKeys.map((key) => ({ type: "sfx", key, ...manifest.sfx[key] }))
  ];
}

function verifyAudioDirectory(audioDirectory = defaultAudioDir, manifestPath = defaultManifestPath) {
  const manifest = loadManifest(manifestPath);
  assert(manifest.format.sampleRate === 44100, "manifest sample rate must be 44100 Hz");
  assert(manifest.format.bitsPerSample === 16, "manifest sample depth must be 16-bit");
  assertExactKeys(manifest.bgm, expectedBgmKeys, "BGM manifest");
  assertExactKeys(manifest.sfx, expectedSfxKeys, "SFX manifest");
  verifySeamRegressionProbe();
  verifyManifestPathRegressionProbe(audioDirectory);

  const entries = flattenManifest(manifest);
  assert(entries.length === 17, `expected 17 audio assets, found ${entries.length}`);
  assert(new Set(entries.map((entry) => entry.file)).size === 17, "audio manifest contains duplicate files");

  for (const entry of entries) {
    const file = resolveAssetFile(entry.file, audioDirectory);
    const wav = readWav(file);
    const sampleCount = wav.pcm.length / 2;
    assert(Number.isInteger(sampleCount), `odd PCM byte count: ${entry.file}`);
    const samples = new Int16Array(wav.pcm.buffer, wav.pcm.byteOffset, sampleCount);
    const frames = sampleCount / wav.format.channels;
    const duration = frames / wav.format.sampleRate;

    assert(Number.isInteger(frames), `${entry.file} has incomplete PCM frames`);
    assert(wav.format.sampleRate === manifest.format.sampleRate, `${entry.file} sample rate mismatch`);
    assert(wav.format.bitsPerSample === manifest.format.bitsPerSample, `${entry.file} sample depth mismatch`);
    assert(wav.format.channels === entry.channels, `${entry.file} channel count mismatch`);
    assert(entry.loop === (entry.type === "bgm"), `${entry.file} loop flag mismatch`);
    if (entry.type === "bgm") {
      assert(duration >= 45 && duration <= 60, `${entry.file} duration ${duration.toFixed(3)} is outside 45-60 seconds`);
    } else {
      assert(duration >= 0.25 && duration <= 2.5, `${entry.file} duration ${duration.toFixed(3)} is outside 0.25-2.5 seconds`);
    }

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
    assert(rms > 0.003, `${entry.file} is silent or too quiet (RMS ${rms.toFixed(6)})`);
    assert(peak <= peakLimit, `${entry.file} exceeds -1 dBFS peak limit (${peak} > ${peakLimit})`);
    assert(clipped === 0, `${entry.file} contains ${clipped} clipped samples`);

    if (entry.type === "bgm") {
      for (let channel = 0; channel < wav.format.channels; channel += 1) {
        assertLoopSeam(samples, frames, wav.format.channels, channel, `${entry.file} channel ${channel + 1}`);
      }
    }
  }

  return { entries, manifest };
}

if (require.main === module) {
  const { entries } = verifyAudioDirectory();
  console.log(`audio verification: PASS (${entries.length} files)`);
}

module.exports = {
  defaultAudioDir,
  defaultManifestPath,
  expectedBgmKeys,
  expectedSfxKeys,
  flattenManifest,
  loadManifest,
  readWav,
  resolveAssetFile,
  verifyAudioDirectory
};
