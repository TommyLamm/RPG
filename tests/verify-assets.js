const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const imageDir = path.join(root, "assets", "images");
const manifest = JSON.parse(
  fs.readFileSync(path.join(imageDir, "asset-manifest.json"), "utf8")
);
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

console.log("asset verification: PASS");
