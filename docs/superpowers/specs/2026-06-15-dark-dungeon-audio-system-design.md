# Dark Dungeon Audio System Design

## Goal

Add a complete, original, offline audio layer to the existing dark fantasy browser RPG. The audio system must reinforce each location, make combat actions readable, preserve the current game rules, and remain optional and controllable.

All music and sound effects will be synthesized locally from code. No external recordings, music libraries, remote URLs, or copyrighted source material will be used.

## Creative Direction

The selected direction is dark environmental ambience rather than melodic orchestral scoring.

The sound palette uses:

- Low drones and slowly shifting harmonics.
- Wind, distant room tone, cave resonance, and filtered noise.
- Restrained bells, metal friction, chains, stone impacts, and ritual pulses.
- Sparse percussion during combat.
- No vocals, spoken words, recognizable melodies, or bright heroic instrumentation.

The result should feel oppressive and atmospheric while remaining quiet enough to sit beneath long-form text reading.

## Asset Package

Create 17 local WAV files under `assets/audio/`.

### Background Music

1. `bgm-ash-village.wav`
   - Used by the main screen, Ash Village adventure state, shop, profile, and inventory.
   - Cold wind, dying lantern hum, distant wood and stone creaks.

2. `bgm-rotten-forest.wav`
   - Used when the current story stage is Rotten Forest.
   - Wet leaves, low tree resonance, irregular black-candle chimes.

3. `bgm-damp-cave.wav`
   - Used when the current story stage is Damp Cave.
   - Water drops, steel-blue drone, deep tunnel reflections.

4. `bgm-old-king-tomb.wav`
   - Used when the current story stage is Old King Tomb.
   - Burial bell, stone chamber resonance, ritual bass pulses.

5. `bgm-combat.wav`
   - Used while an active monster battle exists.
   - Faster low percussion, metal impacts, tense pulse, and sustained danger layer.

Each BGM track must be 45 to 60 seconds long and designed for seamless looping. BGM files use 44.1 kHz, 16-bit stereo WAV.

### Sound Effects

1. `sfx-player-attack.wav` - Player weapon swing and impact.
2. `sfx-player-hit.wav` - Player receiving damage.
3. `sfx-critical-hit.wav` - Heavier rare strike accent, available for future critical-hit rules without changing current combat behavior.
4. `sfx-monster-attack.wav` - Monster lunge, claw, or blunt attack cue.
5. `sfx-victory.wav` - Short release chord and extinguished danger pulse.
6. `sfx-defeat.wav` - Low collapse, dull bell, and fading rumble.
7. `sfx-flee.wav` - Fast retreat movement and breath-like noise.
8. `sfx-level-up.wav` - Restrained rising ritual chime.
9. `sfx-potion.wav` - Cork, glass, liquid, and healing resonance.
10. `sfx-purchase.wav` - Coin and wooden counter impact.
11. `sfx-gold.wav` - Small old-coin discovery cue.
12. `sfx-discovery.wav` - Special clue or story discovery cue.

Sound effects use 44.1 kHz, 16-bit mono WAV and should generally last 0.25 to 2.5 seconds.

## Synthesis And Mastering

Use a deterministic synthesis script with fixed seeds so the asset set can be reproduced.

The generator may use Python standard-library wave handling plus locally available numerical/audio libraries. It must generate all source waveforms and effects itself rather than downloading samples.

Generation techniques may include:

- Layered sine, triangle, and filtered noise oscillators.
- Slow amplitude and pitch modulation.
- Algorithmic delay and convolution-like synthetic reverberation.
- Short filtered impulses for stone, metal, glass, and coin sounds.
- Equal-power fades and phase-compatible loop boundaries.
- Peak limiting and short edge fades to prevent clicks.

Quality limits:

- Sample rate: 44,100 Hz.
- Sample depth: signed 16-bit PCM.
- BGM peak level: no greater than -1 dBFS.
- SFX peak level: no greater than -1 dBFS.
- Files must not be silent or clipped.
- BGM loop seam must not contain an abrupt discontinuity or un-faded transient.
- BGM loudness must remain below foreground sound effects at the default mix.

## Audio Mapping

The runtime defines a local asset manifest and two explicit maps:

- Story stage index to BGM asset.
- Named game event to SFX asset.

Music selection rules:

- Active combat always selects `bgm-combat.wav`.
- Outside combat, story stages 0 through 3 select village, forest, cave, and tomb music respectively.
- Main, shop, profile, and inventory use village music unless combat is still active.
- After victory, defeat, or successful flee, music returns to the current story-stage track.
- Re-rendering the same screen must not restart an already playing matching track.

Sound-effect event rules:

- `playerAttack()` plays player attack.
- Successful monster counterattacks play monster attack and player hit as a coordinated layered cue.
- `finishVictory()` plays victory.
- `handleDefeat()` plays defeat.
- Successful `tryFlee()` plays flee; failed flee uses monster attack/player hit.
- Each completed level increase plays level up once.
- Successful potion use plays potion.
- Successful purchase plays purchase.
- Gold discoveries play gold.
- Clue, key fragment, and special narrative discoveries play discovery.
- Critical-hit audio is generated and mapped but must not introduce a critical-hit mechanic in this phase.

## Playback Architecture

Add one isolated audio controller rather than scattering raw `Audio` calls through gameplay logic.

The controller owns:

- Audio unlock state.
- Current BGM identity and playback element.
- Incoming and outgoing BGM elements for crossfades.
- Master mute state.
- BGM and SFX volume values.
- SFX voice pooling for rapid replay.
- Page visibility attenuation.
- Loading and playback error reporting.

Gameplay functions call small semantic methods such as `audio.playSfx("victory")` or `audio.syncBgm()`.

The audio controller must not read or modify combat statistics. It may inspect current screen, story stage, and active-combat state solely to choose music.

## Browser Autoplay And Unlock

Browsers block audio before a user gesture. The first click or keyboard activation on a game control must:

1. Mark audio as unlocked.
2. Start the BGM appropriate to the resulting game state.
3. Preserve the user's saved mute and volume preferences.

The game must remain fully playable if audio is never unlocked or if an audio file fails.

## Crossfading And Visibility

- BGM changes use a short 1.0 to 1.8 second equal-power-style crossfade.
- The same requested BGM must continue without restarting.
- Entering combat may use the shorter end of the range for urgency.
- Leaving combat restores the correct stage track using the normal fade.
- When `document.hidden` becomes true, BGM target volume is reduced substantially rather than paused abruptly.
- Returning to the page restores the selected volume smoothly.

## User Controls

Add a compact audio control group to the top interface:

- One familiar speaker icon button for master mute/unmute.
- One music volume slider.
- One sound-effect volume slider.
- Accessible labels and current values for all controls.
- Tooltips or titles for icon-only controls.

The controls must fit the existing dark dungeon interface and must not create horizontal overflow at 360 px. On narrow screens, the sliders may wrap beneath the speaker control.

Default values:

- Master muted: false, but no playback until user interaction unlocks audio.
- Music volume: 0.42.
- Sound-effect volume: 0.72.

Save settings in `localStorage` using one versioned settings object. Invalid or missing saved values fall back to defaults.

`prefers-reduced-motion` does not automatically mute audio because it is unrelated to sound sensitivity. User mute and volume controls remain the authority.

## Error Handling

- A missing or undecodable BGM must not block scene changes.
- A missing SFX must not block its gameplay event.
- Repeated playback errors for the same asset should be deduplicated.
- Show one concise non-modal log message when an audio asset fails.
- The controller should stop retrying a known failed asset during the current page session.
- Invalid saved settings are sanitized without displaying an error.

## Manifest And File Organization

Add:

- `assets/audio/audio-manifest.json`
- `tools/generate_audio.py`
- `tests/verify-audio.js`

The manifest lists all five BGM and twelve SFX files, their semantic keys, intended loop behavior, and expected channel count.

The synthesis script writes only to `assets/audio/` and supports regenerating the complete package deterministically.

## Verification

### Asset Verification

Automated checks must verify all 17 files:

- Exist and match the manifest.
- Decode as PCM WAV.
- Use 44.1 kHz and 16-bit samples.
- BGM files are stereo and 45 to 60 seconds.
- SFX files are mono and 0.25 to 2.5 seconds unless a documented effect needs slightly longer decay.
- Contain non-zero audio energy.
- Stay within peak limits and contain no clipped sample runs.
- BGM loop boundaries remain within an explicit seam-difference threshold.

### Browser Verification

Browser tests must cover:

- No audio starts before user interaction.
- First game interaction unlocks audio.
- Story-stage changes select the expected BGM.
- Combat selects combat BGM.
- Victory, defeat, and flee restore stage BGM.
- Attack, damage, potion, purchase, gold, discovery, victory, defeat, flee, and level-up events request the correct SFX.
- Mute and both volume controls update the controller.
- Settings persist through reload.
- Audio failures leave gameplay controls usable.
- Mobile controls do not overflow at 360 px.

Browser tests may stub media playback to inspect requested assets and state transitions reliably. Asset decoding and signal quality are verified separately by `tests/verify-audio.js`.

## Scope Boundaries

This phase does not add:

- Voice acting or narration.
- Monster-specific voice sets.
- Dynamic music stems synchronized to health.
- A critical-hit combat mechanic.
- Remote streaming audio.
- User-imported music.

These can be added later without changing the event-based audio controller interface.

## Success Criteria

The feature is complete when:

- All 17 original local audio files are reproducibly generated.
- Every location and combat state selects the correct BGM.
- All specified gameplay events trigger their mapped sound effect.
- Music crossfades without obvious clicks or unintended restarts.
- Audio settings are accessible, responsive, and persistent.
- Audio failures never prevent gameplay.
- Asset and browser verification both pass.
