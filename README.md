# baba-uming-tech/gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/baba-uming-tech/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/baba-uming-tech/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VELAMAR** is an original, complete open-world crime game that runs in a desktop browser. You play
Rafa Quintero, a dock worker in a sun-soaked coastal city: walk the boulevard, steal a car, drive
traffic-choked streets, take story jobs from a fixer, and outrun a five-star police response.
Everything in it — the city of Velamar, its five districts, the people, cars, brands, story, art and
sound — is invented for this project. Nothing is taken from Grand Theft Auto, Rockstar Games or any
other commercial game.

It is static files: no build step, no framework, no network request at run time. three.js is
vendored under `game/vendor/`, the city is generated procedurally from a seed, and all audio is
synthesised with the Web Audio API.

**In the game:** a five-district city on the coast (Costanera beachfront, Centro towers, Mercado,
Muelle docks, Cerro Alto) with a marina and a beach · cars to steal (six bodies) · traffic and
pedestrians · a wanted level with police cruisers, foot officers, roadblocks and an air unit ·
pistol, SMG and shotgun with health and armour · eight story missions with dialogue and rewards · a
HUD with a live minimap, health, armour, cash, wanted stars and a speedometer · start, pause,
settings and game-over menus · a save in `localStorage` · a day-night cycle · procedural sound and
music.

## Run it

```sh
node serve.ts                                  # http://localhost:8080 — play it in desktop Chrome
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/game, out/screenshots, out/dossier.json
```

Controls: `WASD` move or drive, mouse look, `Shift` sprint or handbrake, `Space` jump, `E` enter or
leave a car, `F` fire, right mouse aim, `R` reload, `1` `2` `3` weapons, `C` camera distance, `Esc`
pause, `F5` save, `F9` load.

`tools/smoke.mjs` boots the game headlessly, blocks every offsite request and fails on any console
error; `tools/shoot.mjs` renders the four screenshots in `screenshots/` from the game's own
`?shot=` states. Maps and the story live in `game/src/` (see `BRIEF.md` for the module map).

Licensed under the MIT license in `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
