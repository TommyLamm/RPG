# Dark Dungeon Text RPG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete dark dungeon text RPG adventure game that runs directly from `index.html` in a browser.

**Architecture:** Use a single static HTML file with embedded CSS and JavaScript. JavaScript owns all game state, renders one active screen at a time, and writes narrative/combat messages to shared logs. The game avoids external dependencies so it works by double-clicking the file.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, PowerShell static verification commands.

---

## File Structure

- Create: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`
  - Contains document structure, visual styling, game state, render functions, and all action handlers.
- Read-only reference: `F:/Desktop/RPG/GPT 5.5 Codex/docs/superpowers/specs/2026-05-18-dark-dungeon-rpg-design.md`
  - Source of product requirements and verification checklist.

No build config, package manager files, or external assets are required.

## Task 1: Static App Shell

**Files:**
- Create: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`

- [ ] **Step 1: Verify the deliverable does not exist yet**

Run:

```powershell
Test-Path 'index.html'
```

Expected: `False` in the current empty workspace.

- [ ] **Step 2: Create the initial HTML shell**

Create `index.html` with this structure:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>黑烛地牢 | 文字 RPG</title>
  <style>
    :root {
      --bg: #090807;
      --panel: #15110f;
      --panel-2: #211813;
      --line: #4c3025;
      --text: #efe3cf;
      --muted: #a89478;
      --gold: #d6a74f;
      --rust: #a43d2f;
      --blood: #c33131;
      --poison: #87a85d;
      --shadow: rgba(0, 0, 0, 0.48);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at 20% 10%, rgba(164, 61, 47, 0.2), transparent 28rem),
        linear-gradient(135deg, #070605, #120d0b 50%, #080706);
      font-family: "Microsoft YaHei", "Noto Sans SC", sans-serif;
    }

    button {
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--text);
      background: linear-gradient(180deg, #3a231c, #1c1310);
      padding: 0.72rem 0.9rem;
      cursor: pointer;
      font-weight: 700;
    }

    button:hover { border-color: var(--gold); transform: translateY(-1px); }
    button:disabled { opacity: 0.48; cursor: not-allowed; transform: none; }

    .app {
      width: min(1180px, calc(100vw - 24px));
      margin: 0 auto;
      padding: 24px 0;
    }

    .topbar, .panel, .log-panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(21, 17, 15, 0.94);
      box-shadow: 0 18px 50px var(--shadow);
    }

    .topbar {
      display: grid;
      gap: 12px;
      grid-template-columns: 1fr auto;
      align-items: center;
      padding: 16px;
      margin-bottom: 16px;
    }

    .brand h1 { margin: 0; font-size: clamp(1.7rem, 4vw, 3rem); letter-spacing: 0; }
    .brand p { margin: 6px 0 0; color: var(--muted); }

    .quick-stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(82px, 1fr));
      gap: 8px;
      min-width: min(620px, 100%);
    }

    .stat {
      border: 1px solid rgba(214, 167, 79, 0.25);
      border-radius: 6px;
      padding: 8px;
      background: #110d0b;
    }

    .stat span { display: block; color: var(--muted); font-size: 0.78rem; }
    .stat strong { display: block; margin-top: 3px; font-size: 1rem; }

    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 330px;
      gap: 16px;
      align-items: start;
    }

    .panel, .log-panel { padding: 18px; }
    .panel h2, .log-panel h2 { margin: 0 0 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
    .muted { color: var(--muted); }

    @media (max-width: 860px) {
      .topbar { grid-template-columns: 1fr; }
      .quick-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .layout { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div id="app" class="app"></div>
  <script>
    const app = document.getElementById("app");

    function render() {
      app.innerHTML = `
        <section class="topbar">
          <div class="brand">
            <h1>黑烛地牢</h1>
            <p>黑蜡封住村门，墓穴深处仍有烛火。</p>
          </div>
          <div class="quick-stats" aria-label="玩家状态">
            <div class="stat"><span>等级</span><strong>1</strong></div>
            <div class="stat"><span>生命</span><strong>20 / 20</strong></div>
            <div class="stat"><span>经验</span><strong>0 / 35</strong></div>
            <div class="stat"><span>金币</span><strong>30</strong></div>
            <div class="stat"><span>药品</span><strong>0</strong></div>
          </div>
        </section>
        <nav class="nav" aria-label="主导航">
          <button>主界面</button>
          <button>剧情冒险</button>
          <button>商店</button>
          <button>个人信息</button>
          <button>背包</button>
        </nav>
        <main class="layout">
          <section class="panel">
            <h2>主界面</h2>
            <p class="muted">游戏系统将在后续任务中接入。</p>
          </section>
          <aside class="log-panel">
            <h2>日志</h2>
            <p class="muted">黑烛还没有完全点燃。</p>
          </aside>
        </main>
      `;
    }

    render();
  </script>
</body>
</html>
```

- [ ] **Step 3: Verify the shell contains required root elements**

Run:

```powershell
Select-String -Path 'index.html' -Pattern '<div id="app"','黑烛地牢','主界面','剧情冒险','商店','个人信息','背包'
```

Expected: one or more matches for each pattern.

- [ ] **Step 4: Git checkpoint**

Run:

```powershell
git status --short
```

Expected in this workspace: `fatal: not a git repository`. Record that commit is skipped because the workspace is not initialized as Git.

## Task 2: Game State, Utilities, And Screen Rendering

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`

- [ ] **Step 1: Write static verification for required JavaScript symbols**

Run before editing:

```powershell
Select-String -Path 'index.html' -Pattern 'const state','function nextLevelExp','function calculateDamage','function renderMain','function renderAdventure','function renderCombat','function renderShop','function renderProfile','function renderInventory'
```

Expected: no matches for the new symbols before this task.

- [ ] **Step 2: Replace the initial `<script>` block with stateful rendering**

Implement these JavaScript sections in `index.html`:

```javascript
const app = document.getElementById("app");

const MAX_LEVEL = 100;
const POTION_PRICE = 15;
const POTION_HEAL = { min: 5, max: 18 };
const SCREENS = {
  main: "主界面",
  adventure: "剧情冒险",
  combat: "战斗",
  shop: "商店",
  profile: "个人信息",
  inventory: "背包"
};

const stages = [
  { name: "灰烬村入口", description: "黑蜡封住村门，旧井下传来潮湿的回声。" },
  { name: "腐烂森林", description: "树枝挂满黑烛残芯，泥地里有拖行的痕迹。" },
  { name: "潮湿洞穴", description: "洞壁渗着冷水，远处铁链擦过石面。" },
  { name: "旧王墓穴", description: "王墓门缝里有烛光，像有人仍在守夜。" }
];

const state = {
  screen: "main",
  player: {
    level: 1,
    maxLevel: MAX_LEVEL,
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
  logs: ["新手引导：先进入剧情冒险，探索后可战斗、获得金币和经验。"],
  combatLogs: []
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nextLevelExp(level = state.player.level) {
  return level >= MAX_LEVEL ? 0 : 20 + level * 15;
}

function calculateDamage(attack, defense) {
  return Math.max(1, attack - defense);
}

function addLog(message) {
  state.logs.unshift(message);
  state.logs = state.logs.slice(0, 10);
}

function addCombatLog(message) {
  state.combatLogs.unshift(message);
  state.combatLogs = state.combatLogs.slice(0, 8);
}

function setScreen(screen) {
  if (screen !== "combat") state.currentMonster = screen === "adventure" ? state.currentMonster : null;
  state.screen = screen;
  render();
}

function renderStatBar() {
  const p = state.player;
  const expTarget = nextLevelExp();
  return `
    <div class="quick-stats" aria-label="玩家状态">
      <div class="stat"><span>等级</span><strong>${p.level} / ${p.maxLevel}</strong></div>
      <div class="stat"><span>生命</span><strong>${p.hp} / ${p.maxHp}</strong></div>
      <div class="stat"><span>经验</span><strong>${p.level >= MAX_LEVEL ? "MAX" : `${p.exp} / ${expTarget}`}</strong></div>
      <div class="stat"><span>金币</span><strong>${p.gold}</strong></div>
      <div class="stat"><span>药品</span><strong>${p.potions}</strong></div>
    </div>
  `;
}

function renderNav() {
  return `
    <nav class="nav" aria-label="主导航">
      ${Object.entries(SCREENS).filter(([key]) => key !== "combat").map(([key, label]) => `
        <button type="button" onclick="setScreen('${key}')">${label}</button>
      `).join("")}
    </nav>
  `;
}

function renderLogs() {
  return `
    <aside class="log-panel">
      <h2>游戏日志</h2>
      <div class="log-list">
        ${state.logs.map(item => `<p>${item}</p>`).join("")}
      </div>
    </aside>
  `;
}

function renderMain() {
  return `
    <h2>主界面</h2>
    <p>你站在灰烬村的旧井旁。井沿涂着黑蜡，井下传来像呼吸一样的风声。</p>
    <div class="guide">
      <strong>新手引导</strong>
      <p>进入剧情冒险推动故事；战斗胜利获得经验和金币；金币可在商店购买黑烛药剂；背包和战斗中都能使用药剂。</p>
    </div>
    <div class="actions">
      <button type="button" onclick="setScreen('adventure')">开始冒险</button>
      <button type="button" onclick="setScreen('shop')">前往商店</button>
      <button type="button" onclick="setScreen('profile')">查看个人信息</button>
    </div>
  `;
}

function renderAdventure() {
  const stage = stages[state.story.stage];
  return `
    <h2>${stage.name}</h2>
    <p>${stage.description}</p>
    <p class="muted">当前进度：${state.story.progress}，状态：${state.story.status}</p>
    <div class="actions">
      <button type="button">进入森林</button>
      <button type="button">探索洞穴</button>
      <button type="button">前往村庄</button>
      <button type="button">挑战怪物</button>
      <button type="button">返回休息</button>
    </div>
  `;
}

function renderCombat() {
  return `<h2>战斗界面</h2><p class="muted">战斗系统将在后续任务接入。</p>`;
}

function renderShop() {
  return `<h2>商店界面</h2><p>🧪 黑烛药剂：15 金币，恢复 5 到 18 点生命值。</p>`;
}

function renderProfile() {
  const p = state.player;
  return `
    <h2>个人信息</h2>
    <div class="info-grid">
      <div>玩家等级：${p.level}</div>
      <div>当前经验值：${p.exp}</div>
      <div>升级所需经验：${p.level >= MAX_LEVEL ? "已达上限" : nextLevelExp()}</div>
      <div>生命值：${p.hp} / ${p.maxHp}</div>
      <div>攻击力：${p.attack}</div>
      <div>防御力：${p.defense}</div>
      <div>金币数量：${p.gold}</div>
      <div>药品数量：${p.potions}</div>
      <div>剧情进度：${state.story.status}</div>
    </div>
  `;
}

function renderInventory() {
  return `
    <h2>背包</h2>
    <p>🧪 黑烛药剂 x ${state.player.potions}</p>
    <button type="button">使用药品</button>
  `;
}

function renderActiveScreen() {
  if (state.screen === "main") return renderMain();
  if (state.screen === "adventure") return renderAdventure();
  if (state.screen === "combat") return renderCombat();
  if (state.screen === "shop") return renderShop();
  if (state.screen === "profile") return renderProfile();
  if (state.screen === "inventory") return renderInventory();
  return renderMain();
}

function render() {
  app.innerHTML = `
    <section class="topbar">
      <div class="brand">
        <h1>黑烛地牢</h1>
        <p>黑蜡封住村门，墓穴深处仍有烛火。</p>
      </div>
      ${renderStatBar()}
    </section>
    ${renderNav()}
    <main class="layout">
      <section class="panel">${renderActiveScreen()}</section>
      ${renderLogs()}
    </main>
  `;
}

render();
```

- [ ] **Step 3: Add CSS for new content blocks**

Add these styles inside the existing `<style>` block:

```css
.guide {
  border-left: 3px solid var(--gold);
  background: rgba(214, 167, 79, 0.08);
  padding: 12px 14px;
  margin: 16px 0;
}

.log-list {
  display: grid;
  gap: 8px;
}

.log-list p {
  margin: 0;
  border-bottom: 1px solid rgba(76, 48, 37, 0.5);
  padding-bottom: 8px;
  color: var(--muted);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.info-grid div {
  border: 1px solid rgba(76, 48, 37, 0.75);
  border-radius: 6px;
  padding: 10px;
  background: #110d0b;
}

@media (max-width: 620px) {
  .info-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Verify required screens and profile fields exist**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'function renderMain','function renderAdventure','function renderCombat','function renderShop','function renderProfile','function renderInventory','玩家等级','当前经验值','升级所需经验','当前进度'
```

Expected: matches for every render function and required profile/adventure labels.

## Task 3: Adventure Story And Event System

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`

- [ ] **Step 1: Verify adventure handlers are absent**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'function handleAdventureChoice','function resolveAdventureEvent','function advanceStory','function restAtVillage'
```

Expected: no matches before this task.

- [ ] **Step 2: Add story action handlers**

Add these functions after `setScreen`:

```javascript
function currentStage() {
  return stages[state.story.stage];
}

function advanceStory(reason) {
  state.story.progress += 1;
  if (state.story.stage === 0 && state.story.progress >= 2) {
    state.story.stage = 1;
    state.story.status = "腐烂森林";
    addLog("剧情推进：你沿着黑蜡痕迹进入腐烂森林。");
  } else if (state.story.stage === 1 && state.story.progress >= 5) {
    state.story.stage = 2;
    state.story.status = "潮湿洞穴";
    addLog("剧情推进：林地尽头裂开一道洞口，潮湿的风吹灭了你的火折。");
  } else if (state.story.stage === 2 && state.story.progress >= 9) {
    state.story.stage = 3;
    state.story.status = "旧王墓穴";
    addLog("剧情推进：铁钥碎片嵌入墓门，旧王墓穴向你敞开。");
  } else if (reason) {
    addLog(reason);
  }
}

function gainGold(amount, reason) {
  state.player.gold += amount;
  addLog(`${reason} 获得 ${amount} 金币。`);
}

function gainPotion(reason) {
  state.player.potions += 1;
  addLog(`${reason} 获得 1 瓶黑烛药剂。`);
}

function restAtVillage() {
  const p = state.player;
  const heal = Math.min(p.maxHp - p.hp, Math.ceil(p.maxHp * 0.35));
  if (heal <= 0) {
    addLog("你靠着冷墙休息了一会儿，但生命值已经满了。");
  } else {
    p.hp += heal;
    addLog(`你在村口短暂休息，恢复 ${heal} 点生命值。`);
  }
  setScreen("adventure");
}

function resolveAdventureEvent(source) {
  const stage = state.story.stage;
  const roll = rand(1, 100);
  if (source === "village") {
    if (roll <= 40) gainGold(rand(3, 9), "你在塌掉的神龛旁找到钱袋。");
    else if (roll <= 65) gainPotion("一个发抖的村民塞给你药剂后逃走。");
    else addLog("村庄里只剩黑蜡味和紧闭的窗。");
    advanceStory("你记下村中黑蜡印的位置。");
    return;
  }

  if (source === "forest" && stage === 0) {
    addLog("村外树影像手指一样弯下，你听见第一声低吼。");
    startCombat(false, "forest");
    return;
  }

  if (source === "cave" && stage < 1) {
    addLog("你还没有找到通往洞穴的路，森林里的黑蜡痕迹也许是线索。");
    return;
  }

  if (source === "deep" && stage < 2) {
    addLog("更深处的墓门仍被铁锈锁住，你需要继续探索。");
    return;
  }

  if (roll <= 42 + stage * 6) {
    startCombat(false, source);
  } else if (roll <= 58 + stage * 5) {
    startCombat(true, source);
  } else if (roll <= 75) {
    gainGold(rand(5, 16 + stage * 4), "你从碎骨和湿泥之间翻出旧币。");
    advanceStory("你继续追踪黑烛教团留下的刻痕。");
  } else if (roll <= 88) {
    gainPotion("你发现一只还没裂开的药瓶。");
    advanceStory("药瓶上的蜡印和墓门纹路一致。");
  } else {
    if (stage >= 1) state.story.clueFound = true;
    if (stage >= 2) state.story.keyFragment = true;
    addLog(stage >= 2 ? "特殊剧情：你找到一枚旧铁钥碎片。" : "特殊剧情：树皮下刻着黑烛教团的符号。");
    advanceStory("这些线索把你引向更深处。");
  }
}

function handleAdventureChoice(choice) {
  if (choice === "rest") {
    restAtVillage();
    return;
  }
  resolveAdventureEvent(choice);
  render();
}
```

- [ ] **Step 3: Wire adventure buttons to handlers**

Replace the `.actions` block in `renderAdventure()` with:

```javascript
<div class="actions">
  <button type="button" onclick="handleAdventureChoice('forest')">进入森林</button>
  <button type="button" onclick="handleAdventureChoice('cave')" ${state.story.stage < 1 ? "disabled" : ""}>探索洞穴</button>
  <button type="button" onclick="handleAdventureChoice('village')">前往村庄</button>
  <button type="button" onclick="startCombat(false, 'challenge')">挑战怪物</button>
  <button type="button" onclick="handleAdventureChoice('rest')">返回休息</button>
  <button type="button" onclick="handleAdventureChoice('deep')" ${state.story.stage < 2 ? "disabled" : ""}>继续深入</button>
</div>
```

- [ ] **Step 4: Verify narrative labels and handlers exist**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'handleAdventureChoice','resolveAdventureEvent','advanceStory','腐烂森林','潮湿洞穴','旧王墓穴','特殊剧情'
```

Expected: matches for all handlers and stage text.

## Task 4: Monster Generation, Combat, Rewards, And Leveling

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`

- [ ] **Step 1: Verify combat implementation is absent**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'const monsterNames','function generateMonster','function startCombat','function playerAttack','function monsterAttack','function finishVictory','function handleDefeat','function tryFlee','function checkLevelUps'
```

Expected: no matches before this task.

- [ ] **Step 2: Add monster, combat, reward, and level-up functions**

Add these functions after the adventure handlers:

```javascript
const monsterNames = ["史莱姆", "哥布林", "骷髅兵", "野狼", "暗影兽", "腐肉守卫", "墓穴猎手", "黑烛信徒"];

function generateMonster(strong = false, source = "wild") {
  let attack = 5;
  let defense = 2;
  for (let level = 2; level <= state.player.level; level += 1) {
    attack += rand(1, 4);
    defense += rand(1, 4);
  }
  let maxHp = 14 + state.player.level * 5 + rand(0, state.player.level * 3);
  if (strong) {
    maxHp = Math.ceil(maxHp * 1.35);
    attack += 2;
    defense += 1;
  }
  const name = monsterNames[rand(0, monsterNames.length - 1)];
  return {
    name: strong ? `强力${name}` : name,
    maxHp,
    hp: maxHp,
    attack,
    defense,
    strong,
    source
  };
}

function startCombat(strong = false, source = "wild") {
  state.currentMonster = generateMonster(strong, source);
  state.combatLogs = [`${state.currentMonster.name} 从黑暗中逼近。`];
  state.screen = "combat";
  render();
}

function playerAttack() {
  const monster = state.currentMonster;
  if (!monster || monster.hp <= 0 || state.player.hp <= 0) {
    addCombatLog("战斗已经结束。");
    render();
    return;
  }
  const damage = calculateDamage(state.player.attack, monster.defense);
  monster.hp = clamp(monster.hp - damage, 0, monster.maxHp);
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
  if (!monster || monster.hp <= 0) return;
  const damage = calculateDamage(monster.attack, state.player.defense);
  state.player.hp = clamp(state.player.hp - damage, 0, state.player.maxHp);
  addCombatLog(`${monster.name} 反击，造成 ${damage} 点伤害。`);
  if (state.player.hp <= 0) handleDefeat();
}

function finishVictory() {
  const monster = state.currentMonster;
  const expBase = rand(2, 10);
  const goldBase = rand(5, 20);
  const expGain = monster.strong ? Math.ceil(expBase * 1.5) : expBase;
  const goldGain = monster.strong ? Math.ceil(goldBase * 1.5) : goldBase;
  state.player.exp += expGain;
  state.player.gold += goldGain;
  addCombatLog(`${monster.name} 倒下了。你获得 ${expGain} 经验和 ${goldGain} 金币。`);
  addLog(`战斗胜利：击败 ${monster.name}，获得 ${expGain} 经验和 ${goldGain} 金币。`);
  state.currentMonster = null;
  advanceStory("黑烛的火焰短暂缩小，你向前推进了一段。");
  checkLevelUps();
  state.screen = "adventure";
  render();
}

function handleDefeat() {
  const loss = Math.min(state.player.gold, rand(3, 10));
  state.player.gold -= loss;
  state.player.hp = 1;
  addCombatLog(`你被黑暗吞没，醒来时只剩 1 点生命，失去 ${loss} 金币。`);
  addLog(`战斗失败：村民把你拖回旧井旁，你失去 ${loss} 金币。`);
  state.currentMonster = null;
  state.screen = "adventure";
}

function tryFlee() {
  if (!state.currentMonster) {
    addCombatLog("没有可以逃离的战斗。");
    render();
    return;
  }
  if (rand(1, 100) <= 60) {
    addCombatLog("你踢翻烛台，趁乱逃离。");
    addLog("你逃离了战斗。");
    state.currentMonster = null;
    state.screen = "adventure";
    render();
    return;
  }
  addCombatLog("你没能甩开怪物。");
  monsterAttack();
  render();
}

function checkLevelUps() {
  const p = state.player;
  while (p.level < MAX_LEVEL && p.exp >= nextLevelExp(p.level)) {
    const needed = nextLevelExp(p.level);
    p.exp -= needed;
    p.level += 1;
    const atk = rand(1, 3);
    const def = rand(1, 2);
    const hp = rand(2, 5);
    p.attack += atk;
    p.defense += def;
    p.maxHp += hp;
    const heal = Math.min(p.maxHp - p.hp, Math.ceil(hp * 0.5) + 4);
    p.hp += heal;
    addLog(`升级提示：升到 ${p.level} 级，攻击 +${atk}，防御 +${def}，生命上限 +${hp}，恢复 ${heal} 生命。`);
  }
  if (p.level >= MAX_LEVEL) p.exp = 0;
}
```

- [ ] **Step 3: Replace `renderCombat()` with full combat UI**

Use this implementation:

```javascript
function meter(current, max, kind) {
  const percent = max <= 0 ? 0 : clamp((current / max) * 100, 0, 100);
  return `
    <div class="meter ${kind}">
      <span style="width:${percent}%"></span>
    </div>
  `;
}

function renderCombat() {
  const p = state.player;
  const m = state.currentMonster;
  if (!m) {
    return `
      <h2>战斗界面</h2>
      <p>当前没有敌人。</p>
      <button type="button" onclick="setScreen('adventure')">返回冒险</button>
    `;
  }
  return `
    <h2>战斗界面</h2>
    <div class="combat-grid">
      <article class="combatant">
        <h3>玩家</h3>
        <p>生命值：${p.hp} / ${p.maxHp}</p>
        ${meter(p.hp, p.maxHp, "hp")}
        <p>攻击力：${p.attack}　防御力：${p.defense}</p>
      </article>
      <article class="combatant danger">
        <h3>${m.name}</h3>
        <p>生命值：${m.hp} / ${m.maxHp}</p>
        ${meter(m.hp, m.maxHp, "enemy")}
        <p>攻击力：${m.attack}　防御力：${m.defense}</p>
      </article>
    </div>
    <div class="actions">
      <button type="button" onclick="playerAttack()">攻击</button>
      <button type="button" onclick="usePotion('combat')">使用药品</button>
      <button type="button" onclick="tryFlee()">逃跑</button>
    </div>
    <section class="combat-log">
      <h3>战斗日志</h3>
      ${state.combatLogs.map(item => `<p>${item}</p>`).join("")}
    </section>
  `;
}
```

- [ ] **Step 4: Add combat CSS**

Add these styles:

```css
.combat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.combatant {
  border: 1px solid rgba(214, 167, 79, 0.28);
  border-radius: 8px;
  padding: 14px;
  background: #110d0b;
}

.combatant.danger {
  border-color: rgba(195, 49, 49, 0.5);
}

.meter {
  height: 12px;
  overflow: hidden;
  border: 1px solid #402820;
  border-radius: 999px;
  background: #070605;
}

.meter span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--blood), #e07a54);
}

.meter.enemy span {
  background: linear-gradient(90deg, #76522c, var(--gold));
}

.combat-log {
  margin-top: 16px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.combat-log p {
  margin: 8px 0 0;
  color: var(--muted);
}

@media (max-width: 620px) {
  .combat-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Verify combat labels and formula are present**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'Math.max\\(1, attack - defense\\)','玩家和怪物|战斗界面','攻击力','防御力','战斗日志','攻击','使用药品','逃跑'
```

Expected: matches for formula and all combat UI labels.

## Task 5: Shop, Inventory, Potion Use, And Profile Completion

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`

- [ ] **Step 1: Verify shop and potion handlers are absent**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'function buyPotion','function usePotion','黑烛药剂','药品售价'
```

Expected: `黑烛药剂` may already exist, but `buyPotion` and `usePotion` should not exist before this task.

- [ ] **Step 2: Add shop and potion handlers**

Add these functions before `renderActiveScreen()`:

```javascript
function buyPotion() {
  const p = state.player;
  if (p.gold < POTION_PRICE) {
    addLog(`金币不足：黑烛药剂需要 ${POTION_PRICE} 金币。`);
    render();
    return;
  }
  p.gold -= POTION_PRICE;
  p.potions += 1;
  addLog(`购买成功：花费 ${POTION_PRICE} 金币买入 1 瓶黑烛药剂。`);
  render();
}

function usePotion(context = "inventory") {
  const p = state.player;
  if (p.potions <= 0) {
    const message = "背包里没有黑烛药剂。";
    context === "combat" ? addCombatLog(message) : addLog(message);
    render();
    return;
  }
  if (p.hp >= p.maxHp) {
    const message = "生命值已满，没有消耗药剂。";
    context === "combat" ? addCombatLog(message) : addLog(message);
    render();
    return;
  }
  const healRoll = rand(POTION_HEAL.min, POTION_HEAL.max);
  const healed = Math.min(healRoll, p.maxHp - p.hp);
  p.hp += healed;
  p.potions -= 1;
  const message = `使用黑烛药剂，恢复 ${healed} 点生命值。`;
  context === "combat" ? addCombatLog(message) : addLog(message);
  if (context === "combat" && state.currentMonster) {
    monsterAttack();
  }
  render();
}
```

- [ ] **Step 3: Replace `renderShop()` with a complete shop card**

Use this implementation:

```javascript
function renderShop() {
  return `
    <h2>商店界面</h2>
    <p class="muted">村中商人不肯点灯，只把药剂推到柜台边缘。</p>
    <article class="shop-card">
      <div class="item-icon" aria-hidden="true">🧪</div>
      <div>
        <h3>黑烛药剂</h3>
        <p>药品售价：${POTION_PRICE} 金币</p>
        <p>使用后随机恢复 ${POTION_HEAL.min} 到 ${POTION_HEAL.max} 点生命值，不能超过生命值上限。</p>
      </div>
      <button type="button" onclick="buyPotion()">购买</button>
    </article>
  `;
}
```

- [ ] **Step 4: Replace `renderInventory()` with functional inventory UI**

Use this implementation:

```javascript
function renderInventory() {
  const p = state.player;
  return `
    <h2>背包或道具使用界面</h2>
    <article class="shop-card">
      <div class="item-icon" aria-hidden="true">🧪</div>
      <div>
        <h3>黑烛药剂 x ${p.potions}</h3>
        <p>随机恢复 ${POTION_HEAL.min} 到 ${POTION_HEAL.max} 点生命值。</p>
        <p>当前生命值：${p.hp} / ${p.maxHp}</p>
      </div>
      <button type="button" onclick="usePotion('inventory')" ${p.potions <= 0 || p.hp >= p.maxHp ? "disabled" : ""}>使用药品</button>
    </article>
  `;
}
```

- [ ] **Step 5: Confirm profile includes all required values**

Ensure `renderProfile()` contains these exact user-facing labels:

```javascript
玩家等级
当前经验值
升级所需经验
当前生命值
攻击力
防御力
金币数量
药品数量
当前剧情进度
```

If a label differs, update the HTML string in `renderProfile()` to match the list.

- [ ] **Step 6: Add item-card CSS**

Add these styles:

```css
.shop-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  border: 1px solid rgba(214, 167, 79, 0.32);
  border-radius: 8px;
  background: #110d0b;
  padding: 14px;
}

.item-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #211813;
  font-size: 1.8rem;
}

@media (max-width: 620px) {
  .shop-card {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .shop-card button {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 7: Verify shop, inventory, and profile requirements**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'function buyPotion','function usePotion','药品售价','15 金币','🧪','随机恢复','金币不足','玩家等级','当前生命值','当前剧情进度'
```

Expected: matches for handler names, potion icon, price, insufficient gold prompt, and required profile labels.

## Task 6: UI Polish, Responsiveness, And Final Verification

**Files:**
- Modify: `F:/Desktop/RPG/GPT 5.5 Codex/index.html`

- [ ] **Step 1: Add final visual polish CSS**

Add these styles at the end of the `<style>` block:

```css
.panel {
  min-height: 420px;
  position: relative;
}

.panel::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(214, 167, 79, 0.06), transparent 42%);
}

.panel > * {
  position: relative;
}

h2, h3 {
  letter-spacing: 0;
}

p {
  line-height: 1.7;
}

.nav button {
  min-width: 96px;
}

.actions button {
  min-width: 118px;
}

::selection {
  background: var(--rust);
  color: white;
}
```

- [ ] **Step 2: Verify required screens and controls by static search**

Run:

```powershell
Select-String -Path 'index.html' -Pattern '主界面','剧情冒险','战斗界面','商店界面','个人信息','背包或道具使用界面','按钮|button','状态','信息','日志','攻击','使用药品','逃跑','购买'
```

Expected: matches for every required screen and key control.

- [ ] **Step 3: Verify game rule constants and formulas by static search**

Run:

```powershell
Select-String -Path 'index.html' -Pattern 'MAX_LEVEL = 100','maxHp: 20','hp: 20','attack: 5','defense: 3','gold: 30','POTION_PRICE = 15','rand\\(2, 10\\)','rand\\(5, 20\\)','rand\\(1, 3\\)','rand\\(1, 2\\)','rand\\(2, 5\\)','Math.max\\(1, attack - defense\\)'
```

Expected: matches for all initial values, reward ranges, growth ranges, potion price, max level, and damage formula.

- [ ] **Step 4: Verify `index.html` opens without build dependencies**

Run:

```powershell
Test-Path 'index.html'
```

Expected: `True`.

Then open `F:/Desktop/RPG/GPT 5.5 Codex/index.html` directly in a browser if GUI access is available. Manual checks:

- Navigate to Main, Adventure, Shop, Profile, and Inventory.
- Start combat through Challenge Monster.
- Confirm player and monster HP, attack, and defense are visible.
- Click Attack and confirm both HP values and combat log update.
- Buy a potion with starting gold.
- Use a potion in inventory after HP is below max.
- Use a potion in combat when available.
- Confirm profile shows level, experience, required experience, HP, attack, defense, gold, potion count, and story progress.
- Resize to mobile width and confirm buttons and text do not overlap.

- [ ] **Step 5: Git checkpoint**

Run:

```powershell
git status --short
```

Expected in this workspace: `fatal: not a git repository`. Commit is skipped unless the user asks to initialize Git.

## Plan Self-Review

- Spec coverage: The tasks cover the single-file deliverable, all six required screens, initial player stats, combat formula, monster scaling, experience and leveling, shop/potion rules, gold rewards, profile fields, branching story, logs, guide text, and browser-direct execution.
- Marker scan: No plan step contains unresolved marker text or unspecified follow-up work.
- Type consistency: State keys used by renderers and handlers are consistent: `state.player`, `state.story`, `state.currentMonster`, `state.logs`, and `state.combatLogs`.
- Scope check: The game is a focused static browser RPG. Persistent saves, external assets, and build tooling are excluded to preserve direct browser execution.
