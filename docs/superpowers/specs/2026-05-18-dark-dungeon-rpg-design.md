# Dark Dungeon Text RPG Design

## Goal

Build a complete browser-runnable text RPG adventure game in HTML, CSS, and JavaScript. The game should open directly from `index.html` without a build step or server, and should provide a dark dungeon adventure with branching story choices, exploration, combat, shop, profile, inventory, logs, and beginner guidance.

## Theme And Tone

The game is titled **Black Candle Dungeon** / **黑烛地牢**. The tone is dark fantasy dungeon adventure: dim candles, rusted iron, cracked stone, old graves, cursed forests, and a village at the edge of collapse. The UI should feel like a compact dungeon command panel rather than a marketing page.

The visual direction is dark, readable, and game-focused:

- Charcoal and black stone background.
- Rust red, tarnished brass, bone white, and poison green accents.
- Panels with hard edges or small-radius corners.
- Strong contrast for text, buttons, health bars, and warnings.
- No decorative landing page; the main screen is the actual playable game.

## Deliverable

Create one static file:

- `index.html`: contains HTML structure, CSS styles, and JavaScript game logic.

This single-file approach keeps the game easy to open, inspect, and move. It also satisfies the requirement that the game can run directly in a browser.

## Core Screens

The game has six primary screens, each rendered inside the same single-page shell:

1. **Main Screen**
   - Shows game title, short atmospheric introduction, current character summary, and primary navigation buttons.
   - Includes a beginner guide panel explaining adventure, combat, shop, and potion use in concise terms.

2. **Adventure Screen**
   - Shows current story chapter, scene description, branching choices, and recent adventure log.
   - Choices include entering the forest, exploring the cave, visiting the village, challenging a monster, resting, and continuing deeper when unlocked.

3. **Combat Screen**
   - Shows player HP, monster HP, player attack/defense, monster attack/defense, combat log, and action buttons.
   - Actions include attack, use potion, and flee.

4. **Shop Screen**
   - Shows a potion item with emoji icon, name, price, effect range, and buy button.
   - Potion price is 15 gold.
   - If gold is insufficient, the game displays a clear failure message.

5. **Profile Screen**
   - Shows player level, current experience, experience required for next level, HP, attack, defense, gold, potion count, and current story state.

6. **Inventory Screen**
   - Shows potion count and use button.
   - Potion use restores a random 5 to 18 HP without exceeding max HP.
   - If no potion is available or HP is full, the game gives a clear message.

## Player State

The player starts with:

- Level: 1
- Max level: 100
- Max HP: 20
- Current HP: 20
- Attack: 5
- Defense: 3
- Experience: 0
- Gold: 30
- Potions: 0
- Story stage: 0
- Current status: "灰烬村入口"

The game state is stored in JavaScript memory. No persistent save system is included in this version because the user requested a directly runnable game, not long-term persistence.

## Experience And Leveling

Experience rules:

- Killing a monster grants random experience from 2 to 10.
- Level 1 to 2 requires 20 experience.
- Level 2 to 3 requires 35 experience.
- General formula: `nextLevelExp = 20 + currentLevel * 15`.
- When the player levels up, subtract the required experience and repeat while enough experience remains.
- Level cannot exceed 100.

Level-up stat growth:

- Attack increases by random 1 to 3.
- Defense increases by random 1 to 2.
- Max HP increases by random 2 to 5.
- Current HP restores by 50% of the HP increase plus 4, capped at max HP.

Level-up events are written into the game log and shown as visible prompts.

## Monster Generation

Monster names are randomly selected from:

- 史莱姆
- 哥布林
- 骷髅兵
- 野狼
- 暗影兽
- 腐肉守卫
- 墓穴猎手
- 黑烛信徒

At player level 1, base monster stats are:

- Attack: 5
- Defense: 2

Monster stat scaling:

- Attack: `5 + sum of random 1 to 4 growth per player level above 1`.
- Defense: `2 + sum of random 1 to 4 growth per player level above 1`.
- HP: `14 + playerLevel * 5 + random 0 to playerLevel * 3`.

For implementation simplicity and runtime performance, the per-level random growth is computed by looping from 2 through the player's current level when generating a monster. Strong monsters receive a multiplier:

- HP multiplied by 1.35.
- Attack increased by 2.
- Defense increased by 1.
- Rewards increased by 1.5.

## Combat Rules

Damage formula:

```text
actualDamage = max(1, attackerAttack - defenderDefense)
```

Combat flow:

1. Player enters combat from an adventure event or challenge button.
2. Player acts first.
3. If the monster survives, the monster attacks.
4. If player HP reaches 0, combat is lost.
5. If monster HP reaches 0, combat is won.

Victory:

- Player gains random 2 to 10 experience.
- Player gains random 5 to 20 gold.
- Strong monsters use boosted rewards.
- Level-up checks run automatically after rewards.
- Story progress may advance if the monster was tied to a chapter event.

Defeat:

- Player HP becomes 1 after being dragged back to the village.
- Player loses a small gold penalty of up to 10 gold, capped by current gold.
- A defeat log entry explains the consequence.

Flee:

- Flee has a 60% success chance.
- On success, player returns to adventure screen.
- On failure, the monster attacks once.

## Shop And Potion Rules

Potion item:

- Icon: 🧪
- Name: 黑烛药剂
- Price: 15 gold
- Effect: random 5 to 18 HP recovery

Buying:

- If player has at least 15 gold, subtract 15 and add one potion.
- If player has insufficient gold, show a message and log it.

Using:

- If potion count is zero, show a message.
- If HP is already full, show a message and do not consume a potion.
- Otherwise consume one potion and restore random 5 to 18 HP, capped at max HP.
- Potion can be used in inventory and combat.

## Story Structure

The story is continuous and advances through stages rather than being only random events.

### Stage 0: 灰烬村入口

The player arrives at a village sealed by black wax marks. The old well leads toward a buried dungeon. Early choices introduce the shop, rest, and low-risk exploration.

Key events:

- Find a few coins near broken shrine stones.
- Meet a wounded villager who gives a potion.
- Encounter weaker monsters.
- Unlock forest progress after surviving the first monster encounter.

### Stage 1: 腐烂森林

The forest path is full of candle stubs, bone charms, and moving shadows. The player starts seeing clues about the Black Candle cult.

Key events:

- Random gold or potion discoveries.
- Normal monster encounters.
- Special event: discover a cult sigil.
- Unlock cave exploration after enough progress.

### Stage 2: 潮湿洞穴

The cave connects the forest to old burial tunnels. Events become more dangerous, with higher odds of combat and strong monsters.

Key events:

- Strong monster encounter chance increases.
- Find an old iron key fragment.
- Story text hints that the dungeon is below the old royal tomb.
- Unlock tomb descent after defeating a strong monster or reaching enough progress.

### Stage 3: 旧王墓穴

The player reaches the outer tomb. This is the late-game loop for the current version, with stronger combat and bigger rewards.

Key events:

- Higher risk exploration.
- Strong monsters appear more often.
- Special story messages reveal the Black Candle is still burning.
- Game continues indefinitely up to level 100.

## Adventure Event System

Adventure choices call structured event handlers rather than pure random text.

Event types:

- Story progress event.
- Normal monster encounter.
- Strong monster encounter.
- Gold discovery.
- Potion discovery.
- Rest or village recovery.
- Special clue event.

Each location has weighted outcomes, but the text references the current stage so the adventure feels connected. Progress counters unlock later stages.

## UI Layout

The page uses a single application shell:

- Top status bar: level, HP, experience, gold, potion count.
- Left or upper navigation: Main, Adventure, Shop, Profile, Inventory.
- Main content panel: active screen content.
- Right or lower log panel: recent game events and combat events.

Responsive behavior:

- Desktop uses a two-column layout for content and log/status panels.
- Mobile stacks panels vertically.
- Buttons wrap cleanly and remain large enough to tap.

## JavaScript Structure

`index.html` includes a `<script>` block organized into focused sections:

- Constants: item prices, names, caps, UI labels.
- State: player, story, active screen, current monster, logs.
- Utility functions: random integer, clamp, damage calculation, logging.
- Rendering functions: render app shell, render each screen, render bars, render logs.
- Game actions: navigation, adventure choice handling, combat actions, shop actions, inventory actions, leveling.
- Initialization: render main screen and initial guide log.

No external libraries are required.

## Error Handling And Edge Cases

The game handles these cases explicitly:

- Potion purchase with insufficient gold.
- Potion use with zero potions.
- Potion use at full HP.
- Attack button after combat has ended.
- Flee attempt after combat has ended.
- Level cap at 100.
- HP never exceeds max HP.
- Damage is never below 1.
- Gold never drops below 0.

## Testing And Verification

Manual verification should cover:

- Open `index.html` directly in a browser.
- Navigate all six screens.
- Buy potion with enough gold.
- Try buying potion without enough gold.
- Use potion from inventory.
- Use potion during combat.
- Complete at least one battle victory.
- Trigger player defeat by repeated combat if needed.
- Confirm damage formula with visible attack/defense values.
- Confirm experience, gold, potion count, and HP update correctly.
- Confirm profile screen displays all required fields.
- Confirm responsive layout does not overlap at mobile width.

Implementation verification can use static checks:

- Confirm `index.html` exists.
- Confirm no external dependencies are required.
- Confirm key required labels and action buttons are present in the file.

