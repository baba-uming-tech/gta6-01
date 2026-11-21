# AGENTS.md — working notes

## What this is

`gta6-01` is our make.fun **"Make GTA 6"** entry. The product is VELAMAR, an original browser crime
game whose static files live in `game/`.

## Working order

- Before touching any file in a session, read all of `BRIEF.md`. It holds the design, the module
  signatures, the phase list in section 6 and the commands in section 7.
- Compare section 6 with what exists in `game/src/` and with the result of `node tools/smoke.mjs`,
  then take the first unfinished phase and carry it through to completion.
- After every code change, run `node tools/smoke.mjs`; create it in phase 1 if it is missing. Clear any
  console errors, requests that leave the host, or a blank canvas. Never leave the game broken.
- Commits are not required. The aim is a completed phase and a game that still launches.

## Rules

- `game/` must work offline: no `http:`, `https:` or `//host`, no CDN and no remote fonts. The local
  copy of three.js is `game/vendor/three.module.min.js`, imported under the name `three`.
- Use only original work. GTA/Rockstar and other commercial-game names, characters, maps, images,
  music and text are prohibited. Velamar is a city of our own invention.
- Treat `main.ts`, `serve.ts`, `vendor/makefun-game.ts`, `LICENSE` and the interfaces in section 3 of
  `BRIEF.md` as frozen. If an interface must change, edit the brief and all its callers in that same
  step.
- Give each file one responsibility and use descriptive file names, since graders inspect paths and
  first declarations.
- `game/index.html` is the page players open, and `src/main.js` starts the game.
- Keep `window.__velamar = { ready, stats }` and `window.__shotReady` available for the smoke and
  screenshot tools.
