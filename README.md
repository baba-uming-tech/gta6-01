# VELAMAR

A complete, original open-world crime game that runs in a desktop browser, built as an entry for
make.fun's **"Make GTA 6"** bounty (`gta6-01`).

The city, people, cars, brands, story, art and sound are invented for this project. Nothing is
taken from Grand Theft Auto, Rockstar Games or any other commercial game.

- **Play it:** serve `game/` with any static file server and open `index.html` in desktop Chrome.
  There is no build step and no network request at run time: three.js is vendored under
  `game/vendor/`.
- **Controls:** `WASD` move or drive, mouse look, `Shift` sprint / handbrake, `Space` jump, `E`
  enter or leave a car, `F` fire, right mouse aim, `R` reload, `1 2 3` weapons, `Esc` pause,
  `F5` save, `F9` load.
- **What is in it:** a coastal city of five districts, traffic and pedestrians, cars to steal and
  drive, a five-star wanted level with pursuing police, foot officers, roadblocks and an air unit,
  firearms and a health/armour system, eight story missions with dialogue and rewards, a full HUD
  with a live minimap, start/pause/settings menus, a save in `localStorage`, a day-night cycle and
  procedural Web Audio sound and music.

```
node serve.ts           # http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/game, out/screenshots, out/dossier.json
```

`tools/` holds the development helpers: `smoke.mjs` (headless boot and play test, fails on console
errors or offsite requests) and `shoot.mjs` (takes `screenshots/` from the game's `?shot=` states).

Licensed under the MIT license in `LICENSE`.
