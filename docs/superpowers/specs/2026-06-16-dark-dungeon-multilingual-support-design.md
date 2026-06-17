# Dark Dungeon Multilingual Support Design

## Goal

Add full multilingual support to the browser RPG with Traditional Chinese as the default language and English as the second language. The game must remain directly openable from `index.html` without a build step or server.

## Scope

The feature covers the complete visible game experience:

- Top bar, navigation, stat labels, audio controls, and language controls.
- Main, adventure, combat, shop, profile, and inventory screens.
- Stage names, stage descriptions, story status, branch prompts, guide text, item names, and monster names.
- Gameplay logs, combat logs, level-up messages, purchase failures, potion use, victory, defeat, flee, exploration, discovery, and audio failure messages.
- Accessibility labels used by controls and tests.
- Persistence of the selected language across page reloads.

The feature does not change combat math, rewards, generated assets, audio routing, image assets, or save-game mechanics. Existing assets stay local.

## Approach

Use an in-file dictionary because the project is a single static HTML file and must continue to run from `file://`.

Add:

- `LANGUAGE_KEY = "black-candle-language-v1"`.
- `DEFAULT_LANGUAGE = "zhHant"`.
- `LANGUAGES = { zhHant: "繁體中文", en: "English" }`.
- `I18N.zhHant` and `I18N.en` dictionaries.
- `currentLanguage`, loaded from `localStorage` and sanitized to a supported language.
- `t(key, params = {})`, which reads the active dictionary, falls back to Traditional Chinese, and interpolates `{name}` style placeholders.
- `setLanguage(language)`, which saves the setting and re-renders.

All new language data stays in `index.html` to preserve direct browser opening.

## Text Model

Use stable IDs for game data instead of storing display text as state where practical.

- Monsters use IDs such as `slime`, `goblin`, `skeleton`, `wolf`, `shadowBeast`, `fleshGuard`, `tombHunter`, and `blackCandleCultist`.
- Stages use IDs/indexes and translate `name`, `description`, and `status`.
- Screen keys remain `main`, `adventure`, `combat`, `shop`, `profile`, and `inventory`.
- Logs are generated in the active language at the moment the event occurs.

Existing state can keep current story progress and combat state. When the language changes, static screen labels update immediately. Historical logs may remain in the language in which they were created unless they are derived from current state during render. New logs after switching language must use the selected language.

## UI

Add a compact language selector next to audio controls in the top bar:

```html
<label class="language-control">
  <span>語言</span>
  <select aria-label="語言" onchange="setLanguage(this.value)">
    <option value="zhHant">繁體中文</option>
    <option value="en">English</option>
  </select>
</label>
```

In English mode, labels become `Language`, `Traditional Chinese`, and `English`.

The selector must:

- Fit at 360 px viewport width without horizontal overflow.
- Preserve focus across render like buttons and range inputs.
- Persist through reload.

## Translation Quality

Traditional Chinese should not contain Simplified Chinese UI wording. Use natural Traditional Chinese terms:

- `主畫面`
- `劇情冒險`
- `戰鬥`
- `商店`
- `個人資訊`
- `背包`
- `藥劑`
- `金幣`
- `生命`

English should be complete and playable, not placeholder text. Tone should match the dark dungeon theme:

- `Black Candle Dungeon`
- `Ashen Village Gate`
- `Rotten Forest`
- `Damp Cave`
- `Old King's Tomb`
- `Black Candle Potion`

## Testing

Extend `tests/browser-smoke.js`:

- Assert the default document language and UI are Traditional Chinese on first load.
- Assert Simplified-only labels such as `开始冒险`, `商店界面`, and `使用药品` are no longer required by tests.
- Assert the language selector exists and defaults to `zhHant`.
- Switch to English and assert:
  - Title/heading becomes `Black Candle Dungeon`.
  - Navigation includes `Adventure`, `Shop`, `Profile`, and `Inventory`.
  - Shop heading and potion text are English.
  - Combat heading, player labels, monster labels, and combat buttons are English.
  - Profile labels are English.
  - Inventory labels are English.
  - Audio control labels are English.
  - Generated logs after the switch are English.
- Reload and assert English persists.
- Write an invalid saved language, reload, and assert it falls back to Traditional Chinese.
- Keep existing visual, audio, asset, failure, and mobile overflow assertions passing.

## Error Handling

- Unsupported saved language falls back to `zhHant`.
- Missing translation keys fall back to Traditional Chinese.
- Missing interpolation values render as an empty string rather than throwing.
- Language switching must not interrupt combat or mutate player stats.

## Constraints

- No external i18n package.
- No network resources.
- No build step.
- No JSON fetch that would break direct `file://` opening.
- Keep generated image and audio assets unchanged.
- Preserve existing combat formula: `Math.max(1, attack - defense)`.

## Self-Review

- Placeholder scan: no `TBD`, `TODO`, or unspecified translation scope remains.
- Consistency check: the approach keeps all language data in `index.html`, matching the direct-open constraint.
- Scope check: the feature is one subsystem, limited to localization and tests.
- Ambiguity check: historical logs are allowed to remain in their original language, but new logs after switching language must use the selected language.
