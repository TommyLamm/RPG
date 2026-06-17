
    const app = document.getElementById("app");
    const gameAnnouncer = document.getElementById("game-announcer");
    const MAX_LEVEL = 100;
    const POTION_PRICE = 15;
    const POTION_HEAL = { min: 5, max: 18 };
    const monsterNames = ["史莱姆", "哥布林", "骷髅兵", "野狼", "暗影兽", "腐肉守卫", "墓穴猎手", "黑烛信徒"];
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
    const defaultSceneAsset = sceneAssets[0];
    const knownSceneAssets = new Set([...sceneAssets, SHOP_SCENE_ASSET]);
    const SCREENS = {
      main: "主界面",
      adventure: "剧情冒险",
      combat: "战斗",
      shop: "商店",
      profile: "个人信息",
      inventory: "背包"
    };

    const stages = [
      {
        name: "灰烬村入口",
        description: "塌陷的木门半掩着，黑蜡沿门缝凝成冷硬的痕迹。"
      },
      {
        name: "腐烂森林",
        description: "腐叶与雾气覆盖小径，枯枝深处偶尔传来拖行声。"
      },
      {
        name: "潮湿洞穴",
        description: "水滴敲在石面上，回声像有人在更深处低语。"
      },
      {
        name: "旧王墓穴",
        description: "石棺环绕着熄灭的祭台，墓壁上的王冠纹章仍有余温。"
      }
    ];

    const state = {
      activeScreen: "main",
      player: {
        level: 1,
        maxLevel: 100,
        maxHp: 20,
        hp: 20,
        attack: 5,
        defense: 3,
        exp: 0,
        gold: 30,
        potions: 0
      },
      story: {
        stage: 0,
        progress: 0,
        status: "灰烬村入口",
        clueFound: false,
        keyFragment: false
      },
      currentMonster: null,
      logs: ["新手指南：先从主界面进入剧情冒险，熟悉村口、森林与洞穴的危险。"],
      combatLogs: []
    };
    let logRevision = 0;
    let combatLogRevision = 0;
    let lastAnnouncedLogRevision = 0;
    let lastAnnouncedCombatLogRevision = 0;

    function rand(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function nextLevelExp(level = state.player.level) {
      if (level >= MAX_LEVEL) {
        return 0;
      }

      return 20 + (level - 1) * 15;
    }

    function experienceText() {
      if (state.player.level >= MAX_LEVEL) {
        return "MAX";
      }

      return `${state.player.exp} / ${nextLevelExp()}`;
    }

    function calculateDamage(attack, defense) {
      return Math.max(1, attack - defense);
    }

    function meter(current, max, kind = "") {
      const safeMax = Math.max(1, max);
      const percentage = clamp((current / safeMax) * 100, 0, 100);
      const className = kind ? `meter ${kind}` : "meter";

      return `<div class="${className}" aria-hidden="true"><span style="width: ${percentage}%"></span></div>`;
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function currentStage() {
      const rawStage = Number(state.story.stage);
      const safeStage = Number.isFinite(rawStage) ? Math.floor(rawStage) : 0;
      const stageIndex = clamp(safeStage, 0, stages.length - 1);
      return stages[stageIndex] || stages[0];
    }

    function currentSceneAsset() {
      const rawStage = Number(state.story.stage);
      const safeStage = Number.isFinite(rawStage) ? Math.floor(rawStage) : 0;
      const stageIndex = clamp(safeStage, 0, sceneAssets.length - 1);
      return sceneAssets[stageIndex] || sceneAssets[0];
    }

    function monsterAsset(name) {
      const baseName = String(name || "")
        .replace(/^强敌\s*/, "")
        .replace(/（强敌）$/, "")
        .trim();
      return monsterAssets[baseName] || "";
    }

    function handleAssetError(image) {
      image.hidden = true;
      const visual = image.closest("[data-visual]");

      if (image.classList.contains("scene-art")) {
        visual?.classList.add("scene-failed");
      } else if (image.classList.contains("monster-art")) {
        visual?.classList.add("monster-failed");
      } else if (image.classList.contains("potion-art")) {
        visual?.classList.add("potion-failed");
      }
    }

    function handleAssetLoad(image) {
      image.hidden = false;
    }

    function renderPotionImage(className = "potion-art") {
      return `<img class="${escapeHtml(className)}" src="${POTION_ASSET}" alt="黑烛药剂" decoding="async" hidden onload="handleAssetLoad(this)" onerror="handleAssetError(this)">`;
    }

    function renderSceneStage({ scene, location, status, monster = null, compact = false }) {
      const requestedScene = String(scene || "");
      const sceneSource = escapeHtml(knownSceneAssets.has(requestedScene) ? requestedScene : defaultSceneAsset);
      const locationLabel = escapeHtml(location || "未知区域");
      const statusLabel = escapeHtml(status || "");
      const monsterName = monster ? String(monster.name || "") : "";
      const monsterSource = monsterAsset(monsterName);
      const strongEnemy = Boolean(monster && monster.strong);
      const stageClasses = ["scene-stage", compact ? "compact" : "", strongEnemy ? "strong-enemy" : ""]
        .filter(Boolean)
        .join(" ");

      return `
        <div class="${stageClasses}" data-visual="scene-stage">
          <img class="scene-art" src="${sceneSource}" alt="" loading="eager" decoding="async" hidden onload="handleAssetLoad(this)" onerror="handleAssetError(this)">
          ${monster && monsterSource ? `<img class="monster-art" src="${escapeHtml(monsterSource)}" alt="${escapeHtml(monsterName)}" loading="eager" decoding="async" hidden onload="handleAssetLoad(this)" onerror="handleAssetError(this)">` : ""}
          <div class="scene-caption">
            <div class="scene-copy">
              <span class="scene-location">${locationLabel}</span>
              ${statusLabel ? `<span class="scene-status">${statusLabel}</span>` : ""}
            </div>
            ${strongEnemy ? '<span class="danger-marker">强敌</span>' : ""}
          </div>
        </div>
      `;
    }

    function sceneStage(options) {
      return renderSceneStage(options);
    }

    function addLog(message) {
      state.logs.unshift(message);
      state.logs = state.logs.slice(0, 8);
      logRevision += 1;
    }

    function addCombatLog(message) {
      state.combatLogs.push(message);
      state.combatLogs = state.combatLogs.slice(-8);
      combatLogRevision += 1;
    }

    function buttonFocusKey(button) {
      const action = button.getAttribute("onclick") || "";
      const label = button.textContent.trim().replace(/\s+/g, " ");
      return `${action}|${label}`;
    }

    function updateGameAnnouncer() {
      const latestLog = state.logs[0] || "";
      const latestCombatLog = state.combatLogs[state.combatLogs.length - 1] || "";
      const messages = [];

      if (logRevision !== lastAnnouncedLogRevision && latestLog) {
        messages.push(latestLog);
      }

      if (combatLogRevision !== lastAnnouncedCombatLogRevision && latestCombatLog) {
        messages.push(latestCombatLog);
      }

      lastAnnouncedLogRevision = logRevision;
      lastAnnouncedCombatLogRevision = combatLogRevision;

      if (messages.length) {
        const announcement = messages.join(" ");
        gameAnnouncer.textContent = "";
        queueMicrotask(() => {
          gameAnnouncer.textContent = announcement;
        });
      }
    }

    function hasActiveCombat() {
      return Boolean(state.currentMonster && state.currentMonster.hp > 0 && state.player.hp > 0);
    }

    function setScreen(screen) {
      if (!SCREENS[screen]) {
        return;
      }

      if (screen !== "combat" && hasActiveCombat()) {
        state.activeScreen = "combat";
        addCombatLog("战斗尚未结束，只能攻击、使用药品或尝试逃跑。");
        render();
        return;
      }

      state.activeScreen = screen;
      render();
    }

    function advanceStory(reason) {
      state.story.progress += 1;

      if (state.story.stage === 0 && state.story.progress >= 2) {
        state.story.stage = 1;
        state.story.status = "腐烂森林";
        addLog("腐烂森林的雾墙散开，村外旧路终于露出轮廓。");
        return;
      }

      if (state.story.stage === 1 && state.story.progress >= 5) {
        state.story.stage = 2;
        state.story.status = "潮湿洞穴";
        addLog("潮湿洞穴传来空洞回声，黑蜡痕迹一路延伸到地下。");
        return;
      }

      if (state.story.stage === 2 && state.story.progress >= 9) {
        state.story.stage = 3;
        state.story.status = "旧王墓穴";
        addLog("旧王墓穴的石门缓缓错开，冷风卷着残烛气味扑面而来。");
        return;
      }

      if (reason) {
        addLog(reason);
      }
    }

    function gainGold(amount, reason) {
      state.player.gold += amount;
      addLog(`${reason} 获得 ${amount} 金币。`);
    }

    function gainPotion(reason) {
      state.player.potions += 1;
      addLog(`${reason} 你找到了一瓶治疗药水。`);
    }

    function restAtVillage() {
      const { player } = state;

      if (player.hp >= player.maxHp) {
        addLog("你在村口短暂歇脚，但生命值已满，无需治疗。");
      } else {
        const missingHp = player.maxHp - player.hp;
        const restoredHp = Math.min(Math.ceil(player.maxHp * 0.35), missingHp);
        player.hp += restoredHp;
        addLog(`你靠着余烬休息片刻，恢复 ${restoredHp} 点生命。`);
      }

      state.activeScreen = "adventure";
    }

    function resolveAdventureEvent(source) {
      if (source === "village") {
        const event = rand(1, 3);

        if (event === 1) {
          gainGold(rand(4, 9), "你帮村民清理封门黑蜡，");
        } else if (event === 2) {
          gainPotion("你在废弃药柜里翻找，");
        } else {
          advanceStory("村井边的老人低声提醒你：森林里的烛影会跟着活人移动。");
          return;
        }

        advanceStory();
        return;
      }

      if (source === "forest" && state.story.stage === 0) {
        addLog("第一只腐枝怪从雾里扑出，通往森林的路必须用武器打开。");
        startCombat(false, "forest");
        return;
      }

      if (source === "cave" && state.story.stage < 1) {
        addLog("洞穴入口被腐藤和黑蜡封住，先调查森林才能找到入口。");
        return;
      }

      if (source === "deep" && state.story.stage < 2) {
        addLog("更深处的石阶沉在积水下，缺少洞穴线索前无法继续。");
        return;
      }

      const roll = rand(1, 100);

      if (roll <= 34) {
        startCombat(false, source);
        return;
      }

      if (roll <= 52) {
        startCombat(true, source);
        return;
      }

      if (roll <= 70) {
        gainGold(rand(6, 14), "你在裂开的石缝里摸到旧钱袋，");
        advanceStory();
        return;
      }

      if (roll <= 84) {
        gainPotion("你沿着干涸血迹搜寻，");
        advanceStory();
        return;
      }

      if (state.story.stage >= 2) {
        state.story.keyFragment = true;
        advanceStory("特殊剧情：你从墓纹碎片里拼出旧王印记的一角。");
        return;
      }

      if (state.story.stage >= 1) {
        state.story.clueFound = true;
        advanceStory("特殊剧情：你记下黑蜡祭祀留下的洞穴暗号。");
        return;
      }

      advanceStory("你听见远处钟声倒响，像是有人在催促你继续前进。");
    }

    function handleAdventureChoice(choice) {
      if (choice === "rest") {
        restAtVillage();
      } else {
        resolveAdventureEvent(choice);
      }

      if (state.activeScreen !== "combat") {
        render();
      }
    }

    function generateMonster(strong = false, source = "wild") {
      const playerLevel = state.player.level;
      let attack = 5;
      let defense = 2;

      for (let level = 2; level <= playerLevel; level += 1) {
        attack += rand(1, 4);
        defense += rand(1, 4);
      }

      let maxHp = 14 + playerLevel * 5 + rand(0, playerLevel * 3);

      if (strong) {
        maxHp = Math.ceil(maxHp * 1.35);
        attack += 2;
        defense += 1;
      }

      return {
        name: monsterNames[rand(0, monsterNames.length - 1)],
        maxHp,
        hp: maxHp,
        attack,
        defense,
        strong,
        source
      };
    }

    function startCombat(strong = false, source = "wild") {
      if (hasActiveCombat()) {
        state.activeScreen = "combat";
        render();
        return;
      }

      const monster = generateMonster(strong, source);
      state.currentMonster = monster;
      state.combatLogs = [];
      addCombatLog(`${monster.strong ? "强敌" : "敌人"} ${monster.name} 从阴影中逼近。`);
      state.activeScreen = "combat";
      render();
    }

    function playerAttack() {
      const monster = state.currentMonster;

      if (state.activeScreen !== "combat" || !monster || monster.hp <= 0) {
        addCombatLog("战斗已经结束。");
        render();
        return;
      }

      const damage = calculateDamage(state.player.attack, monster.defense);
      monster.hp = Math.max(0, monster.hp - damage);
      addCombatLog(`你攻击 ${monster.name}，造成 ${damage} 点伤害。`);

      if (monster.hp <= 0) {
        finishVictory();
        return;
      }

      monsterAttack();
      render();
    }

    function monsterAttack() {
      const monster = state.currentMonster;

      if (!monster || monster.hp <= 0) {
        return;
      }

      const damage = calculateDamage(monster.attack, state.player.defense);
      state.player.hp = Math.max(0, state.player.hp - damage);
      addCombatLog(`${monster.name} 反击，造成 ${damage} 点伤害。`);

      if (state.player.hp <= 0) {
        handleDefeat();
      }
    }

    function finishVictory() {
      const monster = state.currentMonster;

      if (!monster) {
        return;
      }

      const multiplier = monster.strong ? 1.5 : 1;
      const expReward = Math.ceil(rand(2, 10) * multiplier);
      const goldReward = Math.ceil(rand(5, 20) * multiplier);
      state.player.exp += expReward;
      state.player.gold += goldReward;

      addCombatLog(`你击败了 ${monster.name}，获得 ${expReward} 经验和 ${goldReward} 金币。`);
      addLog(`战斗胜利：击败 ${monster.name}，获得 ${expReward} 经验和 ${goldReward} 金币。`);
      state.currentMonster = null;
      advanceStory(`你从战斗余烬中辨认出通往${currentStage().name}深处的新痕迹。`);
      checkLevelUps();
      state.activeScreen = "adventure";
      render();
    }

    function handleDefeat() {
      const monster = state.currentMonster;
      const lostGold = Math.min(state.player.gold, rand(3, 10));
      state.player.gold -= lostGold;
      state.player.hp = 1;
      addCombatLog(`你被${monster ? monster.name : "敌人"}击倒，失去 ${lostGold} 金币后勉强逃回安全处。`);
      addLog(`战斗失败：你失去 ${lostGold} 金币，生命值降至 1。`);
      state.currentMonster = null;
      state.activeScreen = "adventure";
    }

    function tryFlee() {
      const monster = state.currentMonster;

      if (!monster) {
        addCombatLog("没有敌人阻拦你。");
        state.activeScreen = "adventure";
        render();
        return;
      }

      if (rand(1, 100) <= 60) {
        addCombatLog(`你摆脱了 ${monster.name}，撤回安全路线。`);
        addLog("你选择撤退，保住了继续探索的机会。");
        state.currentMonster = null;
        state.activeScreen = "adventure";
        render();
        return;
      }

      addCombatLog("逃跑失败，敌人抓住破绽追击。");
      monsterAttack();
      render();
    }

    function checkLevelUps() {
      const { player } = state;

      while (player.level < MAX_LEVEL && player.exp >= nextLevelExp(player.level)) {
        const neededExp = nextLevelExp(player.level);
        player.exp -= neededExp;
        player.level += 1;

        const attackIncrease = rand(1, 3);
        const defenseIncrease = rand(1, 2);
        const hpIncrease = rand(2, 5);
        player.attack += attackIncrease;
        player.defense += defenseIncrease;
        player.maxHp += hpIncrease;

        const restoredHp = Math.min(player.maxHp - player.hp, Math.ceil(hpIncrease * 0.5) + 4);
        player.hp += restoredHp;
        addLog(`升级到 ${player.level} 级：攻击 +${attackIncrease}，防御 +${defenseIncrease}，生命上限 +${hpIncrease}，恢复 ${restoredHp} 点生命。`);
      }

      if (player.level >= MAX_LEVEL) {
        player.exp = 0;
      }
    }

    function buyPotion() {
      const { player } = state;

      if (player.gold < POTION_PRICE) {
        addLog(`金币不足：黑烛药剂需要 ${POTION_PRICE} 金币。`);
        render();
        return;
      }

      player.gold -= POTION_PRICE;
      player.potions += 1;
      addLog(`购买黑烛药剂，花费 ${POTION_PRICE} 金币。`);
      render();
    }

    function usePotion(context = "inventory") {
      const { player } = state;

      if (context !== "inventory" && context !== "combat") {
        addLog("无法使用药品：无效的使用方式。");
        render();
        return;
      }

      if (context === "combat" && (state.activeScreen !== "combat" || !hasActiveCombat())) {
        addLog("当前没有进行中的战斗，无法使用战斗药品操作。");
        render();
        return;
      }

      if (context === "inventory" && hasActiveCombat()) {
        state.activeScreen = "combat";
        addCombatLog("战斗尚未结束，请使用战斗界面的“使用药品”操作。");
        render();
        return;
      }

      const log = context === "combat" ? addCombatLog : addLog;

      if (player.potions <= 0) {
        log("背包里没有黑烛药剂。");
        render();
        return;
      }

      if (player.hp >= player.maxHp) {
        log("生命值已满，没有消耗药剂。");
        render();
        return;
      }

      const healed = Math.min(rand(POTION_HEAL.min, POTION_HEAL.max), player.maxHp - player.hp);
      player.hp += healed;
      player.potions -= 1;
      log(`使用黑烛药剂，恢复 ${healed} 点生命值。`);

      if (context === "combat" && hasActiveCombat()) {
        monsterAttack();
      }

      render();
    }

    function renderStatBar() {
      const { player } = state;

      return `
        <div class="quick-stats" aria-label="角色状态">
          <div class="stat"><span>等级</span><strong>${player.level}</strong></div>
          <div class="stat"><span>生命</span><strong>${player.hp} / ${player.maxHp}</strong></div>
          <div class="stat"><span>经验</span><strong>${experienceText()}</strong></div>
          <div class="stat"><span>金币</span><strong>${player.gold}</strong></div>
          <div class="stat"><span>药品</span><strong>${player.potions}</strong></div>
        </div>
      `;
    }

    function renderNav() {
      const navButton = (screen) => {
        const current = state.activeScreen === screen ? ' aria-current="page"' : "";
        const disabled = hasActiveCombat() && screen !== "combat" ? " disabled" : "";
        return `<button type="button" onclick="setScreen('${screen}')"${current}${disabled}>${SCREENS[screen]}</button>`;
      };

      return `
        <nav class="nav" aria-label="主要导航">
          ${navButton("main")}
          ${navButton("adventure")}
          ${navButton("shop")}
          ${navButton("profile")}
          ${navButton("inventory")}
        </nav>
      `;
    }

    function renderLogs() {
      return `
        <aside class="log-panel">
          <h2>日志</h2>
          <div class="log-list" role="log" aria-live="polite" aria-relevant="additions text">
            ${state.logs.map((entry) => `<p>${escapeHtml(entry)}</p>`).join("")}
          </div>
        </aside>
      `;
    }

    function renderMain() {
      return `
        <section class="panel">
          <h2>${SCREENS.main}</h2>
          ${renderSceneStage({
            scene: currentSceneAsset(),
            location: currentStage().name,
            status: state.story.status
          })}
          <p class="muted">潮湿石墙吞下脚步声。这里将显示探索、战斗与休整内容。</p>
          <div class="guide">
            新玩家指南：先进入剧情冒险推进当前进度，受伤后回到村庄休息；金币可在商店购买治疗药水。
          </div>
          <div class="actions">
            <button type="button" onclick="setScreen('adventure')">开始冒险</button>
            <button type="button" onclick="setScreen('shop')">前往商店</button>
            <button type="button" onclick="setScreen('profile')">查看个人信息</button>
          </div>
        </section>
      `;
    }

    function renderAdventure() {
      const stage = currentStage();

      return `
        <section class="panel">
          <h2>${stage.name}</h2>
          ${renderSceneStage({
            scene: currentSceneAsset(),
            location: stage.name,
            status: state.story.status
          })}
          <p>${stage.description}</p>
          <div class="info-grid">
            <div><strong>已推进事件</strong><br>${state.story.progress} 次</div>
            <div><strong>当前状态</strong><br>${state.story.status}</div>
          </div>
          <div class="actions">
            <button type="button" onclick="handleAdventureChoice('forest')">进入森林</button>
            <button type="button" onclick="handleAdventureChoice('cave')" ${state.story.stage < 1 ? "disabled" : ""}>探索洞穴</button>
            <button type="button" onclick="handleAdventureChoice('village')">前往村庄</button>
            <button type="button" onclick="handleAdventureChoice('challenge')">挑战怪物</button>
            <button type="button" onclick="handleAdventureChoice('rest')">返回休息</button>
            <button type="button" onclick="handleAdventureChoice('deep')" ${state.story.stage < 2 ? "disabled" : ""}>继续深入</button>
          </div>
        </section>
      `;
    }

    function renderCombat() {
      const { player } = state;
      const monster = state.currentMonster;
      const potionDisabled = player.potions <= 0 || player.hp >= player.maxHp ? " disabled" : "";

      if (!monster) {
        return `
          <section class="panel">
            <h2>战斗界面</h2>
            <p class="muted">当前没有敌人。</p>
            <div class="actions">
              <button type="button" onclick="setScreen('adventure')">返回冒险</button>
            </div>
            <h3>战斗日志</h3>
            <div class="combat-log" role="log" aria-live="polite">
              ${state.combatLogs.length ? state.combatLogs.map((entry) => `<p>${escapeHtml(entry)}</p>`).join("") : "<p>暂无战斗记录。</p>"}
            </div>
          </section>
        `;
      }

      return `
        <section class="panel">
          <h2>战斗界面</h2>
          ${renderSceneStage({
            scene: currentSceneAsset(),
            location: currentStage().name,
            status: "战斗中",
            monster
          })}
          <div class="combat-grid">
            <div class="combatant">
              <h3>玩家</h3>
              <p>HP：${player.hp} / ${player.maxHp}</p>
              ${meter(player.hp, player.maxHp)}
              <p>攻击力：${player.attack}</p>
              <p>防御力：${player.defense}</p>
            </div>
            <div class="combatant danger">
              <h3${monster.strong ? ` aria-label="${escapeHtml(`${monster.name}（强敌）`)}"` : ""}>${escapeHtml(monster.name)}</h3>
              <p>HP：${monster.hp} / ${monster.maxHp}</p>
              ${meter(monster.hp, monster.maxHp, "enemy")}
              <p>攻击力：${monster.attack}</p>
              <p>防御力：${monster.defense}</p>
            </div>
          </div>
          <div class="actions">
            <button type="button" onclick="playerAttack()">攻击</button>
            <button type="button" onclick="usePotion('combat')"${potionDisabled}>使用药品</button>
            <button type="button" onclick="tryFlee()">逃跑</button>
          </div>
          <h3>战斗日志</h3>
          <div class="combat-log" role="log" aria-live="polite">
            ${state.combatLogs.length ? state.combatLogs.map((entry) => `<p>${escapeHtml(entry)}</p>`).join("") : "<p>暂无战斗记录。</p>"}
          </div>
        </section>
      `;
    }

    function renderShop() {
      const cannotAfford = state.player.gold < POTION_PRICE;
      const purchaseDisabled = cannotAfford ? " disabled" : "";

      return `
        <section class="panel">
          <h2>商店界面</h2>
          ${renderSceneStage({
            scene: SHOP_SCENE_ASSET,
            location: "黑烛商店",
            status: "灰烬村"
          })}
          <p class="muted">黑蜡烛光映着货架，店主悄声递出一瓶仍有温度的药剂。</p>
          <div class="shop-card">
            <div class="item-icon" data-visual="potion">${renderPotionImage("potion-art")}</div>
            <div>
              <h3>黑烛药剂</h3>
              <p>药品售价：${POTION_PRICE} 金币</p>
              <p>随机恢复 ${POTION_HEAL.min} 到 ${POTION_HEAL.max} 点生命值</p>
              <p class="muted">恢复量不会超过生命值上限。</p>
              ${cannotAfford ? `<p class="muted">金币不足：黑烛药剂需要 ${POTION_PRICE} 金币。</p>` : ""}
            </div>
            <div class="actions">
              <button type="button" onclick="buyPotion()"${purchaseDisabled}>购买</button>
            </div>
          </div>
        </section>
      `;
    }

    function renderProfile() {
      const { player, story } = state;

      return `
        <section class="panel">
          <h2>${SCREENS.profile}</h2>
          ${renderSceneStage({
            scene: currentSceneAsset(),
            location: currentStage().name,
            status: story.status,
            compact: true
          })}
          <div class="info-grid">
            <div><strong>玩家等级</strong><br>${player.level} / ${player.maxLevel}</div>
            <div><strong>当前经验值</strong><br>${player.exp}</div>
            <div><strong>升级所需经验</strong><br>${player.level >= MAX_LEVEL ? "已达上限" : nextLevelExp()}</div>
            <div><strong>当前生命值 / 生命值上限</strong><br>${player.hp} / ${player.maxHp}</div>
            <div><strong>攻击力</strong><br>${player.attack}</div>
            <div><strong>防御力</strong><br>${player.defense}</div>
            <div><strong>金币数量</strong><br>${player.gold}</div>
            <div><strong>药品数量</strong><br>${player.potions}</div>
            <div><strong>当前剧情进度或冒险状态</strong><br>${story.status}</div>
          </div>
        </section>
      `;
    }

    function renderInventory() {
      const { player: p } = state;
      const disabled = p.potions <= 0 || p.hp >= p.maxHp ? " disabled" : "";

      return `
        <section class="panel">
          <h2>背包或道具使用界面</h2>
          <div class="shop-card">
            <div class="item-icon" data-visual="potion">${renderPotionImage("potion-art")}</div>
            <div>
              <h3>黑烛药剂 x ${p.potions}</h3>
              <p>随机恢复 ${POTION_HEAL.min} 到 ${POTION_HEAL.max} 点生命值</p>
              <p class="muted">当前生命值：${p.hp} / ${p.maxHp}</p>
            </div>
            <div class="actions">
              <button type="button" onclick="usePotion('inventory')"${disabled}>使用药品</button>
            </div>
          </div>
        </section>
      `;
    }

    function renderActiveScreen() {
      if (state.activeScreen === "adventure") {
        return renderAdventure();
      }

      if (state.activeScreen === "combat") {
        return renderCombat();
      }

      if (state.activeScreen === "shop") {
        return renderShop();
      }

      if (state.activeScreen === "profile") {
        return renderProfile();
      }

      if (state.activeScreen === "inventory") {
        return renderInventory();
      }

      return renderMain();
    }

    function render() {
      const activeButton = app.contains(document.activeElement) && document.activeElement.tagName === "BUTTON"
        ? document.activeElement
        : null;
      const focusKey = activeButton ? buttonFocusKey(activeButton) : "";

      app.innerHTML = `
        <header class="topbar">
          <div class="brand">
            <div class="brand-row">
              <svg class="black-candle-sigil" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
                <path d="M32 6 45 18 58 20 50 32 53 48 38 45 32 58 26 45 11 48 14 32 6 20 19 18Z" fill="#070605" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
                <path d="M32 14c4 5 3 8 0 11-3-3-4-6 0-11Z" fill="#d6a84f"/>
                <path d="M25 26h14v18H25z" fill="#0e0b09" stroke="#6f8760" stroke-width="2"/>
                <path d="M23 46h18M28 30h8M32 26v20" stroke="#7e91a0" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <h1>黑烛地牢</h1>
            </div>
            <p>黑蜡封住村门，墓穴深处仍有烛火。</p>
          </div>
          ${renderStatBar()}
        </header>
        ${renderNav()}
        <main class="layout">
          ${renderActiveScreen()}
          ${renderLogs()}
        </main>
      `;

      if (focusKey) {
        const focusTarget = Array.from(app.querySelectorAll("button"))
          .find((button) => buttonFocusKey(button) === focusKey);

        if (focusTarget && !focusTarget.disabled) {
          focusTarget.focus();
        } else {
          const screenHeading = app.querySelector(".panel h2");

          if (screenHeading) {
            screenHeading.tabIndex = -1;
            screenHeading.focus();
          }
        }
      }

      updateGameAnnouncer();
    }

    render();
  
