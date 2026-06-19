const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const gameUrl = pathToFileURL(path.join(root, "index.html")).href;
const artifactDir = path.join(root, "artifacts");
fs.mkdirSync(artifactDir, { recursive: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function state(page) {
  return page.evaluate(() => ({
    player: { ...state.player },
    story: { ...state.story },
    screen: state.activeScreen,
    monster: state.currentMonster ? { ...state.currentMonster } : null,
    combatLogs: state.combatLogs.map(formatLogEntry),
    logs: state.logs.map(formatLogEntry)
  }));
}

async function assertImageLoaded(locator, message) {
  await locator.waitFor({ state: "visible" });
  const loaded = await locator.evaluate(image => (
    image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
  ));
  assert(loaded, message);
}

async function audioPlays(page) {
  return page.evaluate(() => window.__audioProbe.plays.map(play => ({ ...play })));
}

async function assertAudioPlayed(page, fileName, message) {
  const plays = await audioPlays(page);
  assert(plays.some(play => play.src.includes(fileName)), `${message}: ${JSON.stringify(plays)}`);
}

async function resetAudioProbe(page) {
  await page.evaluate(() => window.__audioProbe.reset());
}

async function waitForCombatIdle(page) {
  await page.waitForFunction(() => !state.combatAnimation && !state.combatResolution);
}

async function setCombatFixture(page, { monster, player = {}, randomValue = 0.99 }) {
  await page.evaluate(({ monster, player, randomValue }) => {
    Math.random = () => randomValue;
    Object.assign(state.player, {
      maxHp: 30,
      hp: 30,
      attack: 10,
      defense: 3,
      potions: 0,
      effects: {},
      relics: [],
      relicStates: {},
      ...player
    });
    state.currentMonster = {
      monsterId: monster.monsterId,
      name: monster.name || (monster.monsterId ? t(`monsters.${monster.monsterId}`) : "測試怪物"),
      maxHp: 30,
      hp: 30,
      attack: 5,
      defense: 1,
      ability: monster.ability || monster.monsterId,
      statusEffects: {},
      strong: false,
      source: "smoke",
      ...monster
    };
    state.combatLogs = [];
    state.activeScreen = "combat";
    render();
  }, { monster, player, randomValue });
}

(async () => {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {})
    });

  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.addInitScript(() => {
    window.__audioProbe = {
      plays: [],
      failures: [],
      rejectSources: [],
      reset() {
        this.plays = [];
        this.failures = [];
        this.rejectSources = [];
      }
    };
    HTMLMediaElement.prototype.play = function playStub() {
      const src = this.src || this.currentSrc || "";
      window.__audioProbe.plays.push({
        src,
        volume: this.volume,
        muted: this.muted,
        loop: this.loop
      });
      if (window.__audioProbe.rejectSources.some(fragment => src.includes(fragment))) {
        const error = new Error(`stubbed media failure: ${src}`);
        window.__audioProbe.failures.push(src);
        return Promise.reject(error);
      }
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pauseStub() {};
  });

  await page.goto(gameUrl);
  await page.waitForLoadState("load");
  await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
  await page.evaluate(() => {
    localStorage.removeItem("black-candle-save-v1");
    readSavePayload();
    render();
  });
  const languageApi = await page.evaluate(() => ({
    language: typeof currentLanguage === "string" ? currentLanguage : null,
    htmlLang: document.documentElement.lang,
    selectorValue: document.querySelector("[data-language-select]")?.value || null
  }));
  assert(languageApi.language === "zhHant", "default language state is not Traditional Chinese");
  assert(languageApi.htmlLang === "zh-Hant", "document language is not zh-Hant by default");
  assert(languageApi.selectorValue === "zhHant", "language selector does not default to Traditional Chinese");

  await page.evaluate(() => {
    state.player.hp = state.player.maxHp;
    startCombat(false, "language-switch");
  });
  await page.getByLabel("語言").selectOption("en");
  await page.getByRole("heading", { name: "Black Candle Dungeon" }).waitFor();
  assert(await page.getByText("New player guide", { exact: false }).isVisible(), "existing story log did not re-localize to English");
  assert(await page.getByText("advances from the shadows", { exact: false }).isVisible(), "existing combat log did not re-localize to English");
  await page.evaluate(() => {
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "main";
    render();
  });
  await page.evaluate(() => {
    currentLanguage = "zhHant";
    document.documentElement.lang = "zh-Hant";
    state.story.stage = 3;
    state.story.progress = 0;
    advanceStory("煙測推進洞穴入口。");
    render();
  });
  assert(await page.locator(".log-panel").getByText("煙測推進洞穴入口。", { exact: false }).isVisible(), "literal legacy story log was not preserved");
  assert(!(await page.locator(".log-panel").getByText("logs.煙測推進洞穴入口。", { exact: false }).isVisible()), "literal legacy story log rendered as a missing translation key");
  await page.getByLabel("語言").selectOption("en");
  assert(await page.locator(".log-panel").getByText("煙測推進洞穴入口。", { exact: false }).isVisible(), "literal legacy story log should remain literal after language switch");
  let englishLanguageApi = await page.evaluate(() => ({
    language: typeof currentLanguage === "string" ? currentLanguage : null,
    htmlLang: document.documentElement.lang,
    selectorValue: document.querySelector("[data-language-select]")?.value || null
  }));
  assert(englishLanguageApi.language === "en", "language state did not switch to English");
  assert(englishLanguageApi.htmlLang === "en", "document language did not switch to en");
  assert(englishLanguageApi.selectorValue === "en", "language selector did not switch to English");
  for (const label of ["Adventure", "Shop", "Profile", "Inventory"]) {
    assert(await page.getByRole("button", { name: label, exact: true }).isVisible(), `English nav button missing: ${label}`);
  }
  await page.getByRole("button", { name: "Shop", exact: true }).click();
  assert(await page.getByRole("heading", { name: /^(Shop|Shop Interface)$/ }).isVisible(), "English shop did not open");
  assert(await page.getByText("Black Candle Potion", { exact: false }).isVisible(), "English shop potion is missing");
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  assert(await page.getByRole("heading", { name: "Inventory or item use" }).isVisible(), "English inventory did not open");
  assert(await page.getByRole("button", { name: "Use potion" }).isDisabled(), "English full-HP inventory potion should be disabled");
  await page.evaluate(() => {
    Math.random = () => 0;
    state.player.hp = state.player.maxHp;
    state.player.attack = 10;
    state.player.defense = 3;
    state.player.potions = 1;
    state.currentMonster = null;
    startCombat(false, "smoke");
  });
  assert(await page.getByRole("heading", { name: "Combat", exact: true }).isVisible(), "English combat did not open");
  assert(await page.getByRole("button", { name: "Attack", exact: true }).isVisible(), "English attack button is missing");
  await page.getByRole("button", { name: "Attack", exact: true }).click();
  await page.waitForFunction(() => state.combatLogs.map(formatLogEntry).some(item => item.includes("counters")));
  const englishCombatLogs = await page.evaluate(() => state.combatLogs.map(formatLogEntry));
  const englishAttackIndex = englishCombatLogs.findIndex(item => item.startsWith("You attack"));
  const englishCounterIndex = englishCombatLogs.findIndex(item => item.includes("counters"));
  assert(englishAttackIndex >= 0 && englishCounterIndex > englishAttackIndex, "English combat log is not chronological");
  assert(await page.getByLabel("Music volume").isVisible(), "English music volume label is missing");
  assert(await page.getByLabel("SFX volume").isVisible(), "English SFX volume label is missing");
  assert(await page.getByRole("button", { name: /^(Mute|Unmute)$/ }).isVisible(), "English mute control label is missing");

  await page.reload();
  await page.waitForLoadState("load");
  await page.getByRole("heading", { name: "Black Candle Dungeon" }).waitFor();
  englishLanguageApi = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    selectorValue: document.querySelector("[data-language-select]")?.value || null
  }));
  assert(englishLanguageApi.htmlLang === "en", "English document language did not persist after reload");
  assert(englishLanguageApi.selectorValue === "en", "English selector value did not persist after reload");

  await page.evaluate(() => localStorage.setItem("black-candle-language-v1", "not-a-language"));
  await page.reload();
  await page.waitForLoadState("load");
  await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
  const fallbackLanguageApi = await page.evaluate(() => ({
    htmlLang: document.documentElement.lang,
    selectorValue: document.querySelector("[data-language-select]")?.value || null
  }));
  assert(fallbackLanguageApi.htmlLang === "zh-Hant", "invalid language did not fall back to zh-Hant document language");
  assert(fallbackLanguageApi.selectorValue === "zhHant", "invalid language did not fall back to Traditional Chinese selector value");

  await page.evaluate(() => localStorage.setItem("black-candle-language-v1", "zhHant"));
  await page.reload();
  await page.waitForLoadState("load");
  await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
  await page.evaluate(() => {
    localStorage.removeItem("black-candle-save-v1");
    readSavePayload();
    render();
  });

  const visualApi = await page.evaluate(() => ({
    scenes: Array.isArray(sceneAssets) ? sceneAssets.length : 0,
    monsters: monsterAssets && typeof monsterAssets === "object"
      ? Object.keys(monsterAssets).length
      : 0,
    monsterActionSets: monsterActionAssets && typeof monsterActionAssets === "object"
      ? Object.keys(monsterActionAssets).length
      : 0,
    monsterActions: monsterActionAssets && typeof monsterActionAssets === "object"
      ? Object.values(monsterActionAssets).flatMap(actions => Object.values(actions)).length
      : 0,
    sceneStage: typeof sceneStage,
    potionImage: typeof renderPotionImage
  }));
  assert(visualApi.scenes === 4, "scene asset mapping missing");
  assert(visualApi.monsters === 8, "monster asset mapping missing");
  assert(visualApi.monsterActionSets === 8, "monster action asset mapping missing");
  assert(visualApi.monsterActions === 24, "monster action asset count mismatch");
  assert(visualApi.sceneStage === "function", "scene stage helper missing");
  assert(visualApi.potionImage === "function", "potion image helper missing");
  const audioApi = await page.evaluate(() => ({
    controller: typeof audioController,
    bgmKeys: Object.keys(BGM_ASSETS || {}).length,
    sfxKeys: Object.keys(SFX_ASSETS || {}).length,
    settings: audioController?.getSettings?.()
  }));
  assert(audioApi.controller === "object", "audio controller missing");
  assert(audioApi.bgmKeys === 5, "BGM mapping missing");
  assert(audioApi.sfxKeys === 12, "SFX mapping missing");
  assert(audioApi.settings.musicVolume === 0.42 && audioApi.settings.sfxVolume === 0.72, "default audio settings mismatch");
  assert((await audioPlays(page)).length === 0, "audio played before first interaction");
  const balanceApi = await page.evaluate(() => {
    const originalRandom = Math.random;
    const originalPlayer = { ...state.player };
    const originalStory = { ...state.story };
    const originalScreen = state.activeScreen;
    state.player.level = 3;
    state.story.stage = 2;
    Math.random = () => 0;
    const normal = generateMonster(false, "balance-smoke");
    Math.random = () => 0;
    const strong = generateMonster(true, "balance-smoke");
    Math.random = originalRandom;
    Object.assign(state.player, originalPlayer);
    Object.assign(state.story, originalStory);
    state.activeScreen = originalScreen;
    render();
    return {
      heavyMultiplier: BALANCE.skills.heavyStrike.damageMultiplier,
      burnTurns: BALANCE.skills.burningCurse.burnTurns,
      nextLevelOne: nextLevelExp(1),
      normal: { hp: normal.maxHp, attack: normal.attack, defense: normal.defense },
      strong: { hp: strong.maxHp, attack: strong.attack, defense: strong.defense },
      bossGold: BOSS_DEFINITIONS.map(boss => boss.gold),
      relicIds: RELIC_DEFINITIONS.map(relic => relic.id),
      eventIds: [...EXPLORATION_EVENT_IDS]
    };
  });
  assert(balanceApi.heavyMultiplier > 1 && balanceApi.heavyMultiplier < 2, "heavy strike balance multiplier is out of range");
  assert(balanceApi.burnTurns === 2 && balanceApi.nextLevelOne === 18, "skill or level-up balance constants are not applied");
  assert(balanceApi.strong.hp > balanceApi.normal.hp && balanceApi.strong.attack > balanceApi.normal.attack, "strong monster scaling is not stronger than normal scaling");
  assert(balanceApi.bossGold.every((gold, index, all) => index === 0 || gold > all[index - 1]), "boss gold rewards should increase by stage");
  assert(balanceApi.relicIds.includes("ironrootBadge") && balanceApi.relicIds.includes("dawnflask") && balanceApi.relicIds.includes("scavengerMap"), "new relic definitions are missing");
  assert(balanceApi.eventIds.includes("reliquary") && balanceApi.eventIds.includes("supplyCache"), "new exploration events are missing");
  assert(await page.getByText("新玩家指南", { exact: false }).isVisible(), "main guide is missing");
  await assertImageLoaded(page.locator(".scene-stage .scene-art"), "main scene art did not load");
  await page.getByRole("button", { name: "開始冒險" }).click();
  await assertAudioPlayed(page, "bgm-ash-village.wav", "first interaction did not request village BGM");
  assert(await page.locator(".panel h2").evaluate(heading => document.activeElement === heading), "cross-screen render did not focus the new screen heading");

  await page.evaluate(() => {
    window.__announcerMutations = 0;
    const announcer = document.getElementById("game-announcer");
    new MutationObserver(records => {
      window.__announcerMutations += records.length;
    }).observe(announcer, { childList: true, characterData: true, subtree: true });
    state.player.hp = state.player.maxHp;
  });
  await page.getByRole("button", { name: "返回休息" }).click();
  await page.waitForFunction(() => document.getElementById("game-announcer").textContent.includes("生命值已滿"));
  const firstAnnouncementMutations = await page.evaluate(() => window.__announcerMutations);
  await page.getByRole("button", { name: "返回休息" }).click();
  await page.waitForFunction(previous => window.__announcerMutations > previous, firstAnnouncementMutations);

  for (let stageIndex = 0; stageIndex < 4; stageIndex += 1) {
    await page.evaluate(index => {
      state.story.stage = index;
      state.activeScreen = "adventure";
      render();
    }, stageIndex);
    const sceneArt = page.locator(".scene-stage .scene-art");
    await assertImageLoaded(sceneArt, `scene art did not decode: stage ${stageIndex}`);
    const sourceMatches = await sceneArt.evaluate((image, index) => image.src.endsWith(sceneAssets[index]), stageIndex);
    assert(sourceMatches, `wrong scene asset rendered: stage ${stageIndex}`);
  }
  await assertAudioPlayed(page, "bgm-rotten-forest.wav", "stage 1 did not request forest BGM");
  await assertAudioPlayed(page, "bgm-damp-cave.wav", "stage 2 did not request cave BGM");
  await assertAudioPlayed(page, "bgm-old-king-tomb.wav", "stage 3 did not request tomb BGM");
  await page.evaluate(() => {
    state.story.stage = 0;
    state.activeScreen = "main";
    localStorage.removeItem("black-candle-save-v1");
    readSavePayload();
    render();
  });

  assert(await page.getByRole("button", { name: "繼續遊戲" }).isDisabled(), "continue should be disabled before a save exists");
  await page.getByRole("button", { name: "新遊戲", exact: true }).click();
  let savedPayload = await page.evaluate(() => JSON.parse(localStorage.getItem("black-candle-save-v1")));
  assert(savedPayload.saveVersion === 1, "new game did not create a versioned save");
  assert(typeof savedPayload.savedAt === "string" && savedPayload.savedAt.length > 0, "new game save is missing savedAt");
  assert(savedPayload.player.gold === 30 && savedPayload.story.stage === 0, "new game save did not use default state");
  assert(savedPayload.logs.some(entry => entry.key === "logs.newGameStarted"), "new game save log is missing");
  assert(await page.getByRole("button", { name: "繼續遊戲" }).isEnabled(), "continue should be enabled after creating a save");

  await page.evaluate(() => {
    Object.assign(state.player, {
      level: 4,
      maxHp: 44,
      hp: 17,
      attack: 13,
      defense: 6,
      exp: 7,
      gold: 88,
      potions: 3,
      relics: ["emberCharm", "burialCoin"],
      relicStates: { burialCoinSpent: true }
    });
    state.story.stage = 2;
    state.story.progress = 9;
    state.story.statusKey = "dampCave";
    state.story.status = "潮濕洞穴";
    state.story.defeatedBosses = ["ashGateWarden", "rotrootAlpha"];
    state.story.activeEvent = { id: "fork" };
    state.activeScreen = "profile";
    saveGame();
  });
  await page.reload();
  await page.waitForLoadState("load");
  await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
  assert(await page.getByRole("button", { name: "繼續遊戲" }).isEnabled(), "saved game was not detected after reload");
  await page.getByRole("button", { name: "開始冒險", exact: true }).click();
  let snapshot = await state(page);
  assert(snapshot.screen === "profile", "start adventure should load an existing save before entering gameplay");
  assert(snapshot.player.level === 4 && snapshot.player.gold === 88, "start adventure overwrote an existing unloaded save");
  savedPayload = await page.evaluate(() => JSON.parse(localStorage.getItem("black-candle-save-v1")));
  assert(savedPayload.player.level === 4 && savedPayload.story.stage === 2, "existing save was overwritten before continue");

  await page.reload();
  await page.waitForLoadState("load");
  await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
  await page.getByRole("button", { name: "繼續遊戲", exact: true }).click();
  snapshot = await state(page);
  assert(snapshot.screen === "profile", "continue did not restore the saved screen");
  assert(snapshot.player.level === 4 && snapshot.player.hp === 17 && snapshot.player.gold === 88, "continue did not restore player state");
  assert(snapshot.player.relics.includes("emberCharm") && snapshot.player.relicStates.burialCoinSpent === true, "continue did not restore relic state");
  assert(snapshot.story.stage === 2 && snapshot.story.activeEvent.id === "fork", "continue did not restore story/event state");
  assert(snapshot.story.defeatedBosses.includes("rotrootAlpha"), "continue did not restore defeated boss state");
  assert(snapshot.logs.some(item => item.includes("讀檔完成")), "continue did not add a load log");

  await page.evaluate(() => {
    localStorage.setItem("black-candle-save-v1", JSON.stringify({
      saveVersion: 0,
      savedAt: "legacy",
      activeScreen: "combat",
      player: {
        level: "3",
        maxHp: "36",
        hp: "999",
        attack: "11",
        defense: "4",
        gold: "42",
        potions: "2",
        skills: ["basicAttack", "missingSkill"],
        relics: ["waxsealedVial", "missingRelic"],
        relicStates: []
      },
      story: {
        stage: "1",
        progress: "5",
        status: "腐爛森林",
        defeatedBosses: ["ashGateWarden", "badBoss"],
        activeEvent: { id: "traveler" }
      },
      logs: [{ key: "logs.initialGuide", params: {} }]
    }));
  });
  await page.reload();
  await page.waitForLoadState("load");
  await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
  await page.getByRole("button", { name: "繼續遊戲", exact: true }).click();
  snapshot = await state(page);
  assert(snapshot.screen === "main", "legacy combat save should resume on the main screen");
  assert(snapshot.player.hp === 36 && snapshot.player.level === 3, "legacy player numbers were not normalized");
  assert(snapshot.player.skills.length === 1 && snapshot.player.skills[0] === "basicAttack", "legacy skills were not filtered");
  assert(snapshot.player.relics.length === 1 && snapshot.player.relics[0] === "waxsealedVial", "legacy relics were not filtered");
  assert(snapshot.story.statusKey === "rottenForest" && snapshot.story.stage === 1, "legacy story status was not migrated");
  assert(snapshot.story.defeatedBosses.length === 1 && snapshot.story.defeatedBosses[0] === "ashGateWarden", "legacy defeated bosses were not filtered");
  assert(snapshot.story.activeEvent.id === "traveler", "legacy active event was not preserved");
  savedPayload = await page.evaluate(() => JSON.parse(localStorage.getItem("black-candle-save-v1")));
  assert(savedPayload.saveVersion === 1 && savedPayload.player.hp === 36, "migrated save was not rewritten at the current version");

  await page.evaluate(() => {
    localStorage.setItem("black-candle-save-v1", JSON.stringify({
      saveVersion: 99,
      savedAt: "future",
      activeScreen: "profile",
      player: { level: 9, hp: 9, maxHp: 99, gold: 999 },
      story: { stage: 3, progress: 13 }
    }));
  });
  await page.reload();
  await page.waitForLoadState("load");
  await page.getByRole("heading", { name: "黑燭地牢" }).waitFor();
  await page.getByRole("button", { name: "繼續遊戲", exact: true }).click();
  snapshot = await state(page);
  savedPayload = await page.evaluate(() => JSON.parse(localStorage.getItem("black-candle-save-v1")));
  assert(snapshot.player.level === 1 && snapshot.story.stage === 0, "future-version save should not be loaded by an older build");
  assert(savedPayload.saveVersion === 99 && savedPayload.player.gold === 999, "future-version save was downgraded or overwritten");
  assert(snapshot.logs.some(item => item.includes("較新")), "future-version save warning log is missing");

  await page.getByRole("button", { name: "重置進度", exact: true }).click();
  snapshot = await state(page);
  const saveAfterReset = await page.evaluate(() => localStorage.getItem("black-candle-save-v1"));
  assert(saveAfterReset === null, "reset progress did not clear localStorage");
  assert(snapshot.player.level === 1 && snapshot.player.gold === 30 && snapshot.story.stage === 0, "reset progress did not restore defaults");
  assert(snapshot.logs.some(item => item.includes("進度已重置")), "reset progress log is missing");
  assert(await page.getByRole("button", { name: "繼續遊戲" }).isDisabled(), "continue should be disabled after reset");

  await page.getByRole("button", { name: "商店", exact: true }).click();
  assert(await page.getByRole("heading", { name: "商店介面" }).isVisible(), "shop did not open");
  await assertImageLoaded(page.locator(".scene-stage .scene-art"), "shop scene art did not load");
  await assertImageLoaded(page.locator(".item-icon img"), "shop potion art did not load");
  await page.getByRole("button", { name: "購買" }).click();
  snapshot = await state(page);
  assert(snapshot.player.gold === 15 && snapshot.player.potions === 1, "first purchase did not update gold/potions");
  await assertAudioPlayed(page, "sfx-purchase.wav", "successful purchase did not request purchase SFX");
  await page.getByRole("button", { name: "購買" }).click();
  snapshot = await state(page);
  assert(snapshot.player.gold === 0 && snapshot.player.potions === 2, "second purchase did not update gold/potions");
  assert(await page.getByRole("button", { name: "購買" }).isDisabled(), "unaffordable purchase is not disabled");
  assert(await page.getByText("金幣不足", { exact: false }).isVisible(), "insufficient-gold message is missing");

  await page.getByRole("button", { name: "背包" }).click();
  assert(await page.getByRole("heading", { name: "背包或道具使用介面" }).isVisible(), "inventory did not open");
  await assertImageLoaded(page.locator(".item-icon img"), "inventory potion art did not load");
  assert(await page.getByRole("button", { name: "使用藥劑" }).isDisabled(), "full-HP inventory potion should be disabled");
  await page.evaluate(() => { state.player.hp = 8; render(); });
  const beforeInventory = await state(page);
  await page.getByRole("button", { name: "使用藥劑" }).click();
  snapshot = await state(page);
  assert(snapshot.player.potions === beforeInventory.player.potions - 1, "inventory potion was not consumed");
  assert(snapshot.player.hp > beforeInventory.player.hp && snapshot.player.hp <= snapshot.player.maxHp, "inventory potion healing is invalid");
  await assertAudioPlayed(page, "sfx-potion.wav", "successful potion use did not request potion SFX");

  await page.evaluate(() => {
    Math.random = () => 0.2;
    state.player.hp = state.player.maxHp;
    state.player.attack = 10;
    state.player.defense = 3;
    state.player.potions = 1;
    state.currentMonster = null;
    startCombat(false, "smoke");
  });
  assert(await page.getByRole("heading", { name: "戰鬥介面" }).isVisible(), "combat did not open");
  await assertAudioPlayed(page, "bgm-combat.wav", "active combat did not request combat BGM");
  await assertImageLoaded(page.locator(".scene-stage .scene-art"), "combat scene art did not load");
  await assertImageLoaded(page.locator(".monster-art"), "combat monster art did not load");
  assert(await page.getByRole("button", { name: "商店" }).isDisabled(), "navigation is not locked during combat");
  const beforeAttack = await state(page);
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".monster-art")?.dataset.monsterAction === "hurt");
  const hurtSource = await page.locator(".monster-art").evaluate(image => image.src);
  assert(hurtSource.includes("-hurt.webp"), `hurt monster action did not render: ${hurtSource}`);
  await page.waitForFunction(() => document.querySelector(".monster-art")?.dataset.monsterAction === "attack");
  const attackSource = await page.locator(".monster-art").evaluate(image => image.src);
  assert(attackSource.includes("-attack.webp"), `attack monster action did not render: ${attackSource}`);
  await page.waitForFunction(beforeHp => state.player.hp < beforeHp, beforeAttack.player.hp);
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(snapshot.monster.hp < beforeAttack.monster.hp, "player attack did not damage monster");
  assert(snapshot.player.hp < beforeAttack.player.hp, "monster did not counterattack");
  await assertAudioPlayed(page, "sfx-player-attack.wav", "player attack did not request player attack SFX");
  await assertAudioPlayed(page, "sfx-monster-attack.wav", "monster counterattack did not request monster attack SFX");
  await assertAudioPlayed(page, "sfx-player-hit.wav", "monster counterattack did not request player hit SFX");
  const criticalRequests = (await audioPlays(page)).filter(play => play.src.includes("sfx-critical-hit.wav"));
  assert(criticalRequests.length === 0, "critical hit SFX should not play without a critical-hit mechanic");
  const attackIndex = snapshot.combatLogs.findIndex(item => item.startsWith("你攻擊"));
  const counterIndex = snapshot.combatLogs.findIndex(item => item.includes("反擊"));
  assert(attackIndex >= 0 && counterIndex > attackIndex, "combat log is not chronological");
  assert(await page.getByRole("button", { name: "攻擊", exact: true }).isEnabled(), "attack button was not re-enabled after combat animation");
  assert((await page.locator("#game-announcer").textContent()).trim().length > 0, "persistent game announcer did not update");

  await page.evaluate(() => {
    state.player.hp = 20;
    state.player.maxHp = 20;
    state.player.attack = 8;
    state.player.defense = 0;
    state.player.effects = {};
    state.currentMonster = {
      monsterId: "goblin",
      name: "哥布林",
      maxHp: 60,
      hp: 60,
      attack: 12,
      defense: 1,
      ability: "goblin",
      statusEffects: {},
      strong: false,
      source: "smoke"
    };
    state.combatLogs = [];
    state.activeScreen = "combat";
    render();
  });
  for (const label of ["攻擊", "重擊", "防禦", "黑焰詛咒"]) {
    assert(await page.getByRole("button", { name: label, exact: true }).isVisible(), `skill button missing: ${label}`);
  }
  assert(await page.getByText("造成較高傷害", { exact: false }).isVisible(), "skill description is missing");

  const beforeDefend = await state(page);
  await page.getByRole("button", { name: "防禦", exact: true }).click();
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(beforeDefend.player.hp - snapshot.player.hp < 12, "defend skill did not reduce incoming damage");
  assert(snapshot.combatLogs.some(item => item.includes("傷害降低")), "defend reduction log is missing");

  const beforeBurnHp = snapshot.monster.hp;
  await page.getByRole("button", { name: "黑焰詛咒", exact: true }).click();
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(snapshot.monster.hp <= beforeBurnHp - 7, "burning curse did not apply direct and ongoing damage");
  assert(snapshot.monster.statusEffects.burn && snapshot.monster.statusEffects.burn.turns === 1, "burn status did not remain after first tick");
  assert(snapshot.combatLogs.some(item => item.includes("持續傷害")), "burn tick log is missing");
  assert(await page.getByRole("button", { name: "黑焰詛咒", exact: true }).isDisabled(), "burning curse should be disabled while the enemy is already burning");

  await setCombatFixture(page, {
    randomValue: 0,
    player: { hp: 30, maxHp: 30, defense: 0 },
    monster: {
      monsterId: "slime",
      maxHp: 30,
      hp: 10,
      attack: 8,
      defense: 0
    }
  });
  snapshot = await state(page);
  assert(snapshot.monster.attack === 5, "slime low-attack modifier was not applied");
  await page.evaluate(() => {
    monsterAttack();
    render();
  });
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(snapshot.monster.hp > 10, "slime did not heal when heal chance was forced");
  assert(snapshot.player.hp === 25, "slime low attack did not affect incoming damage");
  assert(snapshot.combatLogs.some(item => item.includes("恢復")), "slime heal log is missing");

  await setCombatFixture(page, {
    player: { hp: 30, maxHp: 30, attack: 10, defense: 3 },
    monster: {
      monsterId: "skeleton",
      maxHp: 30,
      hp: 30,
      attack: 1,
      defense: 1
    }
  });
  const beforeSkeleton = await state(page);
  assert(beforeSkeleton.monster.defense === 4, "skeleton high-defense modifier was not applied");
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(beforeSkeleton.monster.hp - snapshot.monster.hp === 6, "skeleton defense did not reduce player damage");

  await setCombatFixture(page, {
    randomValue: 0,
    player: { hp: 30, maxHp: 30, defense: 0 },
    monster: {
      monsterId: "wolf",
      maxHp: 30,
      hp: 30,
      attack: 8,
      defense: 0
    }
  });
  await page.evaluate(() => {
    monsterAttack();
    render();
  });
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(snapshot.player.hp === 16, "wolf forced double strike did not apply both hits");
  assert(snapshot.combatLogs.some(item => item.includes("連擊")), "wolf double-strike log is missing");

  await setCombatFixture(page, {
    randomValue: 0.99,
    player: { hp: 30, maxHp: 30, defense: 0 },
    monster: {
      monsterId: "shadowBeast",
      maxHp: 30,
      hp: 30,
      attack: 6,
      defense: 0
    }
  });
  await page.getByRole("button", { name: "逃跑" }).click();
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(snapshot.player.hp === 19, "shadow beast failed-flee penalty did not add extra damage");
  assert(snapshot.combatLogs.some(item => item.includes("額外造成")), "shadow beast flee penalty log is missing");

  await setCombatFixture(page, {
    randomValue: 0.99,
    player: { hp: 30, maxHp: 30, defense: 0, relics: ["shadowTether"], relicStates: {} },
    monster: {
      monsterId: "shadowBeast",
      maxHp: 30,
      hp: 30,
      attack: 6,
      defense: 0
    }
  });
  await page.getByRole("button", { name: "逃跑" }).click();
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(snapshot.player.hp === 21, "shadow tether did not reduce failed-flee penalty");
  assert(snapshot.combatLogs.some(item => item.includes("斷影繩")), "shadow tether reduction log is missing");

  await setCombatFixture(page, {
    randomValue: 0,
    player: { hp: 30, maxHp: 30, defense: 0 },
    monster: {
      monsterId: "blackCandleCultist",
      maxHp: 30,
      hp: 30,
      attack: 6,
      defense: 0
    }
  });
  await page.evaluate(() => {
    monsterAttack();
    render();
  });
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(snapshot.player.effects.blackCandleCurse && snapshot.player.effects.blackCandleCurse.turns === 2, "cultist curse was not applied");
  assert(snapshot.combatLogs.some(item => item.includes("黑燭咒印")), "cultist curse log is missing");
  await page.getByRole("button", { name: "防禦", exact: true }).click();
  await waitForCombatIdle(page);
  snapshot = await state(page);
  assert(snapshot.player.effects.blackCandleCurse && snapshot.player.effects.blackCandleCurse.turns === 1, "cultist curse did not tick down on the next player turn");
  assert(snapshot.combatLogs.some(item => item.includes("灼痛")), "cultist curse tick log is missing");

  await page.evaluate(() => {
    Math.random = () => 0.99;
    state.player.hp = state.player.maxHp;
    state.player.attack = 99;
    state.player.effects = {};
    state.story.stage = 0;
    state.story.progress = 1;
    state.story.statusKey = "ashVillage";
    state.story.status = "灰燼村入口";
    state.story.defeatedBosses = [];
    state.story.activeEvent = null;
    state.story.expeditionComplete = false;
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    advanceStory("distantBell");
    render();
  });
  snapshot = await state(page);
  assert(snapshot.story.stage === 0 && snapshot.story.progress === 2, "boss threshold should not advance the stage before victory");
  assert(snapshot.logs.some(item => item.includes("灰門守衛")), "boss appearance log is missing");
  assert(await page.getByText("Boss 挑戰已開啟", { exact: true }).isVisible(), "boss-ready adventure callout is missing");
  assert(await page.getByText("先挑戰 Boss 才能繼續深入", { exact: false }).first().isVisible(), "boss blocking adventure goal is missing");
  assert(await page.getByRole("button", { name: "挑戰 Boss", exact: true }).isVisible(), "pending boss challenge button is missing");
  await page.evaluate(() => {
    handleAdventureChoice("deep");
  });
  snapshot = await state(page);
  assert(snapshot.story.stage === 0, "blocked boss should prevent entering the next area");
  assert(snapshot.logs.some(item => item.includes("仍守著出口")), "boss blocking log is missing");
  const bossBlockedProgress = snapshot.story.progress;
  await page.evaluate(() => {
    handleAdventureChoice("village");
  });
  snapshot = await state(page);
  assert(snapshot.story.progress === bossBlockedProgress, "village visits should not over-advance progress while a boss is pending");
  await page.getByRole("button", { name: "挑戰 Boss", exact: true }).click();
  await page.waitForFunction(() => state.currentMonster?.boss === true);
  snapshot = await state(page);
  assert(snapshot.monster.boss && snapshot.monster.bossId === "ashGateWarden", "boss combat did not start with the expected boss");
  assert(typeof snapshot.monster.ability === "string" && snapshot.monster.statusEffects && !Array.isArray(snapshot.monster.statusEffects), "boss monster data fields are incomplete");
  await page.evaluate(() => {
    state.currentMonster.hp = 1;
    render();
  });
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await page.waitForFunction(() => state.activeScreen === "adventure" && state.currentMonster === null && state.story.stage === 1);
  snapshot = await state(page);
  assert(snapshot.story.defeatedBosses.includes("ashGateWarden"), "defeated boss was not recorded");
  assert(snapshot.logs.some(item => item.includes("Boss 戰勝利")), "boss victory log is missing");
  assert(snapshot.player.relics.includes("emberCharm"), "boss victory did not award the ember charm relic");
  assert(snapshot.logs.some(item => item.includes("餘燼護符")), "boss relic reward log is missing");

  await setCombatFixture(page, {
    randomValue: 0,
    player: { level: 1, exp: 0, hp: 10, maxHp: 30, attack: 99, relics: ["emberCharm"], relicStates: {} },
    monster: {
      monsterId: "goblin",
      maxHp: 1,
      hp: 1,
      attack: 1,
      defense: 0
    }
  });
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await page.waitForFunction(() => state.currentMonster === null && state.activeScreen === "adventure");
  snapshot = await state(page);
  assert(snapshot.player.hp === 13, "ember charm did not heal after a kill");
  assert(snapshot.combatLogs.some(item => item.includes("餘燼護符")), "ember charm combat log is missing");

  await page.evaluate(() => {
    Math.random = () => 0.99;
    Object.assign(state.player, {
      level: 1,
      exp: 0,
      hp: 30,
      maxHp: 30,
      attack: 99,
      defense: 10,
      relics: [],
      relicStates: {},
      effects: {}
    });
    state.story.stage = 1;
    state.story.progress = 5;
    state.story.statusKey = "rottenForest";
    state.story.status = "腐爛森林";
    state.story.defeatedBosses = ["ashGateWarden"];
    state.story.activeEvent = null;
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    render();
  });
  await page.getByRole("button", { name: "挑戰 Boss", exact: true }).click();
  await page.waitForFunction(() => state.currentMonster?.bossId === "rotrootAlpha");
  await page.evaluate(() => {
    state.currentMonster.hp = 1;
    render();
  });
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await page.waitForFunction(() => state.activeScreen === "adventure" && state.currentMonster === null && state.story.stage === 2);
  snapshot = await state(page);
  assert(snapshot.player.relics.includes("shadowTether"), "second boss victory did not award shadow tether");

  await page.evaluate(() => {
    Object.assign(state.player, {
      hp: 9,
      maxHp: 30,
      defense: 0,
      relics: ["ironrootBadge"],
      relicStates: {},
      effects: {}
    });
    state.currentMonster = {
      monsterId: "goblin",
      name: "哥布林",
      maxHp: 20,
      hp: 20,
      attack: 10,
      defense: 0,
      ability: "goblin",
      statusEffects: {},
      strong: false,
      source: "smoke"
    };
    state.combatLogs = [];
    state.activeScreen = "combat";
    applyMonsterDamage(10);
    render();
  });
  snapshot = await state(page);
  assert(snapshot.player.hp === 1, "ironroot badge low-HP defense did not reduce incoming damage");
  assert(await page.getByText("低血量防禦 +2", { exact: false }).isVisible(), "ironroot badge active status is missing");

  await page.evaluate(() => {
    Math.random = () => 0.99;
    Object.assign(state.player, {
      level: 1,
      exp: 0,
      hp: 10,
      maxHp: 30,
      attack: 99,
      defense: 10,
      relics: ["dawnflask"],
      relicStates: {},
      effects: {}
    });
    state.story.stage = 2;
    state.story.progress = 9;
    state.story.statusKey = "dampCave";
    state.story.status = "潮濕洞穴";
    state.story.defeatedBosses = ["ashGateWarden", "rotrootAlpha"];
    state.story.activeEvent = null;
    state.story.expeditionComplete = false;
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    render();
  });
  await page.getByRole("button", { name: "挑戰 Boss", exact: true }).click();
  await page.waitForFunction(() => state.currentMonster?.bossId === "blackWaxSeer");
  snapshot = await state(page);
  assert(snapshot.player.hp === 18, "dawnflask did not heal at Boss entry");
  assert(snapshot.combatLogs.some(item => item.includes("破曉小瓶")), "dawnflask combat log is missing");
  await page.evaluate(() => {
    state.currentMonster.hp = 1;
    render();
  });
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await page.waitForFunction(() => state.activeScreen === "adventure" && state.currentMonster === null && state.story.stage === 3);
  snapshot = await state(page);
  assert(snapshot.player.relics.includes("ironrootBadge"), "third boss victory did not award ironroot badge");

  await page.evaluate(() => {
    Math.random = () => 0.99;
    Object.assign(state.player, {
      hp: 30,
      maxHp: 30,
      attack: 99,
      defense: 10,
      effects: {}
    });
    state.story.stage = 3;
    state.story.progress = 13;
    state.story.statusKey = "oldKingsTomb";
    state.story.status = "舊王墓穴";
    state.story.defeatedBosses = ["ashGateWarden", "rotrootAlpha", "blackWaxSeer"];
    state.story.activeEvent = null;
    state.story.expeditionComplete = false;
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    render();
  });
  await page.getByRole("button", { name: "挑戰 Boss", exact: true }).click();
  await page.waitForFunction(() => state.currentMonster?.bossId === "oldKingHusk");
  await page.evaluate(() => {
    state.currentMonster.hp = 1;
    render();
  });
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await page.waitForFunction(() => state.activeScreen === "adventure" && state.currentMonster === null && state.story.expeditionComplete === true);
  snapshot = await state(page);
  assert(snapshot.story.expeditionComplete === true, "final boss victory did not mark expedition complete");
  assert(snapshot.logs.some(item => item.includes("這段探索暫時告一段落")), "final boss victory log is missing");
  assert(await page.getByText("遠征完成", { exact: false }).first().isVisible(), "expedition complete adventure feedback is missing");

  await page.evaluate(() => {
    Math.random = () => 0;
    state.player.hp = 12;
    state.player.maxHp = 30;
    state.player.gold = 10;
    state.player.potions = 1;
    state.player.relics = [];
    state.player.relicStates = {};
    state.story.stage = 1;
    state.story.progress = 2;
    state.story.activeEvent = null;
    state.story.expeditionComplete = false;
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    render();
  });
  await page.getByRole("button", { name: "探索洞穴", exact: true }).click();
  assert(await page.getByRole("heading", { name: "黑蠟祭壇" }).isVisible(), "exploration event card did not render");
  assert(await page.getByRole("button", { name: "謹慎祈禱", exact: true }).isVisible(), "safe event choice is missing");
  assert(await page.getByRole("button", { name: "觸碰核心", exact: true }).isVisible(), "risk event choice is missing");
  assert(await page.getByRole("button", { name: "獻上藥劑", exact: true }).isVisible(), "resource event choice is missing");
  const beforeSafeEvent = await state(page);
  await page.getByRole("button", { name: "謹慎祈禱", exact: true }).click();
  snapshot = await state(page);
  assert(snapshot.player.hp > beforeSafeEvent.player.hp, "safe event choice did not heal the player");
  assert(snapshot.story.progress === beforeSafeEvent.story.progress + 1, "safe event choice did not advance story progress");
  assert(snapshot.story.activeEvent === null, "safe event choice did not clear active event");
  assert(snapshot.player.relics.includes("waxsealedVial"), "altar event did not award the wax-sealed vial relic");

  await page.evaluate(() => {
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    state.story.stage = 1;
    state.story.progress = 4;
    state.story.statusKey = "rottenForest";
    state.story.status = "腐爛森林";
    state.story.defeatedBosses = ["ashGateWarden"];
    state.story.activeEvent = { id: "reliquary" };
    state.story.expeditionComplete = false;
    state.player.relics = [];
    state.player.relicStates = {};
    render();
  });
  await page.getByRole("button", { name: "記下刻痕", exact: true }).click();
  snapshot = await state(page);
  assert(snapshot.story.progress === 5, "threshold event did not advance to the boss threshold");
  assert(snapshot.logs.some(item => item.includes("聖匣上的刻痕")), "threshold event result log was dropped");
  assert(snapshot.logs.some(item => item.includes("腐根狼王")), "threshold event did not show boss appearance log");

  await page.evaluate(() => {
    state.story.stage = 1;
    state.story.progress = 2;
    state.story.defeatedBosses = ["ashGateWarden"];
    state.story.activeEvent = { id: "fork" };
    state.story.expeditionComplete = false;
    state.activeScreen = "adventure";
    render();
  });
  assert(await page.getByRole("button", { name: "挑戰怪物", exact: true }).isDisabled(), "active event should disable unrelated challenge action");
  await page.evaluate(() => {
    handleAdventureChoice("cave");
    render();
  });
  snapshot = await state(page);
  assert(snapshot.story.activeEvent && snapshot.story.activeEvent.id === "fork", "active event should not be overwritten by unrelated exploration");
  await page.getByRole("button", { name: "衝入陌生路", exact: true }).click();
  await page.waitForFunction(() => state.activeScreen === "combat" && state.currentMonster);
  snapshot = await state(page);
  assert(snapshot.monster && snapshot.monster.source === "event" && snapshot.monster.eventId === "fork", "risk event choice did not start tagged event combat");
  await page.evaluate(() => {
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    state.story.activeEvent = { id: "chest" };
    state.player.gold = 10;
    state.player.potions = 0;
    render();
  });
  await page.getByRole("button", { name: "支付開鎖", exact: true }).click();
  snapshot = await state(page);
  assert(snapshot.player.gold === 5 && snapshot.player.potions === 1, "resource event choice did not trade gold for a potion");
  assert(snapshot.story.activeEvent === null, "resource event choice did not clear active event");

  await page.evaluate(() => {
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    state.story.activeEvent = { id: "traveler" };
    state.player.attack = 99;
    state.player.relics = [];
    state.player.relicStates = {};
    Math.random = () => 0;
    render();
  });
  await page.getByRole("button", { name: "追查求救聲", exact: true }).click();
  await page.waitForFunction(() => state.activeScreen === "combat" && state.currentMonster?.eventId === "traveler");
  await page.evaluate(() => {
    state.currentMonster.hp = 1;
    render();
  });
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await page.waitForFunction(() => state.activeScreen === "adventure" && state.currentMonster === null);
  snapshot = await state(page);
  assert(snapshot.player.relics.includes("burialCoin"), "traveler risk combat victory did not award burial coin");

  await page.evaluate(() => {
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    state.story.stage = 1;
    state.story.progress = 2;
    state.story.activeEvent = { id: "reliquary" };
    state.story.expeditionComplete = false;
    state.player.hp = 10;
    state.player.maxHp = 30;
    state.player.gold = 10;
    state.player.relics = [];
    state.player.relicStates = {};
    render();
  });
  assert(await page.getByRole("heading", { name: "裂紋聖匣" }).isVisible(), "reliquary exploration event did not render");
  await page.getByRole("button", { name: "記下刻痕", exact: true }).click();
  snapshot = await state(page);
  assert(snapshot.player.relics.includes("dawnflask"), "reliquary event did not award dawnflask");
  assert(snapshot.story.activeEvent === null, "reliquary event did not clear active event");

  await page.evaluate(() => {
    Math.random = () => 0;
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    state.story.stage = 1;
    state.story.progress = 2;
    state.story.activeEvent = { id: "supplyCache" };
    state.story.expeditionComplete = false;
    state.player.gold = 0;
    state.player.potions = 0;
    state.player.relics = ["scavengerMap"];
    state.player.relicStates = {};
    render();
  });
  assert(await page.getByRole("heading", { name: "補給殘袋" }).isVisible(), "supply cache exploration event did not render");
  await page.getByRole("button", { name: "清點補給", exact: true }).click();
  snapshot = await state(page);
  assert(snapshot.player.gold === 10, "scavenger map did not add exploration gold bonus");
  assert(snapshot.logs.some(item => item.includes("拾荒者地圖")), "scavenger map bonus log is missing");
  await page.getByRole("button", { name: "個人資訊", exact: true }).click();
  assert(await page.getByText("來源：補給殘袋事件", { exact: true }).isVisible(), "relic source hint is missing from relic cards");

  await page.evaluate(() => {
    state.currentMonster = null;
    state.combatLogs = [];
    state.activeScreen = "adventure";
    state.story.activeEvent = null;
    state.player.hp = state.player.maxHp;
    Math.random = () => 0.99;
    render();
  });
  await page.getByRole("button", { name: "挑戰怪物", exact: true }).click();
  await page.waitForFunction(() => state.activeScreen === "combat" && state.currentMonster?.source === "challenge");
  snapshot = await state(page);
  assert(snapshot.monster && snapshot.monster.strong, "challenge monster button did not start a strong combat");
  assert(snapshot.monster.boss === false, "normal challenge monster should expose boss=false");
  assert(typeof snapshot.monster.ability === "string" && snapshot.monster.statusEffects && !Array.isArray(snapshot.monster.statusEffects), "normal monster data fields are incomplete");

  await page.evaluate(() => {
    state.currentMonster = {
      monsterId: "slime",
      name: "史萊姆",
      maxHp: 20,
      hp: 20,
      attack: 5,
      defense: 1,
      statusEffects: [],
      strong: false,
      source: "legacy-smoke"
    };
    state.activeScreen = "combat";
    render();
  });
  snapshot = await state(page);
  assert(snapshot.monster.boss === false, "legacy monster was not normalized with boss=false");
  assert(snapshot.monster.ability === "slime", "legacy monster ability was not normalized");
  assert(snapshot.monster.statusEffects && !Array.isArray(snapshot.monster.statusEffects), "legacy monster statusEffects was not normalized to an object");

  await page.evaluate(() => {
    Math.random = () => 0;
    state.currentMonster = null;
    state.activeScreen = "inventory";
    state.player.hp = 10;
    state.player.maxHp = 30;
    state.player.potions = 1;
    state.player.relics = ["waxsealedVial"];
    state.player.relicStates = {};
    render();
  });
  await page.getByRole("button", { name: "使用藥劑" }).click();
  snapshot = await state(page);
  assert(snapshot.player.hp === 20, "wax-sealed vial did not boost inventory potion healing");
  assert(snapshot.player.potions === 0, "boosted inventory potion was not consumed exactly once");
  assert(snapshot.logs.some(item => item.includes("封蠟小瓶")), "wax-sealed vial potion log is missing");

  await page.evaluate(() => {
    state.player.hp = 10;
    state.player.maxHp = 20;
    state.player.defense = 10;
    state.player.potions = 1;
    state.player.effects = {};
    state.player.relics = [];
    state.player.relicStates = {};
    state.currentMonster = {
      monsterId: "goblin",
      name: "哥布林",
      maxHp: 40,
      hp: 40,
      attack: 5,
      defense: 1,
      ability: "goblin",
      statusEffects: {},
      strong: false,
      source: "smoke"
    };
    state.combatLogs = [];
    state.activeScreen = "combat";
    render();
  });

  const beforeCombatPotion = await state(page);
  await page.getByRole("button", { name: "使用藥劑" }).click();
  snapshot = await state(page);
  assert(snapshot.player.potions === beforeCombatPotion.player.potions - 1, "combat potion was not consumed");
  assert(snapshot.monster.hp === beforeCombatPotion.monster.hp, "combat potion incorrectly damaged monster");
  const potionIndex = snapshot.combatLogs.findIndex(item => item.startsWith("使用黑燭藥劑"));
  const potionCounterIndex = snapshot.combatLogs.findIndex((item, index) => index > potionIndex && item.includes("反擊"));
  assert(potionIndex >= 0 && potionCounterIndex > potionIndex, "combat potion did not consume exactly one enemy turn in order");
  await waitForCombatIdle(page);

  await page.screenshot({ path: path.join(artifactDir, "visual-rpg-combat.png"), fullPage: true });

  await page.evaluate(() => { Math.random = () => 0; });
  await page.getByRole("button", { name: "逃跑" }).click();
  snapshot = await state(page);
  assert(snapshot.screen === "adventure" && snapshot.monster === null, "successful flee did not end combat");
  await assertAudioPlayed(page, "sfx-flee.wav", "successful flee did not request flee SFX");

  await resetAudioProbe(page);
  await page.evaluate(() => {
    state.story.stage = 1;
    state.story.progress = 4;
    state.story.defeatedBosses = ["ashGateWarden"];
    state.story.activeEvent = null;
    state.activeScreen = "adventure";
    advanceStory("煙測推進洞穴入口。");
    render();
  });
  await assertAudioPlayed(page, "sfx-discovery.wav", "story discovery did not request discovery SFX");

  await resetAudioProbe(page);
  await page.evaluate(() => {
    state.player.level = 1;
    state.player.exp = nextLevelExp(1);
    state.player.hp = 10;
    checkLevelUps();
    render();
  });
  await assertAudioPlayed(page, "sfx-level-up.wav", "level up did not request level-up SFX");

  await resetAudioProbe(page);
  await page.evaluate(() => {
    state.player.hp = state.player.maxHp;
    state.currentMonster = {
      name: "史萊姆",
      maxHp: 1,
      hp: 1,
      attack: 1,
      defense: 0,
      strong: false,
      source: "smoke"
    };
    state.activeScreen = "combat";
    render();
  });
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".monster-art")?.dataset.monsterAction === "death");
  const deathSource = await page.locator(".monster-art").evaluate(image => image.src);
  assert(deathSource.includes("-death.webp"), `death monster action did not render: ${deathSource}`);
  await assertAudioPlayed(page, "sfx-victory.wav", "victory did not request victory SFX");
  await assertAudioPlayed(page, "sfx-gold.wav", "victory gold reward did not request gold SFX");
  await page.waitForFunction(() => state.activeScreen === "adventure" && state.currentMonster === null);

  await resetAudioProbe(page);
  await page.evaluate(() => {
    state.player.hp = 1;
    state.currentMonster = {
      name: "骷髏兵",
      maxHp: 12,
      hp: 12,
      attack: 99,
      defense: 2,
      strong: false,
      source: "smoke"
    };
    state.activeScreen = "combat";
    render();
    monsterAttack();
    render();
  });
  await page.waitForFunction(() => document.querySelector(".monster-art")?.dataset.monsterAction === "attack");
  await assertAudioPlayed(page, "sfx-defeat.wav", "defeat did not request defeat SFX");
  await page.waitForFunction(() => state.activeScreen === "adventure" && state.currentMonster === null);

  await page.evaluate(() => {
    state.player.hp = 1;
    state.player.gold = 25;
    state.player.relics = ["burialCoin"];
    state.player.relicStates = {};
    state.currentMonster = {
      monsterId: "skeleton",
      name: "骷髏兵",
      maxHp: 12,
      hp: 12,
      attack: 99,
      defense: 2,
      ability: "skeleton",
      statusEffects: {},
      strong: false,
      source: "smoke"
    };
    state.combatLogs = [];
    state.activeScreen = "combat";
    render();
    monsterAttack();
    render();
  });
  await page.waitForFunction(() => state.activeScreen === "adventure" && state.currentMonster === null);
  snapshot = await state(page);
  assert(snapshot.player.gold === 25, "burial coin did not prevent first defeat gold loss");
  assert(snapshot.player.relicStates.burialCoinSpent === true, "burial coin spent state was not recorded");
  assert(snapshot.combatLogs.some(item => item.includes("陪葬金幣")), "burial coin combat log is missing");

  await resetAudioProbe(page);
  await page.evaluate(() => {
    window.__audioProbe.rejectSources = ["bgm-combat.wav", "sfx-potion.wav"];
    state.player.hp = state.player.maxHp;
    state.currentMonster = {
      name: "哥布林",
      maxHp: 30,
      hp: 30,
      attack: 5,
      defense: 2,
      strong: false,
      source: "smoke"
    };
    state.activeScreen = "combat";
    render();
  });
  await page.waitForFunction(() => state.logs.map(formatLogEntry).some(entry => entry.includes("音訊播放受限")));
  await page.evaluate(() => audioController.playSfx("potion"));
  await page.waitForFunction(() => state.logs.map(formatLogEntry).filter(entry => entry.includes("音訊播放受限")).length >= 2);
  await page.evaluate(() => {
    audioController.syncBgm();
    audioController.playSfx("potion");
  });
  await page.waitForTimeout(50);
  const failureState = await page.evaluate(() => ({
    failureLogs: state.logs.map(formatLogEntry).filter(entry => entry.includes("音訊播放受限")).length,
    debug: audioController.getDebugState()
  }));
  assert(failureState.failureLogs === 2, `audio failures were not deduplicated: ${JSON.stringify(failureState)}`);
  await page.getByRole("button", { name: "攻擊", exact: true }).click();
  snapshot = await state(page);
  assert(snapshot.monster && snapshot.monster.hp < 30, "gameplay stopped after media playback rejection");
  await waitForCombatIdle(page);

  const monsterNames = ["史萊姆", "哥布林", "骷髏兵", "野狼", "暗影獸", "腐肉守衛", "墓穴獵手", "黑燭信徒"];
  for (const name of monsterNames) {
    await page.evaluate(monsterName => {
      state.player.hp = state.player.maxHp;
      state.currentMonster = {
        name: monsterName,
        maxHp: 30,
        hp: 30,
        attack: 5,
        defense: 2,
        strong: monsterName === "黑燭信徒",
        source: "smoke"
      };
      state.activeScreen = "combat";
      render();
    }, name);
    await assertImageLoaded(page.locator(".monster-art"), `monster art did not load: ${name}`);
  }
  assert(await page.locator(".scene-stage").evaluate(element => element.classList.contains("strong-enemy")), "strong enemy class is missing");
  assert(await page.getByText("強敵", { exact: false }).isVisible(), "strong enemy marker is missing");

  await page.evaluate(() => {
    state.currentMonster = null;
    state.activeScreen = "adventure";
    state.story.stage = 0;
    render();
  });
  const brokenScene = page.locator(".scene-stage .scene-art");
  await brokenScene.evaluate(image => { image.src = "data:image/webp;base64,AAAA"; });
  await page.waitForFunction(() => document.querySelector(".scene-stage")?.classList.contains("scene-failed"));
  assert(await brokenScene.isHidden(), "broken scene art was not hidden");
  assert(await page.getByRole("button", { name: "進入森林" }).isEnabled(), "scene fallback disabled adventure controls");
  await page.evaluate(() => { render(); });

  await page.evaluate(() => {
    state.currentMonster = {
      name: "史萊姆",
      maxHp: 30,
      hp: 30,
      attack: 5,
      defense: 2,
      strong: false,
      source: "smoke"
    };
    state.activeScreen = "combat";
    render();
  });
  const failedMonster = page.locator(".monster-art");
  await failedMonster.evaluate(image => { image.src = "data:image/webp;base64,AAAA"; });
  await page.waitForFunction(() => document.querySelector(".scene-stage")?.classList.contains("monster-failed"));
  assert(await failedMonster.isHidden(), "broken monster art was not hidden");
  assert(await page.locator(".scene-stage .scene-art").isVisible(), "monster failure incorrectly hid scene art");
  await page.evaluate(() => {
    state.currentMonster = null;
    state.activeScreen = "adventure";
    render();
  });

  await page.screenshot({ path: path.join(artifactDir, "visual-rpg-desktop.png"), fullPage: true });

  await page.evaluate(() => {
    state.player.relics = ["emberCharm", "burialCoin"];
    state.player.relicStates = { burialCoinSpent: true };
    state.currentMonster = null;
    state.activeScreen = "adventure";
    render();
  });
  await page.getByRole("button", { name: "個人資訊", exact: true }).click();
  for (const label of ["玩家等級", "當前經驗值", "升級所需經驗", "當前生命值 / 生命值上限", "攻擊力", "防禦力", "金幣數量", "藥劑數量", "當前劇情進度或冒險狀態"]) {
    assert(await page.getByText(label, { exact: true }).isVisible(), `profile label missing: ${label}`);
  }
  assert(await page.getByText("已獲得遺物", { exact: true }).isVisible(), "profile relic heading is missing");
  assert(await page.getByText("餘燼護符", { exact: true }).isVisible(), "profile relic list is missing ember charm");
  assert(await page.getByRole("heading", { name: "陪葬金幣 (已觸發)", exact: true }).isVisible(), "profile relic list is missing burial coin spent state");

  await page.getByRole("button", { name: "背包", exact: true }).click();
  assert(await page.getByText("遺物收藏", { exact: true }).isVisible(), "inventory relic section is missing");
  assert(await page.getByText("擊敗敵人後恢復 3 點生命。", { exact: true }).isVisible(), "inventory relic description is missing");

  await page.getByLabel("音樂音量").fill("0.25");
  await page.getByLabel("音效音量").fill("0.55");
  await page.getByRole("button", { name: "靜音" }).click();
  let audioSettings = await page.evaluate(() => audioController.getSettings());
  assert(audioSettings.musicVolume === 0.25 && audioSettings.sfxVolume === 0.55 && audioSettings.muted === true, "audio controls did not update settings");
  assert(await page.getByRole("button", { name: "取消靜音" }).getAttribute("aria-pressed") === "true", "mute button aria state mismatch");

  await page.reload();
  await page.waitForLoadState("load");
  audioSettings = await page.evaluate(() => audioController.getSettings());
  assert(audioSettings.musicVolume === 0.25 && audioSettings.sfxVolume === 0.55 && audioSettings.muted === true, "audio settings did not persist after reload");
  assert((await audioPlays(page)).length === 0, "audio played before post-reload unlock");

  await page.evaluate(() => localStorage.setItem("black-candle-audio-v1", JSON.stringify({ muted: "no", musicVolume: 9, sfxVolume: -4 })));
  await page.reload();
  await page.waitForLoadState("load");
  audioSettings = await page.evaluate(() => audioController.getSettings());
  assert(audioSettings.muted === false && audioSettings.musicVolume === 1 && audioSettings.sfxVolume === 0, "invalid persisted settings were not sanitized");
  await page.evaluate(() => localStorage.setItem("black-candle-audio-v1", JSON.stringify({ muted: true, musicVolume: "abc" })));
  await page.reload();
  await page.waitForLoadState("load");
  audioSettings = await page.evaluate(() => audioController.getSettings());
  assert(audioSettings.muted === true && audioSettings.musicVolume === 0.42 && audioSettings.sfxVolume === 0.72, "non-numeric or missing persisted audio settings were not sanitized");
  await page.evaluate(() => audioController.toggleMute());
  await resetAudioProbe(page);
  await page.getByRole("button", { name: "開始冒險" }).click();
  await assertAudioPlayed(page, "bgm-ash-village.wav", "post-sanitization unlock did not request village BGM");
  const sameKeyPlayCount = (await audioPlays(page)).length;
  await page.evaluate(() => {
    render();
    audioController.syncBgm();
    audioController.syncBgm();
  });
  assert((await audioPlays(page)).length === sameKeyPlayCount, "same BGM key was restarted by repeated sync");

  const mobile = await browser.newPage({ viewport: { width: 360, height: 800 } });
  mobile.on("pageerror", error => errors.push(`mobile pageerror: ${error.message}`));
  mobile.on("console", message => {
    if (message.type() === "error") errors.push(`mobile console: ${message.text()}`);
  });
  await mobile.goto(gameUrl);
  await mobile.waitForLoadState("load");
  await mobile.getByRole("button", { name: "商店", exact: true }).click();
  await assertImageLoaded(mobile.locator(".scene-stage .scene-art"), "mobile shop scene art did not load");
  await assertImageLoaded(mobile.locator(".item-icon img"), "mobile potion art did not load");
  const overflow = await mobile.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    clipped: [...document.querySelectorAll("button, .stat, .shop-card, .item-icon, .audio-controls, .audio-slider")]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -0.5 || rect.right > window.innerWidth + 0.5);
      })
      .map(element => ({ text: element.textContent.trim(), rect: element.getBoundingClientRect().toJSON() }))
  }));
  assert(overflow.document <= overflow.viewport && overflow.body <= overflow.viewport, `mobile horizontal overflow: ${JSON.stringify(overflow)}`);
  assert(overflow.clipped.length === 0, `mobile clipped elements: ${JSON.stringify(overflow.clipped)}`);
  await mobile.screenshot({ path: path.join(artifactDir, "visual-rpg-mobile.png"), fullPage: true });

  assert(errors.length === 0, `browser errors: ${errors.join(" | ")}`);
  console.log("browser smoke: PASS");
  console.log("screenshots: artifacts/visual-rpg-desktop.png, artifacts/visual-rpg-mobile.png, artifacts/visual-rpg-combat.png");
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
