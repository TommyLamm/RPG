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
    state.player.hp = state.player.maxHp;
    state.player.potions = 1;
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
    render();
  });

  await page.getByRole("button", { name: "商店", exact: true }).click();
  assert(await page.getByRole("heading", { name: "商店介面" }).isVisible(), "shop did not open");
  await assertImageLoaded(page.locator(".scene-stage .scene-art"), "shop scene art did not load");
  await assertImageLoaded(page.locator(".item-icon img"), "shop potion art did not load");
  await page.getByRole("button", { name: "購買" }).click();
  let snapshot = await state(page);
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
    state.player.hp = state.player.maxHp;
    state.player.potions = 1;
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

  await page.getByRole("button", { name: "個人資訊", exact: true }).click();
  for (const label of ["玩家等級", "當前經驗值", "升級所需經驗", "當前生命值 / 生命值上限", "攻擊力", "防禦力", "金幣數量", "藥劑數量", "當前劇情進度或冒險狀態"]) {
    assert(await page.getByText(label, { exact: true }).isVisible(), `profile label missing: ${label}`);
  }

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
