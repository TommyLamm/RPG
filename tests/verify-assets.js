const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const imageDir = path.join(root, "assets", "images");
const manifest = JSON.parse(
  fs.readFileSync(path.join(imageDir, "asset-manifest.json"), "utf8")
);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const assets = [
  ...manifest.scenes,
  ...Object.values(manifest.monsters),
  ...Object.values(manifest.monsterActions).flatMap((actions) => Object.values(actions)),
  manifest.shop,
  manifest.potion
];

if (assets.length !== 38 || new Set(assets).size !== 38) {
  throw new Error("asset manifest must contain 38 unique assets");
}

for (const asset of assets) {
  const absolute = path.join(imageDir, asset);
  const stat = fs.statSync(absolute);
  if (stat.size < 4096) {
    throw new Error(`asset too small: ${asset}`);
  }
}

const manifestAssetSet = new Set(assets);
const staticImageReferences = [...html.matchAll(/"assets\/images\/([^"]+)"/g)].map((match) => match[1]);
for (const asset of staticImageReferences) {
  if (!manifestAssetSet.has(asset)) {
    throw new Error(`HTML image reference missing from manifest: ${asset}`);
  }
}

const slugSection = html.slice(html.indexOf("const monsterActionSlugs"));
const bossMonsterIds = [...html.matchAll(/monsterId:\s*"([^"]+)"/g)].map((match) => match[1]);
for (const monsterId of bossMonsterIds) {
  const monsterAssetMatch = html.match(new RegExp(`\\b${monsterId}:\\s*"assets/images/([^"]+)"`));
  if (!monsterAssetMatch || !manifestAssetSet.has(monsterAssetMatch[1])) {
    throw new Error(`boss monster asset missing from manifest: ${monsterId}`);
  }

  const slugMatch = slugSection.match(new RegExp(`\\b${monsterId}:\\s*"([^"]+)"`));
  if (!slugMatch) {
    throw new Error(`boss monster action slug missing: ${monsterId}`);
  }

  for (const action of ["attack", "hurt", "death"]) {
    const asset = `monster-actions/monster-${slugMatch[1]}-${action}.webp`;
    if (!manifestAssetSet.has(asset)) {
      throw new Error(`boss monster action asset missing from manifest: ${monsterId} ${action}`);
    }
  }
}

console.log("asset verification: PASS");
