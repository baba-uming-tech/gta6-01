# AGENTS.md — how to work in this repository

This repository is the entry for make.fun's **"Make GTA 6"** bounty (`gta6-01`): VELAMAR, an
original open-world crime game that runs in a desktop browser from static files under `game/`.

## Every session, in this order

1. Read `BRIEF.md` in full before you write anything. It holds the game's design, the module
   contracts, the build order (section 6) and the tools (section 7).
2. Find the next unfinished step in `BRIEF.md` section 6 by looking at which files exist under
   `game/src/` and whether `node tools/smoke.mjs` passes. Do that step, completely.
3. Run `node tools/smoke.mjs` (create it as part of step 1 if it is missing) and fix what it
   reports: console errors, failed offsite requests, a blank screen. Do not stop with a broken game.
4. Commit is not required; leave the working tree with the step finished and the game bootable.

## Rules that do not change

- `game/` must run offline: no `http:`, `https:` or `//host` reference in any file under `game/`,
  no CDN, no font from the network. three.js is vendored at `game/vendor/three.module.min.js` and
  imported as `three`.
- Everything is original: no Grand Theft Auto, Rockstar Games or other commercial game's names,
  characters, map, art, music or text. The city is Velamar, our own.
- Do not change `main.ts`, `serve.ts`, `vendor/makefun-game.ts`, `LICENSE`, or the interfaces in
  `BRIEF.md` section 3. If a contract has to change, change it in `BRIEF.md` in the same step and
  keep every caller in sync.
- Keep one file to one job and name functions for what they do; the judge reads file paths and the
  first declarations of every file.
- The game's entry point is `game/index.html`; `src/main.js` boots it.
- Keep `window.__velamar = { ready, stats }` and `window.__shotReady` working: the smoke test and the
  screenshot tool read them.
