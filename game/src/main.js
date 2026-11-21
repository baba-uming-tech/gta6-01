// Boots the game, owns the single clamped requestAnimationFrame loop and the four game states
// (menu, play, paused, dead). Publishes window.game and window.__velamar for the QA tools.

import { KEYBINDS } from './config.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { clamp, makeRng } from './core/rng.js';
import { Renderer } from './render/scene.js';
import { SkySystem } from './render/sky.js';
import { buildCity } from './world/city.js';
import { Traffic } from './world/traffic.js';
import { Police } from './entities/police.js';
import { Player } from './entities/player.js';
import { Vehicle } from './entities/vehicle.js';
import { applyShot } from './gameplay/shots.js';
import { Combat, WEAPONS, WEAPON_ORDER } from './gameplay/combat.js';
import { Missions } from './gameplay/missions.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Menus } from './ui/menus.js';
import { saveGame, loadGame, clearSave } from './core/save.js';

const app = document.getElementById('app');
const menuRoot = document.getElementById('menus');
const perf = document.getElementById('perf');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const renderer = new Renderer(app);
window.framePoint = (worldX, worldY, worldZ) => renderer.framePoint(worldX, worldY, worldZ);
const sky = new SkySystem(renderer.scene, renderer);
const input = new Input();
const audio = new AudioEngine();
const seed = Number(params.get('seed')) || 7;
const city = buildCity(renderer.scene, makeRng(seed), 'mid');
const FLEET = [
  { specId: 'sedan', x: -153, z: 222.7, heading: Math.PI / 2 },
  { specId: 'coupe', x: -124, z: 217.3, heading: -Math.PI / 2 },
  { specId: 'van', x: -84, z: 222.7, heading: Math.PI / 2 },
  { specId: 'pickup', x: -44, z: 217.3, heading: -Math.PI / 2 },
  { specId: 'sports', x: -4, z: 222.7, heading: Math.PI / 2 },
  { specId: 'police', x: 36, z: 217.3, heading: -Math.PI / 2 },
];
const vehicles = FLEET.map((item) => new Vehicle(renderer.scene, city, item.specId, item));
const traffic = new Traffic(renderer.scene, city, makeRng(seed + 917));
const police = new Police(renderer.scene, city, makeRng(seed + 331));
renderer.scene.userData.onNightChange = (on) => {
  city.setNight(on);
  for (const vehicle of vehicles) vehicle.setNight(on);
  traffic.setNight(on);
};
city.setNight(sky.isNight);
for (const vehicle of vehicles) vehicle.setNight(sky.isNight);
traffic.setNight(sky.isNight);
const spawn = city.spawnPoint;
const view = city.spawnLookAt ?? [spawn[0] + 90, spawn[1] + 0.4, spawn[2] + 4];
const startYaw = Math.atan2(view[0] - spawn[0], view[2] - spawn[2]);
const player = new Player(renderer.scene, city);
player.reset(spawn[0], spawn[2], startYaw, renderer.camera);
const combat = new Combat(renderer.scene, audio);
const hud = new Hud(document.getElementById('hud'));
const minimap = new Minimap(hud.minimapCanvas, city);
const missions = new Missions(city, hud, audio).attach({ game: null, player, police, traffic, vehicles });

const settings = { sensitivity: 1, volume: 0.8, quality: renderer.quality, invertY: false };
audio.setVolume(settings.volume);
audio.music('menu');

const game = {
  state: 'menu',
  ready: false,
  time: 0,
  quality: 'mid',
  focus: { x: view[0], y: view[1], z: view[2] },
  renderer,
  sky,
  input,
  audio,
  city,
  player,
  vehicles,
  traffic,
  police,
  combat,
  hud,
  minimap,
  missions,
  settings,
  shot: null,
  shotLabel: '',
  shotFrames: 0,
  setQuality(name) {
    if (!renderer.setQuality) return;
    renderer.setQuality(name);
    game.quality = renderer.quality;
  },
  start() {
    if (game.state === 'shot') return;
    for (const vehicle of vehicles) vehicle.setDriver(null);
    player.reset(spawn[0], spawn[2], startYaw, renderer.camera);
    player.health = 100;
    player.armour = 50;
    player.money = 500;
    combat.holdDeath = false;
    combat.reset();
    missions.reset();
    police.clear();
    police.setFocus(null);
    sky.auto = true;
    sky.setHour(17.2);
    traffic.redistribute(player.position.x, player.position.z, renderer.camera.position);
    audio.music('drive');
    game.state = 'play';
    menus.hide();
  },
  pause() {
    if (game.state !== 'play') return;
    game.state = 'paused';
    menus.show('pause');
  },
  resume() {
    if (game.state !== 'paused') return;
    game.state = 'play';
    menus.hide();
  },
  quit() {
    if (game.state === 'shot') return;
    combat.holdDeath = false;
    combat.reset();
    police.clear();
    police.setFocus(null);
    player.reset(spawn[0], spawn[2], startYaw, renderer.camera);
    player.health = 100;
    player.armour = 50;
    player.money = 500;
    sky.auto = true;
    sky.setHour(17.2);
    audio.engine(0, 0);
    audio.music('menu');
    game.state = 'menu';
    menus.show('start');
  },
};
missions.attach({ game });
window.game = game;

function applySetting(key, value) {
  settings[key] = value;
  if (key === 'quality') game.setQuality(value);
  if (key === 'volume') audio.setVolume(value);
  if (key === 'sensitivity') player.sensitivity = value;
  if (key === 'invertY') player.invertY = value;
}

function saveSnapshot() {
  const weapon = WEAPONS[combat.weapon] ? combat.weapon : player.weapon;
  return {
    position: [player.position.x, player.position.y, player.position.z],
    yaw: player.yaw,
    cameraYaw: player.cameraYaw,
    money: player.money,
    health: player.health,
    armour: player.armour,
    weapon,
    weapons: WEAPON_ORDER.slice(),
    ammo: { ...combat.magazine },
    reserve: { ...combat.reserve },
    wanted: police.wanted,
    missionProgress: missions.index,
    hour: sky.hour,
  };
}

function saveNow() {
  if (game.state === 'shot') return false;
  const ok = saveGame(saveSnapshot());
  hud.toast(ok ? 'GAME SAVED' : 'SAVE UNAVAILABLE');
  return ok;
}

function loadNow() {
  const data = loadGame();
  if (!data || game.state === 'shot') {
    hud.toast('NO SAVE FOUND');
    return false;
  }
  const position = Array.isArray(data.position) ? data.position : city.spawnPoint;
  const x = Number(position[0]);
  const z = Number(position[2]);
  player.reset(Number.isFinite(x) ? x : city.spawnPoint[0], Number.isFinite(z) ? z : city.spawnPoint[2],
    Number(data.yaw) || startYaw, renderer.camera);
  player.cameraYaw = Number(data.cameraYaw) || player.cameraYaw;
  player.money = Math.max(0, Number(data.money) || 0);
  player.health = Math.max(1, Math.min(100, Number(data.health) || 100));
  player.armour = Math.max(0, Math.min(100, Number(data.armour) || 0));
  combat.holdDeath = false;
  combat.reset();
  for (const id of WEAPON_ORDER) {
    const spec = WEAPONS[id];
    combat.magazine[id] = Math.max(0, Math.min(spec.magazine, Number(data.ammo?.[id]) ?? spec.magazine));
    combat.reserve[id] = Math.max(0, Number(data.reserve?.[id]) ?? spec.reserve);
  }
  const weapon = WEAPONS[data.weapon] ? data.weapon : 'pistol';
  combat.setWeapon(weapon);
  player.weapon = weapon;
  player.ammo[weapon] = combat.magazine[weapon];
  missions.reset();
  missions.index = Math.max(0, Math.min(8, Number(data.missionProgress) || 0));
  police.setWanted(Math.max(0, Math.min(5, Number(data.wanted) || 0)));
  sky.auto = true;
  sky.setHour(Number.isFinite(Number(data.hour)) ? Number(data.hour) : 17.2);
  traffic.redistribute(player.position.x, player.position.z, renderer.camera.position);
  audio.music('drive');
  game.state = 'play';
  menus.hide();
  hud.toast('GAME LOADED');
  return true;
}

const menus = new Menus(menuRoot, {
  settings,
  onClick: () => audio.sfx('uiClick'),
  onNew: () => {
    clearSave();
    game.start();
    input.lock(renderer.renderer.domElement);
  },
  onContinue: () => {
    if (loadNow()) input.lock(renderer.renderer.domElement);
  },
  onResume: () => {
    game.resume();
    input.lock(renderer.renderer.domElement);
  },
  onSettings: () => menus.show('settings'),
  onSave: saveNow,
  onLoad: () => {
    if (loadNow()) input.lock(renderer.renderer.domElement);
  },
  onQuit: () => game.quit(),
  onRestart: () => {
    game.start();
    input.lock(renderer.renderer.domElement);
  },
  onSettingChange: applySetting,
});

const combatTargets = {
  game,
  player,
  police,
  traffic,
  city,
  input,
  camera: renderer.camera,
};

function publishReady() {
  if (game.ready) return;
  game.ready = true;
  window.__velamar = { ready: true, stats: renderer.stats };
}

const blipStore = [];
const activeBlips = [];
let blipCount = 0;

function addBlip(x, z, kind) {
  if (!blipStore[blipCount]) blipStore[blipCount] = { x: 0, z: 0, kind: '' };
  const blip = blipStore[blipCount];
  blip.x = x;
  blip.z = z;
  blip.kind = kind;
  activeBlips[blipCount] = blip;
  blipCount += 1;
}

function districtName() {
  let best = city.districts?.[0];
  let bestDistance = Infinity;
  for (const district of city.districts ?? []) {
    const distance = (district.cx - player.position.x) ** 2 + (district.cz - player.position.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = district;
    }
  }
  return best?.name ?? 'Velamar';
}

function missionObjective() {
  const current = game.missions?.current;
  return current?.objective ?? current?.text ?? game.missions?.objectiveText
    ?? (game.shot === '4-mission' ? 'Meet Nina at the marina' : 'Meet Nina at Taller Tuco');
}

function missionTarget() {
  const current = game.missions?.current;
  return current?.target ?? current?.marker ?? current?.location ?? game.missions?.target
    ?? (game.shot === '4-mission' ? { x: 194, z: 312 } : { x: -64, z: 206 });
}

function collectBlips() {
  blipCount = 0;
  for (const unit of police.units) {
    if (unit.kind === 'roadblock') continue;
    addBlip(unit.position.x, unit.position.z, unit.kind === 'air' ? 'air' : 'police');
  }
  for (const landmark of city.landmarks ?? []) {
    addBlip(landmark.x, landmark.z, landmark.id === 'garage' ? 'garage' : 'hospital');
  }
  const target = missionTarget();
  if (target) addBlip(target.x, target.z, 'mission');
  activeBlips.length = blipCount;
}

function updateGameHud() {
  const vehicle = player.inVehicle ? player.vehicle : null;
  const weapon = WEAPONS[combat.weapon] ? combat.weapon : player.weapon;
  const visible = game.state !== 'menu';
  hud.setVisible(visible);
  hud.update({
    health: player.health,
    armour: player.armour,
    money: player.money,
    wanted: police.wanted,
    weaponName: WEAPONS[weapon]?.name ?? 'Pistol',
    ammo: combat.magazine[weapon] ?? player.ammo[weapon] ?? 0,
    reserve: combat.reserve[weapon] ?? 0,
    reloading: combat.reloadTimer > 0,
    hour: sky.hour,
    district: districtName(),
    inVehicle: player.inVehicle,
    speed: vehicle?.speed ?? 0,
    vehicleName: vehicle?.spec?.name ?? 'Vehicle',
    police: { wanted: police.wanted, units: police.units.length },
    mission: { objective: missionObjective(), target: missionTarget() },
    vehicle: vehicle ? { name: vehicle.spec.name, health: vehicle.health } : null,
  });
  hud.setObjective(missionObjective());
  hud.setPrompt(game.state === 'play'
    ? (vehicle ? 'EXIT VEHICLE' : (missions.prompt || (nearestVehicle() ? 'DRIVE VEHICLE' : '')))
    : '');
  collectBlips();
  minimap.draw(player, activeBlips);
}

let hudTick = 0;
function updateHud() {
  updateGameHud();
  hudTick += 1;
  if (hudTick % 12) return;
  const tris = Math.round(renderer.stats.triangles / 1000);
  perf.textContent = game.shotLabel
    ? `${game.shotLabel} · ${renderer.stats.drawCalls} draws`
    : `${Math.round(renderer.stats.fps)} fps · ${renderer.stats.drawCalls} draws · ${tris}k tris`;
}

function handleActions() {
  if (input.pressed(KEYBINDS.pause)) {
    if (game.state === 'play') game.pause();
    else if (game.state === 'paused') game.resume();
  }
  if (input.pressed(KEYBINDS.confirm) && (game.state === 'menu' || game.state === 'dead')) game.start();
  if (game.state === 'play') {
    if (input.pressed(KEYBINDS.save)) saveNow();
    if (input.pressed(KEYBINDS.load)) loadNow();
  }
}

function nearestVehicle(radius = 5.5) {
  let best = null;
  let bestDistance = radius * radius;
  for (const vehicle of vehicles) {
    const distance = (vehicle.position.x - player.position.x) ** 2
      + (vehicle.position.z - player.position.z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = vehicle;
    }
  }
  return best;
}

function handleVehicleEntry() {
  if (!input.pressed(KEYBINDS.enter)) return;
  if (player.inVehicle) player.exitVehicle();
  else if (missions.prompt) missions.tryStart();
  else {
    const vehicle = nearestVehicle();
    if (vehicle) player.setVehicle(vehicle);
  }
}

function updatePlay(dt) {
  handleVehicleEntry();
  if (input.pressed('KeyH')) {
    traffic.horn(player.position.x, player.position.z, 20);
    audio.sfx('horn');
  }
  const driving = player.vehicle;
  if (player.inVehicle && driving
    && (input.isDown(KEYBINDS.handbrake) || input.isDown(KEYBINDS.jump))
    && Math.abs(driving.speed) > 8) audio.sfx('screech');
  player.update(dt, input, renderer.camera, game);
  missions.update(dt, player);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, 1 / 20);
  last = now;
  game.time += dt;
  if (game.state === 'play') updatePlay(dt);
  traffic.update(dt, shot ? (game.trafficFocus ?? player.position) : player.position);
  if (game.state === 'play' || game.state === 'dead') police.update(dt, player);
  combat.update(dt, dt, combatTargets);
  if (game.state === 'dead' && menus.screen !== 'gameover') {
    combat.holdDeath = true;
    menus.setMessage(`DOWN IN VELAMAR · $${combat.deadPaid} LOST TO THE CLINIC`);
    menus.show('gameover');
  }
  handleActions();
  input.endFrame();
  sky.update(dt, renderer.camera);
  renderer.render();
  updateHud();
  publishReady();
  if (game.state === 'shot' && !window.__shotReady) {
    game.shotFrames += 1;
    if (game.shotFrames >= 3) window.__shotReady = true;
  }
}

app.addEventListener('click', () => {
  if (game.state === 'play' && !input.locked) input.lock(renderer.renderer.domElement);
});

let last = performance.now();
if (shot) {
  applyShot(shot, game);
  traffic.redistribute(game.trafficFocus?.x ?? renderer.camera.position.x,
    game.trafficFocus?.z ?? renderer.camera.position.z, renderer.camera.position);
  menus.hide();
}
requestAnimationFrame(frame);
