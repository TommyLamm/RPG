# Dark Dungeon Multilingual Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete Traditional Chinese and English language support to the static RPG, defaulting to Traditional Chinese.

**Architecture:** Keep localization in `index.html` so the game still opens directly from `file://`. Add a small dictionary-based i18n runtime with persisted language selection, then route static UI text, stage data, monster names, and dynamic gameplay logs through translation keys. Browser smoke tests verify default Traditional Chinese, English switching, persistence, fallback, and existing gameplay/audio behavior.

**Tech Stack:** Static HTML/CSS/JavaScript, `localStorage`, Playwright browser smoke tests, existing Node test scripts.

---

## File Map

- Modify `index.html`: add dictionaries, translation helpers, language selector, localized render output, localized logs, localized monster/stage names.
- Modify `tests/browser-smoke.js`: update text selectors from Simplified Chinese to Traditional Chinese, add language-switching and English assertions, keep audio/visual checks.
- Verify `package.json`: no script changes expected.

The workspace is not a Git repository, so commit steps are omitted.

## Task 1: Add Failing Browser Tests For Default Traditional Chinese

**Files:**
- Modify: `tests/browser-smoke.js`

- [ ] **Step 1: Replace the initial Simplified Chinese heading assertion**

Change the first heading assertion from:

```javascript
await page.getByRole("heading", { name: "黑烛地牢" }).waitFor();
```

to:

```javascript
await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
```

- [ ] **Step 2: Add default language assertions after first load**

Insert after the heading wait:

```javascript
const languageApi = await page.evaluate(() => ({
  language: typeof currentLanguage === "string" ? currentLanguage : null,
  htmlLang: document.documentElement.lang,
  selectorValue: document.querySelector("[data-language-select]")?.value || null
}));
assert(languageApi.language === "zhHant", "default language state is not Traditional Chinese");
assert(languageApi.htmlLang === "zh-Hant", "document language is not zh-Hant by default");
assert(languageApi.selectorValue === "zhHant", "language selector does not default to Traditional Chinese");
```

- [ ] **Step 3: Update core Traditional Chinese selectors**

Update representative selectors:

```javascript
await page.getByText("新手指南", { exact: false }).isVisible();
await page.getByRole("button", { name: "開始冒險" }).click();
await page.getByRole("button", { name: "返回休息" }).click();
await page.getByRole("button", { name: "商店", exact: true }).click();
await page.getByRole("heading", { name: "商店介面" }).isVisible();
await page.getByRole("button", { name: "購買" }).click();
await page.getByRole("button", { name: "背包" }).click();
await page.getByRole("heading", { name: "背包或道具使用介面" }).isVisible();
await page.getByRole("button", { name: "使用藥劑" }).click();
await page.getByRole("heading", { name: "戰鬥介面" }).isVisible();
await page.getByRole("button", { name: "攻擊", exact: true }).click();
await page.getByRole("button", { name: "逃跑" }).click();
await page.getByRole("button", { name: "個人資訊", exact: true }).click();
await page.getByLabel("音樂音量").fill("0.25");
await page.getByLabel("音效音量").fill("0.55");
await page.getByRole("button", { name: "靜音" }).click();
```

Keep existing state and asset assertions unchanged.

- [ ] **Step 4: Run the browser test and confirm RED**

Run:

```powershell
$env:NODE_PATH='C:\Users\lamyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\lamyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules'
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
& 'C:\Users\lamyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tests\browser-smoke.js
```

Expected: FAIL because the game still renders Simplified Chinese and has no `currentLanguage` / language selector.

## Task 2: Add The i18n Runtime And Language Selector

**Files:**
- Modify: `index.html`
- Modify: `tests/browser-smoke.js`

- [ ] **Step 1: Add constants and dictionaries near existing asset constants**

Add:

```javascript
const LANGUAGE_KEY = "black-candle-language-v1";
const DEFAULT_LANGUAGE = "zhHant";
const LANGUAGES = {
  zhHant: { label: "繁體中文", htmlLang: "zh-Hant" },
  en: { label: "English", htmlLang: "en" }
};
const I18N = {
  zhHant: {
    gameTitle: "黑燭地牢",
    gameSubtitle: "黑蠟封住村門，墓穴深處仍有燭火。",
    language: "語言",
    languageZhHant: "繁體中文",
    languageEn: "English",
    screens: {
      main: "主畫面",
      adventure: "劇情冒險",
      combat: "戰鬥",
      shop: "商店",
      profile: "個人資訊",
      inventory: "背包"
    }
  },
  en: {
    gameTitle: "Black Candle Dungeon",
    gameSubtitle: "Black wax seals the village gate, and candles still burn below the tomb.",
    language: "Language",
    languageZhHant: "Traditional Chinese",
    languageEn: "English",
    screens: {
      main: "Main",
      adventure: "Adventure",
      combat: "Combat",
      shop: "Shop",
      profile: "Profile",
      inventory: "Inventory"
    }
  }
};
```

Later tasks will expand the dictionaries. This task only adds enough to render the shell.

- [ ] **Step 2: Add language helpers after `clamp()`**

Add:

```javascript
function sanitizeLanguage(language) {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, language) ? language : DEFAULT_LANGUAGE;
}

let currentLanguage = sanitizeLanguage(localStorage.getItem(LANGUAGE_KEY));
document.documentElement.lang = LANGUAGES[currentLanguage].htmlLang;

function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (
    params[key] === undefined || params[key] === null ? "" : String(params[key])
  ));
}

function t(key, params = {}) {
  const parts = key.split(".");
  let value = I18N[currentLanguage];
  for (const part of parts) value = value?.[part];
  if (value === undefined) {
    value = I18N[DEFAULT_LANGUAGE];
    for (const part of parts) value = value?.[part];
  }
  return interpolate(value === undefined ? key : value, params);
}

function setLanguage(language) {
  const nextLanguage = sanitizeLanguage(language);
  currentLanguage = nextLanguage;
  localStorage.setItem(LANGUAGE_KEY, nextLanguage);
  document.documentElement.lang = LANGUAGES[nextLanguage].htmlLang;
  render();
}
```

- [ ] **Step 3: Add language selector CSS**

Add styles next to `.audio-controls`:

```css
.language-control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: rgba(21, 18, 15, 0.86);
  color: var(--muted);
  padding: 6px 9px;
  font-size: 13px;
  white-space: nowrap;
}

.language-control select {
  min-width: 128px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #100d0b;
  color: var(--text);
  font: inherit;
  padding: 6px 8px;
}
```

Extend focus CSS to include `select:focus-visible`.

- [ ] **Step 4: Render language selector beside audio controls**

Add:

```javascript
function renderLanguageControls() {
  return `
    <label class="language-control">
      <span>${t("language")}</span>
      <select data-language-select aria-label="${t("language")}" onchange="setLanguage(this.value)">
        <option value="zhHant"${currentLanguage === "zhHant" ? " selected" : ""}>${t("languageZhHant")}</option>
        <option value="en"${currentLanguage === "en" ? " selected" : ""}>${t("languageEn")}</option>
      </select>
    </label>
  `;
}
```

Render it in `.topbar-tools` before `renderAudioControls()`.

- [ ] **Step 5: Preserve select focus**

Change the focus preservation selector from:

```javascript
["BUTTON", "INPUT"].includes(document.activeElement.tagName)
```

to:

```javascript
["BUTTON", "INPUT", "SELECT"].includes(document.activeElement.tagName)
```

Update `controlFocusKey()` so `SELECT` controls use `aria-label` and `onchange`.

- [ ] **Step 6: Run browser test and confirm partial GREEN**

Run the browser smoke command from Task 1.

Expected: It still fails on untranslated body labels, but the language API and selector assertions pass.

## Task 3: Localize Static UI And Screen Rendering

**Files:**
- Modify: `index.html`
- Modify: `tests/browser-smoke.js`

- [ ] **Step 1: Expand dictionary for static UI**

Add these keys to `I18N.zhHant` and `I18N.en`:

```javascript
stats: {
  level: "等級",
  hp: "生命",
  exp: "經驗",
  gold: "金幣",
  potions: "藥劑",
  characterStatus: "角色狀態"
},
audio: {
  controls: "聲音控制",
  mute: "靜音",
  unmute: "取消靜音",
  music: "音樂",
  sfx: "音效",
  musicVolume: "音樂音量",
  sfxVolume: "音效音量"
},
common: {
  noCombatRecords: "暫無戰鬥紀錄。",
  logs: "日誌",
  currentStatus: "目前狀態",
  progressedEvents: "已推進事件",
  strongEnemy: "強敵"
},
actions: {
  startAdventure: "開始冒險",
  goShop: "前往商店",
  viewProfile: "查看個人資訊",
  enterForest: "進入森林",
  exploreCave: "探索洞穴",
  goVillage: "前往村莊",
  challengeMonster: "挑戰怪物",
  rest: "返回休息",
  goDeeper: "繼續深入",
  returnAdventure: "返回冒險",
  attack: "攻擊",
  usePotion: "使用藥劑",
  flee: "逃跑",
  buy: "購買"
}
```

Use equivalent English values:

```javascript
stats: { level: "Level", hp: "HP", exp: "EXP", gold: "Gold", potions: "Potions", characterStatus: "Character Status" },
audio: { controls: "Sound Controls", mute: "Mute", unmute: "Unmute", music: "Music", sfx: "SFX", musicVolume: "Music Volume", sfxVolume: "SFX Volume" },
common: { noCombatRecords: "No combat records yet.", logs: "Log", currentStatus: "Current Status", progressedEvents: "Events Advanced", strongEnemy: "Elite" },
actions: { startAdventure: "Start Adventure", goShop: "Go to Shop", viewProfile: "View Profile", enterForest: "Enter Forest", exploreCave: "Explore Cave", goVillage: "Visit Village", challengeMonster: "Challenge Monster", rest: "Rest", goDeeper: "Go Deeper", returnAdventure: "Return to Adventure", attack: "Attack", usePotion: "Use Potion", flee: "Flee", buy: "Buy" }
```

- [ ] **Step 2: Replace shell render functions**

Update:

```javascript
renderStatBar()
renderAudioControls()
renderNav()
renderLogs()
renderMain()
renderAdventure()
renderCombat()
renderShop()
renderProfile()
renderInventory()
```

Use `t(...)` for headings, labels, buttons, aria labels, and static paragraphs.

- [ ] **Step 3: Run browser test and fix remaining static selector failures**

Run the browser smoke command.

Expected: Static UI assertions pass in Traditional Chinese. Dynamic log and monster text may still be Simplified Chinese until Task 4.

## Task 4: Localize Stages, Monsters, Story State, And Dynamic Logs

**Files:**
- Modify: `index.html`
- Modify: `tests/browser-smoke.js`

- [ ] **Step 1: Replace monster names with IDs**

Change:

```javascript
const monsterNames = ["史莱姆", "哥布林", "骷髅兵", "野狼", "暗影兽", "腐肉守卫", "墓穴猎手", "黑烛信徒"];
```

to:

```javascript
const monsterIds = ["slime", "goblin", "skeleton", "wolf", "shadowBeast", "fleshGuard", "tombHunter", "blackCandleCultist"];
```

Add dictionary keys:

```javascript
monsters: {
  slime: "史萊姆",
  goblin: "哥布林",
  skeleton: "骷髏兵",
  wolf: "野狼",
  shadowBeast: "暗影獸",
  fleshGuard: "腐肉守衛",
  tombHunter: "墓穴獵手",
  blackCandleCultist: "黑燭信徒"
}
```

English:

```javascript
monsters: {
  slime: "Slime",
  goblin: "Goblin",
  skeleton: "Skeleton",
  wolf: "Wolf",
  shadowBeast: "Shadow Beast",
  fleshGuard: "Flesh Guard",
  tombHunter: "Tomb Hunter",
  blackCandleCultist: "Black Candle Cultist"
}
```

Update `generateMonster()` to store `monsterId`, and render/log with:

```javascript
function monsterName(monsterOrId) {
  const id = typeof monsterOrId === "string" ? monsterOrId : monsterOrId?.monsterId;
  return t(`monsters.${id || "slime"}`);
}
```

- [ ] **Step 2: Localize stages**

Change stage entries to IDs:

```javascript
const stages = [
  { id: "ashVillage" },
  { id: "rottenForest" },
  { id: "dampCave" },
  { id: "oldKingTomb" }
];
```

Add `stages` dictionary with `name`, `description`, and `status` for each language.

Update `currentStage()` usage to call:

```javascript
function stageText(stageIndex, field) {
  const stage = stages[clamp(stageIndex, 0, stages.length - 1)] || stages[0];
  return t(`stages.${stage.id}.${field}`);
}
```

Store `state.story.statusKey` instead of display text for new state. Initial value is `"ashVillage"`.

- [ ] **Step 3: Localize logs**

Add `logs` and `combatLogs` dictionary sections. Required keys include:

```javascript
logs: {
  initialGuide: "...",
  fullHpRest: "...",
  restRecover: "...",
  forestUnlocked: "...",
  caveUnlocked: "...",
  tombUnlocked: "...",
  gainGold: "...",
  gainPotion: "...",
  caveBlocked: "...",
  deepBlocked: "...",
  specialKingSigil: "...",
  specialCaveCode: "...",
  distantBell: "...",
  victory: "...",
  defeat: "...",
  fleeSuccess: "...",
  levelUp: "...",
  cannotAfford: "...",
  purchasePotion: "...",
  invalidPotionContext: "...",
  noActiveCombatPotion: "...",
  inventoryBlockedByCombat: "...",
  noPotion: "...",
  hpFullNoPotion: "...",
  usePotion: "...",
  audioFailure: "..."
},
combatLogs: {
  combatLocked: "...",
  enemyApproaches: "...",
  combatEnded: "...",
  playerAttack: "...",
  monsterCounter: "...",
  victory: "...",
  defeat: "...",
  noEnemy: "...",
  fleeSuccess: "...",
  fleeFail: "..."
}
```

Refactor all `addLog("...")` and `addCombatLog("...")` calls to use `t(...)` with params.

- [ ] **Step 4: Update monster asset lookup**

Change `monsterAsset(name)` to `monsterAsset(monster)` and resolve by `monster.monsterId`. Keep backwards compatibility for tests that manually set `name` by mapping existing Chinese names and English names to IDs.

- [ ] **Step 5: Run browser test and fix dynamic failures**

Run the browser smoke command.

Expected: Traditional Chinese test path passes for UI, logs, combat, monster assets, and audio routes.

## Task 5: Add English Switching, Persistence, And Fallback Tests

**Files:**
- Modify: `tests/browser-smoke.js`
- Modify: `index.html`

- [ ] **Step 1: Add English switch assertions**

After the default Traditional Chinese path has loaded and before deep gameplay mutation, add a focused English block:

```javascript
await page.getByLabel("語言").selectOption("en");
await page.getByRole("heading", { name: "Black Candle Dungeon" }).waitFor();
assert(await page.getByRole("button", { name: "Adventure", exact: true }).isVisible(), "English adventure nav missing");
assert(await page.getByRole("button", { name: "Shop", exact: true }).isVisible(), "English shop nav missing");
await page.getByRole("button", { name: "Shop", exact: true }).click();
assert(await page.getByRole("heading", { name: "Shop" }).isVisible(), "English shop heading missing");
assert(await page.getByText("Black Candle Potion", { exact: false }).isVisible(), "English potion text missing");
await page.getByRole("button", { name: "Inventory", exact: true }).click();
assert(await page.getByRole("heading", { name: "Inventory" }).isVisible(), "English inventory heading missing");
await page.evaluate(() => {
  state.player.hp = state.player.maxHp;
  state.player.potions = 1;
  startCombat(false, "smoke");
});
assert(await page.getByRole("heading", { name: "Combat" }).isVisible(), "English combat heading missing");
assert(await page.getByRole("button", { name: "Attack", exact: true }).isVisible(), "English attack button missing");
await page.getByRole("button", { name: "Attack", exact: true }).click();
assert(await page.getByText("You attack", { exact: false }).isVisible(), "English combat log missing");
```

- [ ] **Step 2: Add English reload persistence assertion**

Add:

```javascript
await page.reload();
await page.waitForLoadState("load");
await page.getByRole("heading", { name: "Black Candle Dungeon" }).waitFor();
assert(await page.getByLabel("Language").inputValue() === "en", "English language did not persist after reload");
```

- [ ] **Step 3: Add invalid language fallback assertion**

Add:

```javascript
await page.evaluate(() => localStorage.setItem("black-candle-language-v1", "invalid-language"));
await page.reload();
await page.waitForLoadState("load");
await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
assert(await page.getByLabel("語言").inputValue() === "zhHant", "invalid language did not fall back to Traditional Chinese");
```

- [ ] **Step 4: Keep the rest of the smoke flow deterministic**

If the English block mutates state too much for existing Traditional Chinese assertions, isolate it by reloading and resetting language to `zhHant` before the existing long gameplay path:

```javascript
await page.evaluate(() => localStorage.setItem("black-candle-language-v1", "zhHant"));
await page.reload();
await page.waitForLoadState("load");
await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
```

- [ ] **Step 5: Run browser test**

Run the browser smoke command.

Expected: PASS.

## Task 6: Final Verification And Review

**Files:**
- Verify: `index.html`
- Verify: `tests/browser-smoke.js`
- Verify: `package.json`

- [ ] **Step 1: Run syntax checks**

Run:

```powershell
node --check tests\browser-smoke.js
```

Expected: exit code 0.

- [ ] **Step 2: Run complete test suite**

Run:

```powershell
$env:NODE_PATH='C:\Users\lamyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules;C:\Users\lamyu\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\node_modules'
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm test
```

Expected:

```text
asset verification: PASS
audio verification: PASS (17 files)
audio generation verification: PASS (17 files, committed hashes match)
browser smoke: PASS
```

- [ ] **Step 3: Check constraints**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'https?://|autoplay|Math.max\(1, attack - defense\)'
```

Expected:

- No remote asset URLs.
- No autoplay attribute.
- Damage formula remains `Math.max(1, attack - defense)`.

- [ ] **Step 4: Request code review**

Ask a fresh reviewer to check:

- Default language is Traditional Chinese.
- English coverage is complete for UI, stages, monsters, and new logs.
- Language persistence and fallback are correct.
- No combat, audio, or asset behavior regressed.

Fix Critical/High/Medium findings, rerun `npm test`, and request re-review until approved.

## Plan Self-Review

- Spec coverage: Tasks cover dictionary runtime, selector UI, default Traditional Chinese, full English coverage, persistence, fallback, and testing.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: language keys are consistently `zhHant` and `en`; persisted key is consistently `black-candle-language-v1`.
- Scope check: the plan only touches localization and tests; generated assets and game math are explicitly out of scope.
