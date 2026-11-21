# VELAMAR — build brief (read this first, every session)

This repository is an entry for make.fun's **"Make GTA 6"** bounty (`gta6-01`). The entry is a
**complete, original open-world crime game** that runs in desktop Chrome from static files under
`game/`, with **no network request** at run time. It is judged from 3-4 screenshots of the game
itself plus an outline of the source. Completeness and looks in the screenshots decide the score.

Rules that constrain the build (hard):

- Everything under `game/` is static: `game/index.html` opens from any static server and plays
  offline. Every script, module, image and sound is a file under `game/` or a `data:` URI.
- No asset, name, logo, character, map, music or text from GTA / Rockstar or any other commercial
  game. The city, people, cars, brands, story and sound are ours.
- three.js is vendored at `game/vendor/three.module.min.js` (MIT). Import it as `three` through the
  import map in `index.html`.
- `main.ts` (Node 22, already written) copies `game/` and `screenshots/` to `/output` and writes
  `dossier.json`. Do not change `main.ts` behaviour, `vendor/makefun-game.ts`, `serve.ts`, `LICENSE`.
- Screenshots: 3-4 files in `screenshots/`, 1280x720 JPEG, each a real render of this game, the
  first by name is the cover. They are taken by `tools/shoot.mjs` (Playwright) from `?shot=` states.

Working rules for the agent:

- Work in small, complete steps. Every change must leave the game bootable: after you finish a
  step, run `node tools/smoke.mjs` (Playwright; prints console errors and a frame-time sample) and
  fix what it reports before you stop.
- Keep the module contracts below. If a contract has to change, change it in this file in the same
  step and keep every caller in sync.
- One file, one job. Name files and functions for what they do: the judge sees file paths and the
  first declarations of each file.
- No per-frame allocation in hot loops (reuse vectors), no `new` inside `update()` where avoidable,
  no shadow maps, no post-processing.

---

## 1. The game

**Title:** VELAMAR — a sun-soaked coastal city of glass towers, palm boulevards, a marina and a
salt-bleached old quarter. Spanish-Caribbean mood, our own names:

- City: **Velamar**. Districts: **Costanera** (beachfront strip), **Centro** (towers, banks),
  **Mercado** (low-rises, awnings, neon), **Muelle** (docks and containers), **Cerro Alto** (hillside
  streets with stairs, a viewpoint).
- Player: **Rafa Quintero**, a dock worker who starts running errands for a fixer.
- Crew: **Nina Salas** (fixer, missions 1-3, 7), **Tuco Bravo** (mechanic, garage, missions 2, 6),
  **La Vieja** (debt collector, mission 4), **Coronel Mena** (antagonist, missions 5, 8).
- Police: **Policía de Velamar (PVD)** — white-and-blue cruisers, "PVD" on the hood, an air unit
  ("Gaviota") at 4-5 stars.
- Brands the city shows: **Sol Bravo** (beer), **Radio Marea 88.7** (radio), **Banco Cocal**.

Mood and look: late-afternoon gold light, long shadows, warm haze, saturated bougainvillea, teal
water; at night: sodium street lamps, neon signs, lit windows, red/blue police lights. Coherent,
sun-bleached, never grey. No HUD element may cover the centre of the screen.

Controls (keyboard + mouse):

- `WASD` move / drive, `Shift` sprint (on foot) or handbrake (car), `Space` jump / handbrake.
- Mouse look (pointer lock), `E` enter/exit vehicle, `F` fire, right mouse aim, `R` reload,
  `1 2 3` weapons, `C` camera distance, `M` map, `Esc` pause, `F5` save, `F9` load.

## 2. Systems and acceptance criteria

Each of these must work in the built game and appear in at least one screenshot.

1. **City** — a grid of blocks with asphalt roads, lane markings, kerbs and sidewalks, buildings in
   three archetypes (glass tower, midrise, low-rise with awnings), palms, street lamps, traffic
   lights, benches, hydrants, billboards with our brands, a beach with sand and water, a marina with
   piers and moored hulls, container stacks at the docks. Roads are drivable end to end; buildings
   block movement (AABB collision, broadphase grid).
2. **Player on foot** — third-person camera with a spring arm that avoids walls, walk/run, a
   procedural walk cycle (arms and legs swing, body bob), jump, land, footstep sound.
3. **Vehicles** — six bodies (sedan, coupe, van, pickup, sports, police cruiser) built from merged
   boxes with vertex colours so each car is one draw call; arcade physics with grip, drift at speed,
   brake lights, headlights at night; enter/exit with `E`; damage and smoke when wrecked.
4. **Traffic and pedestrians** — at least 24 cars and 40 pedestrians alive around the player on the
   road graph and sidewalks, lane-following with car-following slowdown, respawn behind the player,
   pedestrians who flinch and flee from gunfire and from a car horn.
5. **Wanted level** — 0-5 stars from crimes (assault, car theft, shooting, hitting a pedestrian,
   killing a cop). Police cruisers chase on the road graph, foot officers pursue and shoot, a
   roadblock spawns at 3 stars, the air unit at 4. Losing sight of the player for 20-40 s cools the
   level down. Wanted stars, sirens and lightbars must be visible in the HUD and in world.
6. **Combat** — pistol, SMG, shotgun with distinct spread, rate and sound; hitscan against police and
   pedestrians with hit sparks; muzzle flash, tracers, recoil; player health and armour, bleed-out
   damage flash, death, respawn at the nearest hospital with money lost.
7. **Missions and story** — 8 missions with giver markers, typed dialogue, objective markers, waypoint
   arrows on the minimap, rewards (money), unlock order, and a completion screen. Objectives:
   go-to, steal vehicle, deliver vehicle, kill target, survive wanted level, checkpoint race, escort.
8. **HUD and minimap** — health and armour bars, cash, wanted stars, weapon and ammo, clock and
   district name, a live top-down minimap (roads, blocks, player arrow, police blips, mission
   marker, garage) drawn on a 2D canvas, speedometer while driving, toast messages, mission dialogue
   box. Must stay readable at 1280x720.
9. **Menus, save, pause** — start screen with the title, New Game / Continue, settings (mouse
   sensitivity, volume, quality low/mid/high, invert Y), pause menu (Resume, Settings, Save, Load,
   Quit to title), save/load in `localStorage` (position, money, health, weapons, wanted level,
   mission progress, time of day), game over and restart.
10. **Audio** — all procedural through Web Audio API (no audio files): engine tone that follows
    speed, tyre screech, gunshots per weapon, siren, footsteps, pickups, UI clicks, an ambient city
    bed and a short looping music theme. Audio starts on the first click (browser autoplay rule).
11. **Day/night** — a clock that advances (about 1 game hour per 30 s), sun and sky colour by hour,
    fog matching, street lamps and window lights on at night, headlights on cars at night.

## 3. Module contracts

Files under `game/src/`. Import `three` as a bare specifier. Everything is ES modules.

```
index.html          div#app (canvas host), HUD DOM (id="hud"), menus (id="menus"),
                    importmap {"imports":{"three":"./vendor/three.module.min.js"}},
                    <script type="module" src="./src/main.js">
src/main.js         no exports; boots Game
src/config.js       WORLD {block:40, road:12, sidewalk:3, grid:14}, PALETTE, QUALITY presets,
                    KEYBINDS, DISTRICT table, VEHICLE specs
src/core/rng.js     makeRng(seed)->()=>number, makeRngAt(x,z), clamp, lerp, smoothstep, damp
src/core/input.js   class Input { keys, mouseDX, mouseDY, isDown(code), pressed(code) (once),
                    endFrame(), lock(canvas), locked, wheel }
src/core/audio.js   class AudioEngine { unlock(), setVolume(v), sfx(name, opts), engine(rpm01),
                    siren(on), music(mode), update(dt) }
src/core/save.js    saveGame(data), loadGame()->data|null, clearSave(), hasSave()
src/render/parts.js makeBox(w,h,d,color), makeCylinder(rTop,rBot,h,seg,color), mergeParts(list),
                    canvasTexture(w,h,draw), facadeTexture(kind), textTexture(text,opts)
src/render/scene.js class Renderer { scene, camera, renderer, setQuality(name), resize(),
                    render(), stats {fps,drawCalls,triangles,frames} }
src/render/sky.js   class SkySystem { constructor(scene, renderer), setHour(h), update(dt,camera),
                    hour, sunLight, setNight(on) }
src/world/city.js   buildCity(scene, rng, quality)->City
                    City { group, graph: RoadGraph, nearestRoad(x,z), isOnRoad(x,z),
                    groundY(x,z), collide(pos, radius)->pos, landmarks[], districts[],
                    spawnPoint[3], garage:{x,z}, hospital:{x,z} }
src/world/graph.js  class RoadGraph { nodes[], edges[], nearest(x,z)->nodeIndex,
                    path(a,b)->[nodeIndex], lanePoint(n0,n1,t,out)->Vector3 }
src/world/traffic.js class Traffic { constructor(scene, city, rng), update(dt, playerPos), cars[], peds[] }
src/entities/player.js class Player { constructor(scene, city), object3D, position, velocity,
                    health, armour, money, weapon, ammo{...}, inVehicle, vehicle,
                    update(dt, input, camera, ctx), takeDamage(n), heal(n), setVehicle(v),
                    exitVehicle(), aimRay(out) }
src/entities/vehicle.js class Vehicle { constructor(scene, city, specId, opts), spec, position,
                    heading, speed, health, occupants, update(dt, controls, city), enter(), exit(),
                    setDriver(driver), scene object }
src/entities/police.js class Police { constructor(scene, city, rng), wanted (0-5), update(dt, player),
                    report(crime), clear(), units[], level }
src/gameplay/combat.js class Combat { constructor(scene, audio), fire(origin, dir, kind, shooter),
                    update(dt, dt, targets), effects getter }
src/gameplay/missions.js MISSIONS (8 items), class Missions { constructor(city, hud, audio),
                    update(dt, player), start(id), current, complete(id), available() }
src/ui/hud.js       class Hud { constructor(root), update(state), toast(text), say(name, text),
                    setObjective(text), setPrompt(text) }
src/ui/minimap.js   class Minimap { constructor(canvas, city), draw(player, blips) }
src/ui/menus.js     class Menus { constructor(root, cb), show(title), hide(), isOpen }
src/gameplay/shots.js applyShot(name, game) — deterministic setups listed in section 5
src/gameplay/story.js STORY text: intro, radio chatter, mission dialogue lines
```

`main.js` owns the frame loop (a clamped `requestAnimationFrame`, dt capped at 1/20 s), the game
state (`menu`, `play`, `paused`, `dead`), wiring, and `window.game` for debugging. It also sets
`window.__velamar = { ready:true, stats }` when the first frame has rendered, and
`window.__shotReady = true` when a `?shot=` state has settled (used by `tools/shoot.mjs`).

## 4. Look and budget

- Palette: sky `#ffd9a0` to `#7fc4e8`, asphalt `#3b3f45`, kerb `#c9c2b2`, stucco `#f2e2c9` /
  `#e8b06a` / `#f5f0e6`, glass `#8fb7c9`, foliage `#2f6b3f`, sand `#e6d3a8`, water `#1d7f8c`,
  neon `#ff4f7a` / `#37e0d6`.
- Budget: at most ~250 draw calls and ~180k triangles in the worst street view; 60 fps on a mid
  laptop. Use `InstancedMesh` for buildings, palms, lamps, props, traffic bodies and pedestrians;
  merge each unique car and character into one geometry; reuse one material per family; no shadows.
- Detail is bought with silhouettes, colour and props, not polygon count.
- Fake contact shadows: a dark translucent quad under each car and character.

## 5. Screenshot states (`?shot=`)

`tools/shoot.mjs` opens the game at `?shot=<name>&seed=7`, waits for `window.__shotReady`, and
saves `screenshots/<name>.jpg` at 1280x720, JPEG quality 82. Required states, each staged to show
several systems at once:

1. `1-cover` — golden hour, on foot on the Costanera boulevard: traffic, pedestrians, palms, a
   mission marker ahead, HUD with minimap, objective text. The city must read as a city.
2. `2-chase` — driving a coupe at speed on a three-lane street, three police cruisers behind with
   lightbars, 3 stars in the HUD, minimap blips, speedometer.
3. `3-combat` — night in Mercado: on foot, four PVD officers shooting, muzzle flash and tracers,
   health low, 4 stars, the air unit's searchlight overhead, neon signs.
4. `4-mission` — inside the mission dialogue moment at the marina with the objective marker, purple
   dusk, cars parked, a boat in the water, cash reward toast.

`shots.json` at the repo root lists the same states with their query.

## 6. Build order (one step per session)

1. Skeleton: delete the starter's `game/src/*.js`, write `index.html`, `config.js`, `core/rng.js`,
   `core/input.js`, `render/parts.js`, `render/scene.js`, `main.js` — a bootable scene with a sky
   gradient, a ground plane, the FPS/draw-call counter and a resize handler.
2. `world/graph.js` + `world/city.js`: the grid city, roads with markings, sidewalks, instanced
   buildings, palms, lamps, props, beach and water, collision.
3. `render/sky.js` day/night, night lights, then `gameplay/shots.js` with a camera-only preview.
4. `entities/player.js` on-foot controller and camera.
5. `entities/vehicle.js` and the vehicle fleet; entering and driving.
6. `world/traffic.js` cars on the road graph and pedestrians on sidewalks.
7. `entities/police.js` wanted level, pursuit, foot officers, roadblocks, the air unit.
8. `gameplay/combat.js` weapons, hitscan, effects, damage and death.
9. `ui/hud.js` + `ui/minimap.js`.
10. `gameplay/missions.js` + `gameplay/story.js` with the eight missions.
11. `ui/menus.js` + `core/save.js`.
12. `core/audio.js` procedural sound and music.
13. Screenshot states, `tools/shoot.mjs`, and the four screenshots.
14. Polish pass: fix what `tools/smoke.mjs` and the shots show; no new systems.

## 7. Tools

- `node serve.ts` serves `game/` at http://localhost:8080 for a person to play.
- `node tools/smoke.mjs` (write it in step 1) serves `game/` itself on a free port and opens it in headless Chromium with every
  network request outside localhost blocked, plays for a few seconds with scripted input, and
  prints console errors, `window.__velamar.stats` and any failed request. Exit code 1 on error.
- `node tools/shoot.mjs` writes the screenshots.

Environment for both tools (already installed, not part of the entry):

```
NODE_PATH=/workspace/tools/qa/node_modules
PLAYWRIGHT_BROWSERS_PATH=/workspace/tools/qa/browsers
LD_LIBRARY_PATH=/workspace/.tmp/libs/usr/lib/x86_64-linux-gnu
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
```

Launch Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
--no-sandbox` (software GL: it is slower than a GPU, so keep the budget in section 4).
