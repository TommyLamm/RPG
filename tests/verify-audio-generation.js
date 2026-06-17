const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  defaultAudioDir,
  defaultManifestPath,
  flattenManifest,
  loadManifest,
  verifyAudioDirectory
} = require("./verify-audio");

const root = path.resolve(__dirname, "..");
const generator = path.join(root, "tools", "generate_audio.py");
const manifest = loadManifest(defaultManifestPath);
const expectedFiles = flattenManifest(manifest).map((asset) => asset.file).sort();
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dark-dungeon-audio-"));
const firstDirectory = path.join(temporaryRoot, "first");
const secondDirectory = path.join(temporaryRoot, "second");

function generate(outputDirectory) {
  const python = process.env.PYTHON || "python";
  const result = spawnSync(python, [generator, "--output-dir", outputDirectory], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  assert.strictEqual(
    result.status,
    0,
    `audio generation failed for ${outputDirectory}\n${result.error?.stack || ""}\n${result.stdout || ""}\n${result.stderr || ""}`
  );
}

function hashes(directory) {
  const files = fs.readdirSync(directory).filter((file) => file.endsWith(".wav")).sort();
  assert.deepStrictEqual(files, expectedFiles, `generated file set or temporary artifact mismatch in ${directory}`);
  return Object.fromEntries(files.map((file) => {
    const contents = fs.readFileSync(path.join(directory, file));
    return [file, crypto.createHash("sha256").update(contents).digest("hex")];
  }));
}

let generationPassed = false;
try {
  verifyAudioDirectory(defaultAudioDir, defaultManifestPath);
  generate(firstDirectory);
  generate(secondDirectory);
  verifyAudioDirectory(firstDirectory, defaultManifestPath);
  verifyAudioDirectory(secondDirectory, defaultManifestPath);

  const firstHashes = hashes(firstDirectory);
  assert.deepStrictEqual(firstHashes, hashes(secondDirectory), "generated WAV hashes differ between temporary runs");
  assert.deepStrictEqual(firstHashes, hashes(defaultAudioDir), "generated WAV hashes differ from committed assets");
  generationPassed = true;
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
assert(!fs.existsSync(temporaryRoot), `temporary generation directory was not removed: ${temporaryRoot}`);
assert(generationPassed, "audio generation did not complete");
console.log("audio generation verification: PASS (17 files, committed hashes match)");
