# Dark Dungeon Visual Upgrade Design

## Goal

Upgrade the existing browser text RPG, **黑烛地牢**, into an illustrated dark-fantasy adventure while preserving its current story, combat, shop, inventory, progression, and direct-browser execution.

The upgrade must use original generated digital assets created specifically for this project. It must not rely on stock imagery, remote URLs, third-party game art, or external runtime dependencies.

## Approved Direction

Use a **dark hand-painted illustration** style and a **scene-stage layout**.

The active location appears as a prominent wide illustration inside the playable interface. Narrative text and choices remain below the stage. During combat, the current environment remains visible and the monster illustration appears inside the stage with combat information. This adds visual presence without turning the game into a landing page or reducing text readability.

## Asset Package

Generate and store 14 original project assets under `assets/images/`.

### Scene Illustrations

Wide dark-fantasy environment paintings:

1. `scene-ash-village.webp`
   - 灰烬村入口
   - Abandoned village gate, sealed well, black wax marks, dying lanterns.

2. `scene-rotten-forest.webp`
   - 腐烂森林
   - Twisted wet trees, candle stubs, bone charms, narrow path into fog.

3. `scene-damp-cave.webp`
   - 潮湿洞穴
   - Wet stone tunnel, hanging chains, shallow water, distant amber light.

4. `scene-old-king-tomb.webp`
   - 旧王墓穴
   - Monumental burial chamber, cracked royal statues, black candle altar.

Scene requirements:

- Landscape composition suitable for a responsive `16:7` stage.
- Main focal point remains near the center so mobile cropping preserves it.
- No text, logos, UI, borders, watermark, or recognizable copyrighted character.
- Brightness must support visible scene inspection; avoid uniformly black artwork.
- Palette: charcoal stone, rust red, tarnished gold, bone neutral, cold moss, steel blue.

### Monster Illustrations

Portrait-oriented isolated character paintings:

1. `monster-slime.webp`
2. `monster-goblin.webp`
3. `monster-skeleton.webp`
4. `monster-wolf.webp`
5. `monster-shadow-beast.webp`
6. `monster-flesh-guard.webp`
7. `monster-tomb-hunter.webp`
8. `monster-black-candle-cultist.webp`

Monster requirements:

- Full or three-quarter body.
- Centered composition with generous edge padding.
- Each monster must have a distinct silhouette.
- Dark hand-painted bestiary style matching the scene illustrations.
- Use a perfectly flat chroma-key background during generation, then remove it locally.
- Final project files must contain alpha transparency.
- No cast shadow, floor plane, text, border, logo, or watermark.

### Shop And Item Assets

1. `scene-black-candle-shop.webp`
   - Interior of a hidden village apothecary.
   - Shelves, old bottles, black candles, merchant counter, warm localized light.
   - Landscape composition matching the stage format.

2. `item-black-candle-potion.webp`
   - Distinctive dark-red potion in a worn glass vial with black wax seal.
   - Centered item illustration with alpha transparency.
   - Readable at 48px and 96px sizes.

## Image Generation Workflow

Use the built-in `image_gen` tool for all assets.

For scene and shop images:

- Generate the final illustration normally.
- Copy the selected output into `assets/images/`.
- Convert to WebP when useful without visibly degrading the image.

For monsters and potion:

1. Generate on a perfectly flat chroma-key background.
2. Copy the generated source into a workspace temporary asset directory.
3. Run the installed `remove_chroma_key.py` helper with soft matte and despill.
4. Verify alpha channel, transparent corners, subject coverage, and absence of key-color fringe.
5. Save the final transparent asset under `assets/images/`.

The generation process must not leave project-referenced images only under the Codex generated-image directory.

## Scene Stage

Add a reusable scene stage to the active content panel.

The stage contains:

- Current environment image.
- Location name and short state label.
- Subtle bottom readability scrim.
- Optional story indicator or danger label.
- Combat monster layer when a monster is active.

Layout rules:

- Desktop aspect ratio: approximately `16 / 7`.
- Mobile aspect ratio: approximately `4 / 3`.
- Use `object-fit: cover`.
- Set a stable container size so loading or changing art does not shift the layout.
- Center the image focal point.
- Provide a dark CSS fallback while the image loads or if an asset fails.
- Do not place the stage inside an additional decorative card.

## Screen Integration

### Main Screen

- Show the current story-stage illustration.
- Keep beginner guidance and primary actions below the stage.
- The brand remains compact at the top.

### Adventure Screen

- Show the illustration associated with `state.story.stage`.
- Update the stage automatically when story progression changes.
- Display current location and status over the lower portion of the image.
- Keep narrative copy and choices below the image.

### Combat Screen

- Keep the current environment as the stage background.
- Render the active monster illustration in the foreground.
- Monster art occupies the right or central-right portion on desktop.
- On mobile, center the monster and reduce its maximum height.
- Strong monsters receive a restrained red-gold aura and a visible `强敌` marker.
- Player and monster numerical combat panels remain below the stage.
- Never allow the monster illustration to cover stage labels or combat controls.

### Shop Screen

- Show `scene-black-candle-shop.webp` as the stage.
- Show the generated potion asset in the merchandise row.
- Preserve the existing price, affordability, purchase button, and insufficient-gold message.

### Inventory Screen

- Replace the emoji potion presentation with the generated potion image.
- Keep potion count, healing range, HP, and use button.

### Profile Screen

- Show the current story-stage image in a shorter profile banner.
- Preserve all required player information fields.

## Asset Mapping

Add explicit JavaScript mappings:

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
```

Use the base monster name for asset lookup. Strong-monster naming or labels must not break the mapping.

## Rendering Boundaries

Add focused helpers:

- `currentSceneAsset()`: returns the safe scene image for the current story stage.
- `monsterAsset(name)`: returns the matching transparent monster art or a CSS fallback.
- `renderSceneStage(options)`: renders environment, labels, and optional monster layer.
- `renderPotionImage(className)`: renders the potion asset consistently.

The helpers must escape user-facing text and must not mutate game state.

## Loading And Failure Handling

- Images use local relative paths.
- Use `loading="eager"` for the active scene and combat monster.
- Use `decoding="async"` where appropriate.
- Add `onerror` handling that hides the failed image and reveals a CSS fallback.
- A missing asset must not prevent gameplay.
- Buttons and text remain usable before images finish loading.

## Responsive Behavior

Desktop:

- Stage spans the active content width.
- Monster art maximum height approximately 90% of the stage.
- Text and controls remain below the visual.

Tablet:

- Stage remains wide but labels use reduced padding.
- Monster art remains centered-right.

Mobile at 360px:

- Stage switches to a taller aspect ratio.
- Scene is cropped with `object-position: center`.
- Monster art is centered and no wider than 68% of the stage.
- Location label and danger marker wrap without overlapping.
- No horizontal scrolling.

## Accessibility

- Decorative scene images use empty alt text.
- Monster images use alt text containing the monster name.
- Potion images use alt text `黑烛药剂`.
- Visual information that affects gameplay remains duplicated in text.
- Scene art does not replace headings, HP values, controls, or logs.
- Respect existing focus and reduced-motion styles.

## Performance

- Prefer WebP output.
- Target scene assets below roughly 700 KB each when practical.
- Target transparent monster assets below roughly 500 KB each when practical.
- Do not preload all images. Only active-screen images should load eagerly.
- Retain direct `file://` browser execution.

## Verification

Static checks:

- All 14 final assets exist under `assets/images/`.
- All image paths referenced in `index.html` exist.
- No remote image URLs are present.
- Inline JavaScript compiles.

Browser checks:

- Main and adventure scenes change with story stage.
- Every generated monster name maps to a visible monster image.
- Strong monster art and marker render without overlap.
- Shop and inventory use the generated potion image.
- Missing-image fallback leaves controls usable.
- Desktop and 360px mobile layouts have no horizontal overflow.
- No browser console errors.
- Existing purchase, potion, combat, flee, profile, and progression smoke tests still pass.

Visual inspection:

- Scene artwork is visible rather than excessively dark.
- Monster edges do not show chroma-key fringe.
- Scene and monster styles feel consistent.
- Text remains readable over every stage.
- No illustration covers required controls or game information.

