# Dark Dungeon Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an original dark hand-painted visual layer to 黑烛地牢 using 14 locally generated assets while preserving all existing game behavior and direct-browser execution.

**Architecture:** Keep `index.html` as the application and load local WebP assets from `assets/images/`. Add pure rendering helpers that map story stages and monster names to assets, then reuse one responsive scene-stage component across the main, adventure, combat, shop, and profile screens. Generated monster and potion sources use chroma-key removal before being saved as transparent project assets.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, built-in `image_gen`, Python/Pillow chroma-key helper, Node.js, Playwright with local Chrome.

---

## File Structure

- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`
  - Adds image mappings, scene-stage helpers, responsive stage styling, asset fallbacks, and screen integrations.
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/`
  - Contains the 14 final WebP assets.
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/tmp/imagegen/`
  - Holds temporary chroma-key generation outputs until alpha removal is verified.
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/tests/browser-smoke.js`
  - Adds assertions for scene assets, monster art, potion images, fallbacks, and visual-stage layout.
- Reference: `F:/Desktop/RPG/GPT 5.5 Codex/docs/superpowers/specs/2026-06-14-dark-dungeon-visual-upgrade-design.md`

## Task 1: Prepare Asset Directories And Manifest

**Files:**
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/tmp/imagegen/`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/asset-manifest.json`

- [ ] **Step 1: Verify the asset directories do not already contain the target files**

Run:

```powershell
Get-ChildItem 'assets/images' -File -ErrorAction SilentlyContinue
```

Expected: no target asset files before generation.

- [ ] **Step 2: Create the asset directories**

Run:

```powershell
New-Item -ItemType Directory -Force 'assets/images','tmp/imagegen' | Out-Null
```

Expected: both directories exist.

- [ ] **Step 3: Add the asset manifest**

Create `assets/images/asset-manifest.json`:

```json
{
  "scenes": [
    "scene-ash-village.webp",
    "scene-rotten-forest.webp",
    "scene-damp-cave.webp",
    "scene-old-king-tomb.webp"
  ],
  "monsters": {
    "史莱姆": "monster-slime.webp",
    "哥布林": "monster-goblin.webp",
    "骷髅兵": "monster-skeleton.webp",
    "野狼": "monster-wolf.webp",
    "暗影兽": "monster-shadow-beast.webp",
    "腐肉守卫": "monster-flesh-guard.webp",
    "墓穴猎手": "monster-tomb-hunter.webp",
    "黑烛信徒": "monster-black-candle-cultist.webp"
  },
  "shop": "scene-black-candle-shop.webp",
  "potion": "item-black-candle-potion.webp"
}
```

- [ ] **Step 4: Verify the manifest has 14 unique asset paths**

Run:

```powershell
$manifest = Get-Content 'assets/images/asset-manifest.json' -Raw | ConvertFrom-Json
$paths = @($manifest.scenes) + @($manifest.monsters.PSObject.Properties.Value) + $manifest.shop + $manifest.potion
"count=$($paths.Count) unique=$(@($paths | Sort-Object -Unique).Count)"
```

Expected: `count=14 unique=14`.

## Task 2: Generate Five Environment Assets

**Files:**
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/scene-ash-village.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/scene-rotten-forest.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/scene-damp-cave.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/scene-old-king-tomb.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/scene-black-candle-shop.webp`

- [ ] **Step 1: Generate the ash village scene**

Use built-in `image_gen` with:

```text
Use case: illustration-story
Asset type: wide environment art for a dark fantasy browser RPG
Primary request: the entrance to an abandoned village named Ash Village, a collapsed timber gate, a sealed stone well marked with black wax, dying lanterns, empty wet street, distant ruined houses
Style/medium: original dark hand-painted fantasy illustration, painterly concept art, readable environment detail
Composition/framing: wide landscape, central focal point around the sealed well and gate, important subject kept in the middle for mobile cropping
Lighting/mood: late dusk, localized amber lantern light, cold fog, ominous but inspectable
Color palette: charcoal stone, rust red, tarnished gold, bone neutral, cold moss, steel blue
Constraints: no characters in the foreground, no text, no logo, no UI, no border, no watermark, not uniformly black
```

Copy the selected output into the workspace and convert/save as `assets/images/scene-ash-village.webp`.

- [ ] **Step 2: Generate the rotten forest scene**

Use:

```text
Use case: illustration-story
Asset type: wide environment art for a dark fantasy browser RPG
Primary request: a rotten forest path with twisted wet trees, black candle stubs nailed into bark, bone charms, fog, muddy ground and a path disappearing toward the center
Style/medium: original dark hand-painted fantasy illustration, painterly concept art
Composition/framing: wide landscape, central path and focal point preserved for mobile cropping
Lighting/mood: cold green-gray fog with restrained amber candle points, threatening but visible
Color palette: charcoal, cold moss, bone, rust, tarnished gold, steel blue
Constraints: no visible monster, no text, no logo, no UI, no border, no watermark
```

Save as `assets/images/scene-rotten-forest.webp`.

- [ ] **Step 3: Generate the damp cave scene**

Use:

```text
Use case: illustration-story
Asset type: wide environment art for a dark fantasy browser RPG
Primary request: a damp stone cave tunnel with shallow reflective water, hanging rusted chains, carved burial marks and a distant amber light
Style/medium: original dark hand-painted fantasy illustration
Composition/framing: wide tunnel composition, vanishing point near center
Lighting/mood: cold steel-blue cave light, subtle amber depth light, wet readable surfaces
Color palette: charcoal, steel blue, rust, bone, restrained gold
Constraints: no character, no text, no logo, no UI, no border, no watermark, preserve visible stone detail
```

Save as `assets/images/scene-damp-cave.webp`.

- [ ] **Step 4: Generate the old king tomb scene**

Use:

```text
Use case: illustration-story
Asset type: wide environment art for a dark fantasy browser RPG
Primary request: an old royal burial chamber with cracked king statues, monumental stone sarcophagus, a black candle altar, torn banners and ancient floor seals
Style/medium: original dark hand-painted fantasy illustration
Composition/framing: wide symmetrical chamber, altar and sarcophagus centered
Lighting/mood: solemn, cold shadows with tarnished gold and red candle light, environment remains inspectable
Color palette: charcoal, bone stone, tarnished gold, blood red, steel blue
Constraints: no living characters, no text, no logo, no UI, no border, no watermark
```

Save as `assets/images/scene-old-king-tomb.webp`.

- [ ] **Step 5: Generate the black candle shop scene**

Use:

```text
Use case: illustration-story
Asset type: wide shop environment art for a dark fantasy browser RPG
Primary request: a hidden village apothecary interior, old wooden shelves filled with bottles, black candles, a merchant counter, dried herbs and one warm red potion display
Style/medium: original dark hand-painted fantasy illustration
Composition/framing: wide landscape, counter centered with usable lower space for an overlay label
Lighting/mood: warm localized candlelight surrounded by deep cool shadow, readable merchandise
Color palette: charcoal, bone, moss, tarnished gold, muted red, steel blue
Constraints: no visible merchant face, no text, no logo, no UI, no border, no watermark
```

Save as `assets/images/scene-black-candle-shop.webp`.

- [ ] **Step 6: Verify scene dimensions and sizes**

Run a Pillow check using the bundled Python:

```python
from pathlib import Path
from PIL import Image

for path in Path("assets/images").glob("scene-*.webp"):
    with Image.open(path) as image:
        assert image.width > image.height
        assert image.width >= 1024
        print(path.name, image.size, path.stat().st_size)
```

Expected: five landscape assets, each at least 1024px wide.

## Task 3: Generate Eight Transparent Monster Assets

**Files:**
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/monster-slime.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/monster-goblin.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/monster-skeleton.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/monster-wolf.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/monster-shadow-beast.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/monster-flesh-guard.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/monster-tomb-hunter.webp`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/monster-black-candle-cultist.webp`

- [ ] **Step 1: Generate each monster on chroma key**

Issue one built-in `image_gen` call per monster using this shared frame and the subject details below:

```text
Use case: stylized-concept
Asset type: transparent monster character art for a dark fantasy browser RPG
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal, one uniform color, no shadows, gradients, texture, reflections, floor plane or lighting variation
Style/medium: original dark hand-painted fantasy bestiary illustration, painterly but with a clean readable silhouette
Composition/framing: full or three-quarter body, centered, generous padding, entire silhouette inside frame
Lighting/mood: dramatic rim light matching tarnished gold and cold steel-blue dungeon lighting
Color palette: charcoal, rust, bone, dark red, moss and steel blue; never use #00ff00 in the subject
Constraints: no cast shadow, no contact shadow, no reflection, no text, no logo, no border, no watermark
```

Subject prompts:

```text
monster-slime: a translucent tar-black slime with trapped candle fragments and one dim amber core
monster-goblin: a lean cave goblin scavenger in patched leather holding a chipped cleaver
monster-skeleton: an ancient skeletal infantry soldier with cracked iron armor and corroded sword
monster-wolf: a diseased gray dungeon wolf with wet fur, bone charms and alert predatory posture
monster-shadow-beast: a horned feline shadow creature with smoke-like edges and cold blue eyes
monster-flesh-guard: a massive stitched flesh guardian in rusted executioner armor
monster-tomb-hunter: a hooded tomb hunter with hooked blades, bone mask and layered grave-cloth
monster-black-candle-cultist: a black-candle cultist in wax-stained robes holding a ritual lantern
```

Save each generated chroma source under `tmp/imagegen/<asset-name>-chroma.png`.

- [ ] **Step 2: Remove chroma-key backgrounds**

For each source, run:

```powershell
& 'C:/Users/lamyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' `
  'C:/Users/lamyu/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py' `
  --input 'tmp/imagegen/<asset-name>-chroma.png' `
  --out 'assets/images/<asset-name>.webp' `
  --auto-key border `
  --soft-matte `
  --transparent-threshold 12 `
  --opaque-threshold 220 `
  --despill
```

Expected: final WebP assets have alpha transparency.

- [ ] **Step 3: Validate monster alpha and subject coverage**

Run:

```python
from pathlib import Path
from PIL import Image

for path in Path("assets/images").glob("monster-*.webp"):
    with Image.open(path).convert("RGBA") as image:
        alpha = image.getchannel("A")
        assert alpha.getextrema()[0] == 0
        bbox = alpha.getbbox()
        assert bbox is not None
        coverage = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) / (image.width * image.height)
        assert 0.18 <= coverage <= 0.9
        print(path.name, image.size, round(coverage, 3))
```

Expected: eight files pass with transparent pixels and plausible coverage.

## Task 4: Generate Transparent Potion Asset

**Files:**
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/assets/images/item-black-candle-potion.webp`

- [ ] **Step 1: Generate the potion on chroma key**

Use built-in `image_gen`:

```text
Use case: stylized-concept
Asset type: transparent inventory item art for a dark fantasy browser RPG
Primary request: a distinctive worn glass potion vial filled with dark crimson liquid, sealed by black wax, small tarnished brass charm, readable at 48px and 96px
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background, uniform color, no shadows, gradients, texture, reflections or floor plane
Style/medium: original dark hand-painted game item illustration with crisp silhouette
Composition/framing: centered upright vial, generous padding
Lighting/mood: restrained amber highlight and cold steel-blue glass edge
Constraints: do not use #00ff00 in the subject, no cast shadow, no reflection, no text, no logo, no border, no watermark
```

Save source as `tmp/imagegen/item-black-candle-potion-chroma.png`.

- [ ] **Step 2: Remove the chroma key**

Run the same chroma helper and save:

```text
assets/images/item-black-candle-potion.webp
```

- [ ] **Step 3: Verify small-size readability and alpha**

Create a 48px preview with Pillow and inspect both original and preview. Confirm transparent corners and a recognizable vial silhouette.

## Task 5: Add Asset Mappings And Rendering Helpers

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/tests/browser-smoke.js`

- [ ] **Step 1: Add failing static assertions**

Add checks to `tests/browser-smoke.js` for:

```javascript
assert(Array.isArray(sceneAssets) && sceneAssets.length === 4, "scene asset mapping missing");
assert(Object.keys(monsterAssets).length === 8, "monster asset mapping missing");
assert(typeof renderSceneStage === "function", "scene stage helper missing");
assert(typeof renderPotionImage === "function", "potion image helper missing");
```

Run the test.

Expected: FAIL because mappings/helpers do not exist.

- [ ] **Step 2: Add JavaScript asset constants**

Add to `index.html`:

```javascript
const sceneAssets = [
  "assets/images/scene-ash-village.webp",
  "assets/images/scene-rotten-forest.webp",
  "assets/images/scene-damp-cave.webp",
  "assets/images/scene-old-king-tomb.webp"
];

const monsterAssets = {
  "史莱姆": "assets/images/monster-slime.webp",
  "哥布林": "assets/images/monster-goblin.webp",
  "骷髅兵": "assets/images/monster-skeleton.webp",
  "野狼": "assets/images/monster-wolf.webp",
  "暗影兽": "assets/images/monster-shadow-beast.webp",
  "腐肉守卫": "assets/images/monster-flesh-guard.webp",
  "墓穴猎手": "assets/images/monster-tomb-hunter.webp",
  "黑烛信徒": "assets/images/monster-black-candle-cultist.webp"
};

const SHOP_SCENE_ASSET = "assets/images/scene-black-candle-shop.webp";
const POTION_ASSET = "assets/images/item-black-candle-potion.webp";
```

- [ ] **Step 3: Add pure helper functions**

Implement:

```javascript
function currentSceneAsset() {
  const stageIndex = clamp(Number(state.story.stage) || 0, 0, sceneAssets.length - 1);
  return sceneAssets[stageIndex] || sceneAssets[0];
}

function monsterAsset(name) {
  return monsterAssets[name] || "";
}

function handleAssetError(image) {
  image.hidden = true;
  image.closest("[data-visual]")?.classList.add("asset-failed");
}

function renderPotionImage(className = "potion-art") {
  return `<img class="${className}" src="${POTION_ASSET}" alt="黑烛药剂" decoding="async" onerror="handleAssetError(this)">`;
}
```

Implement `renderSceneStage({ scene, location, status, monster, compact })` as a pure template helper. It must:

- Escape labels.
- Render a local scene image.
- Render monster art only when `monster` exists.
- Add strong-enemy class and `强敌` marker when required.
- Use empty scene alt text and monster-name alt text.
- Include `data-visual` fallback containers.

- [ ] **Step 4: Verify helper tests pass**

Run the browser smoke test.

Expected: mapping/helper assertions pass.

## Task 6: Add Scene-Stage Styling

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`

- [ ] **Step 1: Add stage CSS**

Add focused styles:

```css
.scene-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 7;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(135deg, #15120f, #070605);
  isolation: isolate;
}

.scene-stage.compact {
  aspect-ratio: 16 / 5;
}

.scene-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.scene-stage::after {
  content: "";
  position: absolute;
  inset: 35% 0 0;
  background: linear-gradient(transparent, rgba(5, 4, 3, 0.9));
  pointer-events: none;
  z-index: 1;
}

.scene-caption {
  position: absolute;
  inset: auto 16px 14px;
  z-index: 3;
}

.monster-art {
  position: absolute;
  z-index: 2;
  right: 5%;
  bottom: 0;
  width: min(42%, 360px);
  height: 92%;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.72));
}

.scene-stage.strong-enemy .monster-art {
  filter:
    drop-shadow(0 18px 24px rgba(0, 0, 0, 0.72))
    drop-shadow(0 0 18px rgba(159, 79, 46, 0.72));
}

.asset-failed .scene-art,
.asset-failed .monster-art,
.asset-failed .potion-art {
  display: none;
}
```

Add mobile rules:

```css
@media (max-width: 620px) {
  .scene-stage,
  .scene-stage.compact {
    aspect-ratio: 4 / 3;
  }

  .monster-art {
    right: 16%;
    width: 68%;
    height: 84%;
  }

  .scene-caption {
    inset: auto 12px 10px;
  }
}
```

- [ ] **Step 2: Verify styles do not create overflow**

Run the existing 360px browser overflow checks.

Expected: no horizontal overflow and no clipped controls.

## Task 7: Integrate Visuals Into Screens

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`

- [ ] **Step 1: Integrate main and adventure visuals**

At the beginning of `renderMain()` and `renderAdventure()`, insert:

```javascript
${renderSceneStage({
  scene: currentSceneAsset(),
  location: currentStage().name,
  status: state.story.status
})}
```

Keep all existing text and controls below the stage.

- [ ] **Step 2: Integrate combat visuals**

In the live-monster branch of `renderCombat()`, insert:

```javascript
${renderSceneStage({
  scene: currentSceneAsset(),
  location: currentStage().name,
  status: "战斗中",
  monster
})}
```

Preserve combat stat panels, controls, and log below it.

- [ ] **Step 3: Integrate shop, inventory, and profile visuals**

Shop:

```javascript
${renderSceneStage({
  scene: SHOP_SCENE_ASSET,
  location: "黑烛商店",
  status: "灰烬村"
})}
```

Replace potion emoji with:

```javascript
${renderPotionImage("potion-art")}
```

Inventory uses the same potion helper.

Profile uses:

```javascript
${renderSceneStage({
  scene: currentSceneAsset(),
  location: currentStage().name,
  status: state.story.status,
  compact: true
})}
```

- [ ] **Step 4: Verify screen rendering**

Run the browser smoke test and manually inspect:

- Main visual.
- Adventure visual.
- Combat visual with monster.
- Shop visual and potion.
- Inventory potion.
- Profile compact banner.

Expected: all visuals load without changing gameplay results.

## Task 8: Expand Browser And Asset Verification

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/tests/browser-smoke.js`
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/tests/verify-assets.js`

- [ ] **Step 1: Add asset filesystem verification**

Create `tests/verify-assets.js`:

```javascript
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "assets/images/asset-manifest.json"), "utf8"));
const paths = [
  ...manifest.scenes,
  ...Object.values(manifest.monsters),
  manifest.shop,
  manifest.potion
];

if (paths.length !== 14 || new Set(paths).size !== 14) {
  throw new Error("asset manifest must contain 14 unique assets");
}

for (const asset of paths) {
  const absolute = path.join(root, "assets/images", asset);
  const stat = fs.statSync(absolute);
  if (stat.size < 4096) throw new Error(`asset too small: ${asset}`);
}

console.log("asset verification: PASS");
```

- [ ] **Step 2: Add browser visual assertions**

Extend `tests/browser-smoke.js`:

- Assert `.scene-stage img.scene-art` has `naturalWidth > 0`.
- Enter combat for all eight monster names by assigning controlled monsters and rendering; assert `.monster-art` has `naturalWidth > 0`.
- Assert strong enemy class and marker.
- Assert shop and inventory potion images have `naturalWidth > 0`.
- Temporarily set a bad scene path, trigger `error`, and verify controls remain usable.
- Preserve existing gameplay assertions.
- Capture:
  - `artifacts/visual-rpg-desktop.png`
  - `artifacts/visual-rpg-mobile.png`
  - `artifacts/visual-rpg-combat.png`

- [ ] **Step 3: Run all verification**

Run:

```powershell
node tests/verify-assets.js
node tests/browser-smoke.js
```

Expected:

```text
asset verification: PASS
browser smoke: PASS
```

- [ ] **Step 4: Inspect screenshots**

Use the image viewer to verify:

- Art is visible and not uniformly dark.
- Monster transparency has no obvious green fringe.
- Labels and controls do not overlap art.
- Mobile composition retains the primary focal point.

## Task 9: Final Cleanup And Requirement Audit

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html` only if verification finds issues.
- Delete: temporary chroma source files under `F:/Desktop/RPG/GPT 5.5 Codex/tmp/imagegen/` after successful final verification.

- [ ] **Step 1: Run inline JavaScript syntax check**

Run:

```powershell
node -e "const fs=require('fs'),vm=require('vm');const h=fs.readFileSync('index.html','utf8');new vm.Script(h.slice(h.indexOf('<script>')+8,h.lastIndexOf('</script>')));console.log('inline script syntax: OK')"
```

Expected: `inline script syntax: OK`.

- [ ] **Step 2: Confirm no remote image dependencies**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'https?://','<script[^>]+src=','<link[^>]+href='
```

Expected: no matches.

- [ ] **Step 3: Audit all 14 assets**

Run:

```powershell
Get-ChildItem 'assets/images' -File | Select-Object Name,Length
```

Expected: manifest plus 14 final WebP assets.

- [ ] **Step 4: Remove temporary chroma sources**

After all verification passes:

```powershell
Get-ChildItem 'tmp/imagegen' -File | Remove-Item
```

Before removal, verify every resolved absolute path is inside:

```text
F:/Desktop/RPG/GPT 5.5 Codex/tmp/imagegen/
```

- [ ] **Step 5: Record Git state**

Run:

```powershell
git status --short
```

Expected: this workspace reports that it is not a Git repository. Do not initialize Git unless the user explicitly requests it.

## Plan Self-Review

- Spec coverage: Tasks cover all 14 assets, built-in generation, chroma removal, local project storage, stage mapping, monster/potion rendering, failure handling, responsive behavior, accessibility, performance checks, and browser verification.
- Marker scan: No unresolved marker text or unspecified implementation step remains.
- Type consistency: `sceneAssets`, `monsterAssets`, `SHOP_SCENE_ASSET`, `POTION_ASSET`, `currentSceneAsset`, `monsterAsset`, `renderSceneStage`, and `renderPotionImage` are used consistently.
- Scope: The plan upgrades presentation only and does not alter RPG rules, progression, rewards, combat calculations, or shop behavior.

