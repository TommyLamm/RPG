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
  manifest.shop,
  manifest.potion
];

if (assets.length !== 14 || new Set(assets).size !== 14) {
  throw new Error("asset manifest must contain 14 unique assets");
}

for (const asset of assets) {
  const absolute = path.join(imageDir, asset);
  const stat = fs.statSync(absolute);
  if (stat.size < 4096) {
    throw new Error(`asset too small: ${asset}`);
  }
}

console.log("asset verification: PASS");
