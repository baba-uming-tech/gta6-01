# VELAMAR — build brief (read fully at the start of each session)

The `gta6-01` repository is our entry for the make.fun **"Make GTA 6"** bounty. Our deliverable is a
**full, wholly original open-world crime game** that desktop Chrome plays from static files in `game/`;
no internet request may be made during play. Judging uses 3-4 captures of the running game alongside a
source summary, and weighs how complete the game feels and how the captures look.

Non-negotiable build rules:

- Everything under `game/` is static. `game/index.html` has to run offline through any static server,
  with scripts, modules, images and audio sourced from files in `game/` or from `data:` URIs.
- No GTA / Rockstar material — and nothing from any other commercial title — may be included: no
  assets, names, logos, characters, maps, music or text. We devise the city, inhabitants, vehicles,
  brands, story and sounds ourselves.
- three.js (MIT) is kept locally at `game/vendor/three.module.min.js`. The `index.html` import map
  points the bare specifier `three` at that file.
- `main.ts` is already complete for Node 22: it copies `game/` and `screenshots/` into `/output` and
  writes `dossier.json`. Leave it, `vendor/makefun-game.ts`, `serve.ts` and `LICENSE` untouched.
- `screenshots/` should contain 3-4 real in-game renders, each a 1280x720 JPEG; the alphabetically
  first image becomes the cover. `tools/shoot.mjs` (Playwright) creates them by visiting `?shot=` states.

Advice for whoever builds it:

- Work in small, self-contained steps that always leave the game playable. After each one, run
  `node tools/smoke.mjs` — Playwright checks console errors and samples frame time — and clear every
  problem it reports before stopping.
- The module interfaces below are binding. If one must change, update this document and every caller
  within that same step.
- One responsibility per file, with descriptive file and function names: the judge looks at paths and
  at the first declarations in each file.
- Keep hot paths free of per-frame allocations: reuse vectors, avoid `new` inside `update()` where
  possible, and use neither shadow maps nor post-processing.

---

## 1. The game

**Title:** VELAMAR — a sun-baked coastal metropolis of glass towers, palm-lined boulevards, a marina
and a salt-bleached old quarter. Its mood is Spanish-Caribbean, and we invented every name:

- **Velamar** divides into **Costanera** (the beachfront strip), **Centro** (towers and banks),
  **Mercado** (low buildings, awnings and neon), **Muelle** (wharves and container stacks), and
  **Cerro Alto** (steep streets with stairs and a viewpoint).
- The player is **Rafa Quintero**, a dock labourer who starts out taking work from a fixer.
- Other characters: **Nina Salas**, the fixer (missions 1-3 and 7); **Tuco Bravo**, the garage
  mechanic (missions 2 and 6); **La Vieja**, a debt collector (mission 4); and **Coronel Mena**, the
  villain (missions 5 and 8).
- Police are the **Policía de Velamar (PVD)**, with white-and-blue patrol cars marked "PVD" on the
  bonnet and the "Gaviota" aircraft appearing at 4-5 stars.
- Local adverts promote **Sol Bravo** beer, **Radio Marea 88.7** and **Banco Cocal**.

The visual target is golden late-afternoon sun, long shadows, warm haze, vivid bougainvillea and
turquoise water; after dark, sodium lamps, glowing signs, lit windows and red/blue police strobes
take over. The look stays coherent, sun-faded and never grey, with no HUD covering screen centre.

Keyboard and mouse controls:

- `WASD` move or drive; `Shift` sprint on foot or handbrake in a car; `Space` jump or handbrake.
- Mouse look via pointer lock; `E` enter or leave a vehicle; `F` fire; right mouse button aim;
  `R` reload; `1 2 3` pick a weapon; `C` adjust camera distance; `M` map; `Esc` pause; `F5` save;
  `F9` load.

## 2. Systems and acceptance criteria

Each feature below must work in the finished build and appear in at least one capture.

1. **City** — a grid of blocks, asphalt roads with lane paint, kerbs and pavements; three building
   types (glass towers, midrise blocks, low-rise shops with awnings); palms, road lamps, traffic
   signals, benches, hydrants and billboards for our own brands. Include a sandy beach and sea, a
   marina with jetties and moored boats, and stacked containers at the docks. Cars may travel a
   whole road; buildings block movement via AABB collision sped up by a broadphase grid.
2. **Player on foot** — an over-the-shoulder camera on a spring arm that shortens near obstacles,
   walking and running, an animated stride (swinging arms and legs plus body bob), jumping,
   landing and footstep audio.
3. **Vehicles** — six shapes: sedan, coupe, van, pickup, sports car and police cruiser. Build each
   from merged boxes with vertex colours so one car takes one draw call. Arcade handling covers grip
   and high-speed drift; include brake lights, night headlights, `E` to enter and exit, and damage
   with smoke once wrecked.
4. **Traffic and pedestrians** — maintain at least 24 cars and 40 citizens near the player, cars on
   the road graph and walkers on pavements. Traffic keeps to lanes, slows for cars ahead and
   respawns behind the player. Pedestrians flinch and flee from gunfire and car horns.
5. **Wanted level** — crimes (assault, stealing a car, shooting, hitting a pedestrian, killing an
   officer) raise a 0-5 star rating. Cruisers chase on roads and patrol officers pursue on foot and
   shoot; roadblocks arrive at 3 stars and the aircraft at 4. The rating cools after 20-40 seconds
   out of sight. Stars, sirens and flashing lightbars must be clear on the HUD and in the world.
6. **Combat** — pistol, SMG and shotgun with distinct spread, firing rate and sound. Hitscan shots
   against police and pedestrians create impact sparks, muzzle flash, tracers and recoil. Track
   health and armour, show a damage flash as the player bleeds out, handle death and respawn at the
   nearest hospital with a cash penalty.
7. **Missions and story** — 8 missions, each with a marker over the giver, typed dialogue,
   objectives, a minimap waypoint arrow, a money reward, an unlock order and a completion screen.
   Objectives include going somewhere, stealing a vehicle, delivering it, eliminating a target,
   surviving a wanted level, a checkpoint race and an escort.
8. **HUD and minimap** — display health and armour meters, cash, wanted stars, current weapon and
   ammo, the clock and the district name. A live top-down minimap on a 2D canvas shows roads,
   blocks, the player's arrow, police blips, the mission marker and the garage. Add a speedometer
   while driving, toast messages and a mission dialogue box. Everything stays legible at 1280x720.
9. **Menus, saving and pause** — a title screen with New Game / Continue plus settings for mouse
   sensitivity, volume, quality (low/mid/high) and inverted Y. Pause offers Resume, Settings, Save,
   Load and Quit to title. `localStorage` stores and restores position, money, health, weapons,
   wanted level, mission progress and time of day. Include game over and restart.
10. **Audio** — generate every sound with the Web Audio API and ship no audio files. Provide an engine
    note that tracks speed, tyre squeal, a distinct gunshot per weapon, sirens, footsteps, pickup
    sounds, interface clicks, an ambient city layer and a brief looping music theme. Audio starts on
    the first click to satisfy browser autoplay rules.
11. **Day/night** — a clock advancing roughly 1 in-game hour every 30 seconds, with sun position and
    sky colour set by the hour and fog matched to it. Street lamps and windows light up after dark,
    and cars switch their headlights on at night.

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

## 4. Visual style and performance limits

- Palette: sky ranging from `#ffd9a0` to `#7fc4e8`, asphalt `#3b3f45`, kerbs `#c9c2b2`, stucco in
  `#f2e2c9`, `#e8b06a` and `#f5f0e6`, glass `#8fb7c9`, foliage `#2f6b3f`, sand `#e6d3a8`, water
  `#1d7f8c`, and neon accents `#ff4f7a` and `#37e0d6`.
- Budget: roughly 250 draw calls and 180k triangles at most, even on the busiest street, with 60 fps
  on a mid-range laptop. Use `InstancedMesh` for buildings, palms, lamps, street props, traffic
  bodies and pedestrians. Merge each distinct vehicle and character into one geometry, share one
  material per family and disable shadows.
- Create density with silhouettes, colour and props instead of more polygons.
- Put a dark translucent quad under every vehicle and character in place of real shadows.

## 5. Capture states (`?shot=`)

The screenshot runner opens `?shot=<name>&seed=7`, waits for `window.__shotReady`, then saves
`screenshots/<name>.jpg` at 1280x720 with JPEG quality 82. Four staged states are required, and each
one should display several systems at once:

1. `1-cover` — golden-hour light, Rafa walking the Costanera boulevard with moving traffic, walkers,
   palms, a distant mission marker and HUD elements including the minimap and objective text. The
   image must read unmistakably as a living city.
2. `2-chase` — a coupe speeding along a three-lane road, three police cruisers in pursuit with active
   lightbars, three HUD stars, police blips on the minimap and a visible speedometer.
3. `3-combat` — night-time in Mercado: on foot, four PVD officers firing, muzzle flashes and tracer
   rounds in the air, low health, four stars, the aircraft searchlight sweeping overhead and neon
   signs nearby.
4. `4-mission` — the marina dialogue beat with its objective marker, purple dusk, parked cars, a boat
   on the water and a cash-reward toast.

The repository-root `shots.json` records these same states and their queries.

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

- Use `node serve.ts` to serve `game/` at http://localhost:8080 for human playtesting.
- `node tools/smoke.mjs`, written in step 1, serves `game/` on a free port, starts headless Chromium,
  blocks all off-localhost requests, sends scripted input for several seconds and prints console
  errors, `window.__velamar.stats` and failed requests. Any failure gives exit status 1.
- Run `node tools/shoot.mjs` to generate the screenshots.

Both harnesses rely on this preinstalled environment, which is not part of the submission:

```
NODE_PATH=/workspace/tools/qa/node_modules
PLAYWRIGHT_BROWSERS_PATH=/workspace/tools/qa/browsers
LD_LIBRARY_PATH=/workspace/.tmp/libs/usr/lib/x86_64-linux-gnu
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
```

Launch Chromium using `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader
--no-sandbox`. This software renderer is slower than a GPU, so the budgets in section 4 are important.
