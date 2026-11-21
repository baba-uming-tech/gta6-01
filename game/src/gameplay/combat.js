import * as THREE from 'three';
import { KEYBINDS } from '../config.js';
import { clamp, damp } from '../core/rng.js';
import { makeBox } from '../render/parts.js';

export const WEAPONS = {
  pistol: {
    name: 'Pistol', sound: 'pistol', rate: 0.24, spread: 0.012, damage: 26,
    pellets: 1, range: 135, magazine: 12, reserve: 84, recoil: 0.85,
    kick: 0.013, tracerLife: 0.085, tracerWidth: 0.05,
  },
  smg: {
    name: 'SMG', sound: 'smg', rate: 0.078, spread: 0.036, damage: 13,
    pellets: 1, range: 100, magazine: 45, reserve: 225, recoil: 0.42,
    kick: 0.008, tracerLife: 0.07, tracerWidth: 0.045,
  },
  shotgun: {
    name: 'Shotgun', sound: 'shotgun', rate: 0.7, spread: 0.105, damage: 13,
    pellets: 8, range: 55, magazine: 8, reserve: 40, recoil: 2.4,
    kick: 0.04, tracerLife: 0.055, tracerWidth: 0.04,
  },
};

export const WEAPON_ORDER = ['pistol', 'smg', 'shotgun'];

const TRACERS = 48;
const FLASHES = 16;
const SPARKS = 96;
const WALL_STEP = 4;
const DEATH_TIME = 3;
const FORWARD = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;

function pooled(group, geometry, material, count) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    group.add(mesh);
    items.push({ mesh, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 });
  }
  return items;
}

function makeCrosshair(hud) {
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;left:50%;top:50%;width:42px;height:42px;'
    + 'margin-left:-21px;margin-top:-21px;pointer-events:none;opacity:1;'
    + 'transition:opacity .12s linear;';
  const arms = [];
  const placements = [
    'left:20px;top:0;width:2px;height:11px;',
    'left:20px;bottom:0;width:2px;height:11px;',
    'top:20px;left:0;height:2px;width:11px;',
    'top:20px;right:0;height:2px;width:11px;',
  ];
  for (const placement of placements) {
    const arm = document.createElement('i');
    arm.style.cssText = `position:absolute;background:#fff8e4;box-shadow:0 0 3px #000,0 0 6px #000;${placement}`;
    root.appendChild(arm);
    arms.push(arm);
  }
  const marker = document.createElement('i');
  marker.style.cssText = 'position:absolute;left:19px;top:19px;width:4px;height:4px;'
    + 'border-radius:50%;background:#ff5a4e;box-shadow:0 0 6px #ff3b2c;opacity:0;';
  root.appendChild(marker);
  hud?.appendChild(root);
  return { root, arms, marker };
}

export class Combat {
  constructor(scene, audio) {
    this.audio = audio ?? null;
    this.targets = null;
    this.time = 0;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.crimeCooldown = 0;
    this.recoil = 0;
    this.aim = false;
    this.dead = false;
    this.holdDeath = false;
    this.deathTimer = 0;
    this.deadPaid = 0;
    this.damageFlash = 0;
    this.hitMarker = 0;
    this.lastHealth = 100;
    this.weapon = 'pistol';
    this.magazine = { pistol: 12, smg: 45, shotgun: 8 };
    this.reserve = { pistol: 84, smg: 225, shotgun: 40 };
    this.pedHealth = new WeakMap();
    this.demo = false;
    this.demoTimer = 0;

    this.group = new THREE.Group();
    this.group.name = 'Combat effects';
    scene.add(this.group);

    const glow = new THREE.MeshBasicMaterial({
      vertexColors: true, fog: false, transparent: true, opacity: 0.92,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.tracers = pooled(this.group, makeBox(0.05, 0.05, 1, '#ffe3a0'), glow, TRACERS);
    this.flashes = pooled(this.group, new THREE.ConeGeometry(0.23, 0.75, 6), new THREE.MeshBasicMaterial({
      color: 0xfff1bc, fog: false, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }), FLASHES);
    this.sparks = pooled(this.group, makeBox(0.09, 0.09, 0.09, '#ffd08a'), glow, SPARKS);

    const hud = typeof document === 'undefined' ? null : document.getElementById('hud');
    const crosshair = hud ? makeCrosshair(hud) : null;
    this.crosshair = crosshair?.root ?? null;
    const marker = crosshair?.marker ?? null;
    this._marker = marker;
    this.vignette = null;
    this.deathText = null;
    if (hud) {
      this.vignette = document.createElement('div');
      this.vignette.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;'
        + 'background:radial-gradient(ellipse at center,rgba(150,0,0,0) 30%,'
        + 'rgba(150,10,10,.24) 62%,rgba(120,0,0,.82) 100%);';
      hud.appendChild(this.vignette);
      this.deathText = document.createElement('div');
      this.deathText.style.cssText = 'position:absolute;left:0;right:0;top:38%;text-align:center;'
        + 'pointer-events:none;opacity:0;transition:opacity .35s linear;color:#ffe9cf;'
        + 'text-shadow:0 3px 12px #000,0 0 24px #000;font:800 42px/1.2 system-ui,sans-serif;'
        + 'letter-spacing:.18em;';
      hud.appendChild(this.deathText);
    }

    this._muzzle = new THREE.Vector3();
    this._direction = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._shot = new THREE.Vector3();
    this._far = new THREE.Vector3();
    this._probe = new THREE.Vector3();
    this._before = new THREE.Vector3();
    this._point = new THREE.Vector3();
    this._targetCenter = new THREE.Vector3();
    this._result = { point: this._point, distance: 0, target: null, kind: null };
  }

  get effects() {
    return {
      tracers: this.tracers,
      flashes: this.flashes,
      sparks: this.sparks,
      crosshair: this.crosshair,
      vignette: this.vignette,
      deathText: this.deathText,
    };
  }

  setWeapon(kind) {
    if (!WEAPONS[kind]) return this.weapon;
    this.weapon = kind;
    this.reloadTimer = 0;
    const player = this.targets?.player;
    if (player) {
      player.weapon = kind;
      player.ammo[kind] = this.magazine[kind];
    }
    this.audio?.sfx?.('weaponSwitch', { weapon: kind });
    return kind;
  }

  reload() {
    const kind = this.weapon;
    const spec = WEAPONS[kind];
    const need = spec.magazine - this.magazine[kind];
    if (need <= 0 || this.reserve[kind] <= 0) return false;
    const loaded = Math.min(need, this.reserve[kind]);
    this.magazine[kind] += loaded;
    this.reserve[kind] -= loaded;
    const player = this.targets?.player;
    if (player) player.ammo[kind] = this.magazine[kind];
    this.audio?.sfx?.('reload', { weapon: kind });
    return true;
  }

  _takeShot() {
    const kind = this.weapon;
    if (this.magazine[kind] <= 0) return false;
    this.magazine[kind] -= 1;
    const player = this.targets?.player;
    if (player) player.ammo[kind] = this.magazine[kind];
    return true;
  }

  _spawnTracer(from, to, width, life) {
    const item = this.tracers.find((entry) => entry.life <= 0);
    if (!item) return;
    this._direction.subVectors(to, from);
    const length = this._direction.length();
    if (length < 0.05) return;
    item.mesh.position.copy(from).addScaledVector(this._direction, 0.5);
    item.mesh.scale.set(width, width, length);
    item.mesh.quaternion.setFromUnitVectors(FORWARD, this._direction.divideScalar(length));
    item.mesh.visible = true;
    item.life = life;
    item.maxLife = life;
  }

  _spawnFlash(at, dir) {
    const item = this.flashes.find((entry) => entry.life <= 0);
    if (!item) return;
    item.mesh.position.copy(at).addScaledVector(dir, 0.18);
    item.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const size = 0.8 + Math.random() * 0.5;
    item.mesh.scale.set(size, size, size);
    item.mesh.visible = true;
    item.life = 0.05;
  }

  _spawnSparks(at, normal, count) {
    for (let i = 0; i < count; i += 1) {
      const item = this.sparks.find((entry) => entry.life <= 0);
      if (!item) return;
      item.mesh.position.copy(at);
      item.mesh.visible = true;
      item.life = 0.18 + Math.random() * 0.28;
      item.maxLife = item.life;
      const scale = 0.5 + Math.random() * 0.9;
      item.mesh.scale.set(scale, scale, scale);
      item.vx = normal.x * 2 + (Math.random() - 0.5) * 7;
      item.vy = 2 + Math.random() * 5;
      item.vz = normal.z * 2 + (Math.random() - 0.5) * 7;
    }
  }

  _hitDistance(center, radius, from, dir, limit) {
    this._targetCenter.subVectors(center, from);
    const along = this._targetCenter.dot(dir);
    if (along < 0 || along > limit) return Infinity;
    const perpendicularSq = this._targetCenter.lengthSq() - along * along;
    return perpendicularSq <= radius * radius ? along : Infinity;
  }

  _wallDistance(from, dir, limit, city) {
    if (!city?.collide) return limit;
    let travelled = 1;
    while (travelled < limit) {
      this._probe.copy(from).addScaledVector(dir, travelled);
      this._before.copy(this._probe);
      city.collide(this._probe, 0.22);
      if (Math.abs(this._probe.x - this._before.x) + Math.abs(this._probe.z - this._before.z) > 0.03) {
        return Math.max(0.5, travelled - WALL_STEP * 0.5);
      }
      travelled += WALL_STEP;
    }
    return limit;
  }

  _trace(from, dir, spec, shooter) {
    const targets = this.targets ?? {};
    const player = targets.player;
    let best = spec.range;
    let target = null;
    let kind = null;
    const fromPlayer = !shooter || shooter === player || shooter.isPlayer === true;

    if (fromPlayer) {
      const police = targets.police;
      if (police?.units) {
        for (const unit of police.units) {
          if (!Number.isFinite(unit.health) || unit.health <= 0) continue;
          const height = unit.kind === 'officer' ? 1.05 : unit.kind === 'air' ? 0 : 0.85;
          const radius = unit.kind === 'officer' ? 0.6 : unit.kind === 'air' ? 2.6 : 2.1;
          this._targetCenter.set(unit.position.x, unit.position.y + height, unit.position.z);
          const distance = this._hitDistance(this._targetCenter, radius, from, dir, best);
          if (distance < best) {
            best = distance;
            target = unit;
            kind = unit.kind;
          }
        }
      }
      const traffic = targets.traffic;
      if (traffic?.peds) {
        for (const ped of traffic.peds) {
          if (ped.state === 3) continue;
          this._targetCenter.set(ped.position.x, ped.position.y + 1.05 * ped.scale, ped.position.z);
          const distance = this._hitDistance(this._targetCenter, 0.58 * ped.scale, from, dir, best);
          if (distance < best) {
            best = distance;
            target = ped;
            kind = 'ped';
          }
        }
      }
    } else if (player && player.health > 0) {
      this._targetCenter.set(player.position.x, player.position.y + 1.1, player.position.z);
      const distance = this._hitDistance(this._targetCenter, player.inVehicle ? 1.8 : 0.7, from, dir, best);
      if (distance < best) {
        best = distance;
        target = player;
        kind = 'player';
      }
    }

    const wall = this._wallDistance(from, dir, best, targets.city);
    if (wall < best) {
      best = wall;
      target = null;
      kind = 'wall';
    }
    this._point.copy(from).addScaledVector(dir, best);
    this._result.distance = best;
    this._result.target = target;
    this._result.kind = kind;
    return this._result;
  }

  _applyHit(hit, spec, shooter) {
    const targets = this.targets ?? {};
    const police = targets.police;
    const traffic = targets.traffic;
    if (!hit.target) return;
    if (hit.kind === 'ped') {
      const ped = hit.target;
      const health = (this.pedHealth.get(ped) ?? 42) - spec.damage;
      this.pedHealth.set(ped, health);
      if (health <= 0) {
        traffic?.knockDown?.(ped);
        police?.report?.('pedestrian');
      } else {
        traffic?.stagger?.(ped, this._muzzle.x, this._muzzle.z);
        if (this.crimeCooldown <= 0) police?.report?.('assault');
      }
    } else if (hit.target === targets.player) {
      targets.player.takeDamage?.(spec.damage);
    } else if (police) {
      const killed = police.damage?.(hit.target, spec.damage);
      if (killed && hit.kind === 'officer') police.report?.('cop');
      else if (this.crimeCooldown <= 0) police.report?.('assault');
    }
    this._spawnSparks(hit.point, this._shot, hit.kind === 'wall' ? 5 : 3);
    this.hitMarker = 0.14;
  }

  fire(origin, dir, kind = 'pistol', shooter = null) {
    const spec = WEAPONS[kind] ?? WEAPONS.pistol;
    const targets = this.targets ?? {};
    const player = targets.player;
    const fromPlayer = !shooter || shooter === player || shooter.isPlayer === true;
    this._muzzle.copy(origin);
    this._direction.copy(dir).normalize();
    this._right.set(-this._direction.z, 0, this._direction.x);
    if (this._right.lengthSq() < 1e-6) this._right.set(1, 0, 0);
    this._right.normalize();
    this._up.crossVectors(this._right, this._direction).normalize();
    const spread = spec.spread * (fromPlayer && this.aim ? 0.42 : 1)
      * (fromPlayer ? 1 + this.recoil * 0.14 : 1);
    let hitSomething = false;
    for (let i = 0; i < spec.pellets; i += 1) {
      this._shot.copy(this._direction)
        .addScaledVector(this._right, (Math.random() - 0.5) * 2 * spread)
        .addScaledVector(this._up, (Math.random() - 0.5) * 2 * spread)
        .normalize();
      const hit = this._trace(this._muzzle, this._shot, spec, shooter);
      this._spawnTracer(this._muzzle, hit.point, spec.tracerWidth, spec.tracerLife);
      if (hit.target || hit.kind === 'wall') {
        this._applyHit(hit, spec, shooter);
        if (hit.target) hitSomething = true;
      }
    }
    this._spawnFlash(this._muzzle, this._direction);
    this.audio?.sfx?.(spec.sound, { weapon: kind });
    if (fromPlayer) {
      this.cooldown = spec.rate;
      this.recoil = Math.min(3.5, this.recoil + spec.recoil);
      if (player?.cameraPitch !== undefined) {
        player.cameraPitch = clamp(player.cameraPitch + spec.kick * (this.aim ? 0.65 : 1), -0.45, 0.78);
      }
      if (this.crimeCooldown <= 0 && targets.police) {
        targets.police.report?.('shooting');
        this.crimeCooldown = 1.5;
      }
      targets.traffic?.gunfire?.(player.position.x, player.position.z, 55);
      if (this.magazine[kind] === 0) this.reloadTimer = 0.4;
    }
    this._result.hit = hitSomething;
    return this._result;
  }

  _playerFire(targets) {
    const player = targets.player;
    if (!player || player.inVehicle || this.dead) return;
    const kind = player.weapon in WEAPONS ? player.weapon : 'pistol';
    if (kind !== this.weapon) this.setWeapon(kind);
    if (this.reloadTimer > 0 || this.cooldown > 0) return;
    if (this.magazine[kind] <= 0) {
      if (!this.reload()) this.reloadTimer = 0.5;
      return;
    }
    const camera = targets.camera;
    if (camera) {
      camera.getWorldDirection(this._far);
      this._far.multiplyScalar(140).add(camera.position);
    } else {
      this._far.set(player.position.x + Math.sin(player.yaw) * 140, player.position.y + 1.4,
        player.position.z + Math.cos(player.yaw) * 140);
    }
    this._muzzle.set(player.position.x, player.position.y + 1.28, player.position.z);
    this._forwardX = Math.sin(player.yaw);
    this._forwardZ = Math.cos(player.yaw);
    this._muzzle.x += this._forwardX * 0.32 - this._forwardZ * 0.26;
    this._muzzle.z += this._forwardZ * 0.32 + this._forwardX * 0.26;
    this._direction.subVectors(this._far, this._muzzle).normalize();
    if (!this._takeShot()) return;
    this.fire(this._muzzle, this._direction, kind, player);
  }

  _beginDeath(targets) {
    this.dead = true;
    this.deathTimer = DEATH_TIME;
    this.deadPaid = Math.min(targets.player.money, 250);
    targets.player.money -= this.deadPaid;
    if (targets.game) targets.game.state = 'dead';
    if (this.deathText) {
      this.deathText.innerHTML = 'DOWN<br><span style="font:600 16px/2 system-ui,sans-serif;'
        + 'letter-spacing:.24em;color:#ffd2a8">CLINICA SOLARIS · $'
        + this.deadPaid + ' LOST</span>';
      this.deathText.style.opacity = '1';
    }
    this.audio?.sfx?.('death');
  }

  respawn(targets = this.targets) {
    if (!targets) return false;
    this._respawn(targets);
    return true;
  }

  _respawn(targets) {
    const player = targets.player;
    const hospital = targets.city?.hospital ?? { x: targets.city.spawnPoint[0], z: targets.city.spawnPoint[2] };
    const x = hospital.x - 10;
    const z = hospital.z + 10;
    player.reset(x, z, Math.PI / 2, targets.camera);
    player.health = 100;
    player.armour = 25;
    this.lastHealth = 100;
    this.dead = false;
    this.damageFlash = 0;
    this.recoil = 0;
    targets.police?.clear?.();
    targets.police?.setFocus?.(null);
    targets.traffic?.redistribute?.(x, z, targets.camera?.position);
    if (targets.game) targets.game.state = 'play';
    if (this.deathText) this.deathText.style.opacity = '0';
    this.audio?.sfx?.('respawn');
  }

  _demoFire(dt, targets) {
    const police = targets.police;
    const focus = targets.game?.focus;
    if (!police?.units || !focus) return;
    this.demoTimer -= dt;
    if (this.demoTimer > 0) return;
    this.demoTimer = 0.22;
    let index = 0;
    for (const unit of police.units) {
      if (unit.kind !== 'officer') continue;
      if (index % 2 !== Math.floor(this.time / 0.22) % 2) {
        index += 1;
        continue;
      }
      index += 1;
      this._muzzle.set(unit.position.x, unit.position.y + 1.2, unit.position.z);
      this._direction.set(focus.x - this._muzzle.x, focus.y + 1 - this._muzzle.y,
        focus.z - this._muzzle.z).normalize();
      this._spawnTracer(this._muzzle, this._far.copy(this._muzzle).addScaledVector(this._direction, 26),
        0.06, 0.1);
      this._spawnFlash(this._muzzle, this._direction);
    }
  }

  _updateEffects(dt) {
    for (const item of this.tracers) {
      if (item.life <= 0) continue;
      item.life -= dt;
      item.mesh.visible = item.life > 0;
    }
    for (const item of this.flashes) {
      if (item.life <= 0) continue;
      item.life -= dt;
      item.mesh.visible = item.life > 0;
    }
    for (const item of this.sparks) {
      if (item.life <= 0) continue;
      item.life -= dt;
      item.vy -= 18 * dt;
      item.mesh.position.x += item.vx * dt;
      item.mesh.position.y += item.vy * dt;
      item.mesh.position.z += item.vz * dt;
      if (item.mesh.position.y < 0.05) {
        item.mesh.position.y = 0.05;
        item.vy *= -0.3;
      }
      const fade = clamp(item.life / item.maxLife, 0, 1);
      item.mesh.scale.setScalar(0.35 + fade * 0.8);
      item.mesh.visible = item.life > 0;
    }
  }

  _updateOverlay(dt, targets) {
    const player = targets.player;
    if (player) {
      if (player.health < this.lastHealth) {
        this.damageFlash = Math.min(1, this.damageFlash + (this.lastHealth - player.health) / 38);
        this.audio?.sfx?.('hurt');
      }
      this.lastHealth = player.health;
    }
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.9);
    const low = player ? clamp((42 - player.health) / 42, 0, 1) * 0.34 : 0;
    if (this.vignette) this.vignette.style.opacity = String(Math.min(0.92, this.damageFlash + low));
    this.hitMarker = Math.max(0, this.hitMarker - dt);
    if (this._marker) this._marker.style.opacity = this.hitMarker > 0 ? '1' : '0';
    if (this.crosshair) {
      const aimScale = this.aim && !this.dead ? 0.68 : 1;
      const spreadScale = 1 + this.recoil * 0.13;
      this.crosshair.style.transform = `scale(${(aimScale * spreadScale).toFixed(3)})`;
      this.crosshair.style.opacity = player?.inVehicle || this.dead ? '0' : '1';
    }
    if (targets.camera && targets.game?.state === 'play') {
      const desired = this.aim && !player?.inVehicle ? 49 : 65;
      if (Math.abs(targets.camera.fov - desired) > 0.05) {
        targets.camera.fov = damp(targets.camera.fov, desired, 12, dt);
        targets.camera.updateProjectionMatrix();
      }
    }
  }

  update(dt, unused, targets) {
    this.time += dt;
    if (targets) this.targets = targets;
    const state = targets.game?.state;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);
    this.recoil = damp(this.recoil, 0, 10, dt);

    if (state === 'play' && !this.dead) {
      const input = targets.input;
      if (input) {
        for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
          if (input.pressed(KEYBINDS[`weapon${i + 1}`])) this.setWeapon(WEAPON_ORDER[i]);
        }
        if (input.pressed(KEYBINDS.reload)) this.reload();
        this.aim = input.isDown(KEYBINDS.aim);
        if (input.isDown(KEYBINDS.fire)) this._playerFire(targets);
      }
    } else if (state === 'shot') {
      this.aim = false;
      if (this.demo) this._demoFire(dt, targets);
    }

    if (targets.player && targets.player.health <= 0 && !this.dead && state !== 'shot') {
      this._beginDeath(targets);
    }
    if (this.dead && !this.holdDeath) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn(targets);
    }
    this._updateEffects(dt);
    this._updateOverlay(dt, targets);
  }

  reset() {
    this.dead = false;
    this.holdDeath = false;
    this.deathTimer = 0;
    this.damageFlash = 0;
    this.recoil = 0;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.magazine = { pistol: 12, smg: 45, shotgun: 8 };
    this.reserve = { pistol: 84, smg: 225, shotgun: 40 };
    if (this.deathText) this.deathText.style.opacity = '0';
    this.setWeapon('pistol');
  }

  stage(name, game) {
    this.demo = name === '3-combat';
    this.demoTimer = 0;
    if (!this.demo) return;
    game.player.health = 28;
    game.player.armour = 0;
    this.lastHealth = 28;
    this.damageFlash = 0.42;
    this.setWeapon('smg');
    this.magazine.smg = 31;
    const focus = game?.focus;
    for (const unit of game?.police?.units ?? []) {
      if (unit.kind !== 'officer' || !focus) continue;
      this._muzzle.set(unit.position.x, unit.position.y + 1.2, unit.position.z);
      this._direction.set(focus.x - this._muzzle.x, focus.y + 1 - this._muzzle.y,
        focus.z - this._muzzle.z).normalize();
      this._spawnTracer(this._muzzle,
        this._far.copy(this._muzzle).addScaledVector(this._direction, 22), 0.06, 4);
      this._spawnFlash(this._muzzle, this._direction);
    }
    for (const item of this.flashes) if (item.life > 0) item.life = 2.5;
  }
}
