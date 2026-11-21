import * as THREE from 'three';
import { VEHICLE } from '../config.js';
import { clamp, damp } from '../core/rng.js';
import { makeBox, mergeParts } from '../render/parts.js';

const MAX_WANTED = 5;
const CRIMES = {
  debug: 1,
  assault: 1,
  theft: 1,
  shooting: 1,
  pedestrian: 2,
  cop: 2,
};
const SIGHT_RANGE = 125;
const OFFICER_RANGE = 58;
const OFFICER_FIRE_RANGE = 44;
const TAU = Math.PI * 2;
const FORWARD = new THREE.Vector3(0, 0, 1);

const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();

function part(w, h, d, color, x, y, z) {
  return { geometry: makeBox(w, h, d, color), position: [x, y, z] };
}

function cruiserGeometry() {
  const spec = VEHICLE.police;
  const l = spec.length;
  const w = spec.width;
  const h = spec.height;
  return mergeParts([
    part(w, h * 0.44, l, '#e8edf2', 0, 0.42 + h * 0.22, 0),
    part(w * 0.9, h * 0.3, l * 0.46, '#29495a', 0, h * 0.78, -l * 0.05),
    part(w * 0.93, 0.14, l * 0.48, '#e8edf2', 0, h * 0.95, -l * 0.05),
    part(w * 0.96, h * 0.16, l * 0.5, '#285a86', 0, 0.46, 0),
    part(0.1, h * 0.28, l * 0.44, '#242a31', -w * 0.45, h * 0.78, -l * 0.05),
    part(0.1, h * 0.28, l * 0.44, '#242a31', w * 0.45, h * 0.78, -l * 0.05),
    part(0.42, 0.14, 0.08, '#fff2c8', -0.56, 0.64, l * 0.5),
    part(0.42, 0.14, 0.08, '#fff2c8', 0.56, 0.64, l * 0.5),
    part(0.44, 0.14, 0.08, '#c33b34', -0.56, 0.7, -l * 0.5),
    part(0.44, 0.14, 0.08, '#c33b34', 0.56, 0.7, -l * 0.5),
  ]);
}

function officerGeometry() {
  return mergeParts([
    part(0.26, 0.84, 0.28, '#1f3352', -0.15, 0.47, 0),
    part(0.26, 0.84, 0.28, '#1f3352', 0.15, 0.47, 0),
    part(0.24, 0.12, 0.36, '#20242a', -0.15, 0.06, 0.05),
    part(0.24, 0.12, 0.36, '#20242a', 0.15, 0.06, 0.05),
    part(0.6, 0.72, 0.34, '#2b4f78', 0, 1.25, 0),
    part(0.5, 0.44, 0.36, '#c9d5df', 0, 1.34, 0.01),
    part(0.17, 0.56, 0.19, '#2b4f78', -0.39, 1.24, 0),
    part(0.17, 0.56, 0.19, '#2b4f78', 0.39, 1.24, 0),
    part(0.14, 0.14, 0.14, '#c98d63', -0.39, 0.88, 0),
    part(0.14, 0.14, 0.14, '#c98d63', 0.39, 0.88, 0),
    part(0.3, 0.33, 0.3, '#c98d63', 0, 1.84, 0),
    part(0.34, 0.1, 0.34, '#152744', 0, 2.02, 0),
    part(0.38, 0.04, 0.14, '#152744', 0, 1.99, 0.18),
    part(0.1, 0.1, 0.34, '#2b2f36', 0.4, 1.0, 0.26),
  ]);
}

function helicopterGeometry() {
  return mergeParts([
    part(2.4, 1.5, 5.2, '#e8edf2', 0, 0, 0),
    part(2.1, 0.9, 2.4, '#285a86', 0, 0.1, 1.2),
    part(0.5, 0.5, 5, '#d8d2c0', 0, 0.3, -4.4),
    part(0.2, 1.5, 1.4, '#285a86', 0, 1.0, -6.6),
    part(0.3, 0.3, 5, '#c6cad0', -1.2, -1.1, 0),
    part(0.3, 0.3, 5, '#c6cad0', 1.2, -1.1, 0),
    part(0.16, 0.7, 0.16, '#c6cad0', -1.2, -0.65, -1.5),
    part(0.16, 0.7, 0.16, '#c6cad0', 1.2, -0.65, -1.5),
    part(0.16, 0.7, 0.16, '#c6cad0', -1.2, -0.65, 1.5),
    part(0.16, 0.7, 0.16, '#c6cad0', 1.2, -0.65, 1.5),
  ]);
}

function barrierGeometry() {
  return mergeParts([
    part(3.4, 0.62, 0.35, '#e8edf2', 0, 0.45, 0),
    part(3.5, 0.16, 0.4, '#d84448', 0, 0.72, 0),
    part(0.14, 0.8, 0.5, '#2b2f36', -1.6, 0.4, 0),
    part(0.14, 0.8, 0.5, '#2b2f36', 1.6, 0.4, 0),
    part(3.3, 0.14, 0.34, '#d84448', 0, 0.3, 0),
  ]);
}

function angleTo(current, target, t) {
  const turn = ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return current + turn * t;
}

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.graph = city.graph;
    this.rng = rng ?? (() => 0.5);
    this.wanted = 0;
    this.level = 0;
    this.units = [];
    this.focus = null;
    this.time = 0;
    this.lastSeen = 0;
    this._sirenOn = false;
    this._roadblockNode = -1;
    this._firePulses = [];

    this.group = new THREE.Group();
    this.group.name = 'PVD pursuit';
    scene.add(this.group);

    this.lambert = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.basic = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    this._cruiserGeometry = cruiserGeometry();
    this._officerGeometry = officerGeometry();
    this._officerShadowGeometry = makeBox(1, 0.02, 0.8, '#1c1b1c');
    this._helicopterGeometry = helicopterGeometry();
    this._barrierGeometry = barrierGeometry();
    this._redGeometry = makeBox(0.66, 0.14, 0.36, '#ff3c4a');
    this._blueGeometry = makeBox(0.66, 0.14, 0.36, '#3a8dff');
    this._shadowGeometry = makeBox(2.2, 0.02, 4.9, '#1c1b1c');
    this._barGeometry = makeBox(1.5, 0.09, 0.3, '#e8dfc8');
    this._rotorGeometry = mergeParts([
      { geometry: makeBox(11, 0.06, 0.3, '#c6cad0'), position: [0, 0, 0] },
      { geometry: makeBox(0.3, 0.06, 11, '#c6cad0'), position: [0, 0, 0] },
    ]);
    this._shadowMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false,
    });
    this._beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.13, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    });
    this._glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe1a0, transparent: true, opacity: 0.22, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    this._beamGeometry = new THREE.ConeGeometry(5.5, 17, 16, 1, true);
    this._glowGeometry = new THREE.CircleGeometry(5, 20);

    const tracerGeometry = makeBox(0.055, 0.055, 1, '#ffd98a');
    for (let i = 0; i < 20; i += 1) {
      const mesh = new THREE.Mesh(tracerGeometry, this.basic);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this._firePulses.push({ mesh, life: 0 });
    }
  }

  setFocus(position) {
    this.focus = position ? { x: position.x, y: position.y ?? 0, z: position.z, heading: position.heading ?? 0 } : null;
  }

  _audio() {
    return typeof window === 'undefined' ? null : window.game?.audio ?? null;
  }

  _setWanted(value) {
    const next = clamp(Math.round(value), 0, MAX_WANTED);
    if (next === this.wanted) return;
    this.wanted = next;
    this.level = next;
    this.lastSeen = 0;
    if (next === 0) {
      for (const unit of this.units) this.group.remove(unit.object3D);
      this.units.length = 0;
      this._roadblockNode = -1;
      this._setSiren(false);
    } else {
      this._setSiren(true);
    }
  }

  _setSiren(on) {
    if (this._sirenOn === on) return;
    this._sirenOn = on;
    this._audio()?.sfx?.(on ? 'siren' : 'sirenOff');
  }

  report(crime) {
    if (this.wanted >= MAX_WANTED) return this.wanted;
    this._setWanted(this.wanted + (CRIMES[crime] ?? 1));
    return this.wanted;
  }

  addStar() {
    return this.report('debug');
  }

  setWanted(value) {
    this._setWanted(value);
    return this.wanted;
  }

  clear() {
    this._setWanted(0);
    return this.wanted;
  }

  stage(name, focus) {
    this.clear();
    this.setFocus(focus);
    if (!focus) return;
    if (name === '2-chase') {
      this.setWanted(3);
      const offsets = [2.2, -2.2, 0];
      const behind = [12, 14.5, 17];
      for (let i = 0; i < 3; i += 1) {
        const unit = this._spawnCruiser(focus, {
          x: focus.x - behind[i],
          z: focus.z + offsets[i],
          heading: Math.PI / 2,
        });
        unit.red.visible = true;
        unit.blue.visible = false;
      }
    } else if (name === '3-combat') {
      this.setWanted(4);
      for (let i = 0; i < 4; i += 1) {
        const unit = this._spawnOfficer(focus, {
          x: focus.x - 12 + i * 8,
          z: focus.z - 10 + (i % 2) * 16,
        });
        unit.fireTimer = 0;
      }
      this._spawnAir(focus);
    }
  }

  _positionNear(target, minRadius, maxRadius, out) {
    const angle = this.rng() * TAU;
    const radius = minRadius + this.rng() * (maxRadius - minRadius);
    const x = target.x + Math.cos(angle) * radius;
    const z = target.z + Math.sin(angle) * radius;
    const node = this.graph.nearest(x, z);
    const options = this.graph.adjacency[node];
    const edge = options[Math.floor(this.rng() * options.length)] ?? options[0];
    if (!edge) {
      out.set(x, this.city.groundY(x, z), z);
      return node;
    }
    const next = edge.a === node ? edge.b : edge.a;
    this.graph.lanePoint(node, next, this.rng(), out);
    return node;
  }

  _spawnCruiser(target, pose = null) {
    const position = new THREE.Vector3();
    let node;
    if (pose) {
      position.set(pose.x, this.city.groundY(pose.x, pose.z) + 0.12, pose.z);
      node = this.graph.nearest(pose.x, pose.z);
    } else {
      node = this._positionNear(target, 38, 92, position);
    }
    const object3D = new THREE.Group();
    object3D.name = 'PVD cruiser';
    const body = new THREE.Mesh(this._cruiserGeometry, this.lambert);
    const red = new THREE.Mesh(this._redGeometry, this.basic);
    const blue = new THREE.Mesh(this._blueGeometry, this.basic);
    const bar = new THREE.Mesh(this._barGeometry, this.basic);
    red.position.set(-0.36, VEHICLE.police.height + 0.16, -0.18);
    blue.position.set(0.36, VEHICLE.police.height + 0.16, -0.18);
    bar.position.set(0, VEHICLE.police.height + 0.1, -0.18);
    const shadow = new THREE.Mesh(this._shadowGeometry, this._shadowMaterial);
    shadow.position.y = -0.1;
    object3D.add(body, bar, red, blue, shadow);
    const unit = {
      kind: 'cruiser',
      object3D,
      position,
      red,
      blue,
      heading: pose ? (pose.heading ?? 0) : 0,
      speed: 0,
      node,
      next: -1,
      t: 0,
      route: [],
      routeAge: 4,
      health: 100,
      phase: this.rng() * TAU,
      parked: Boolean(pose),
    };
    object3D.position.copy(position);
    object3D.rotation.y = unit.heading;
    this.group.add(object3D);
    this.units.push(unit);
    return unit;
  }

  _spawnOfficer(target, pose = null) {
    const position = new THREE.Vector3();
    if (pose) position.set(pose.x, this.city.groundY(pose.x, pose.z), pose.z);
    else this._positionNear(target, 16, 52, position);
    const object3D = new THREE.Group();
    object3D.name = 'PVD officer';
    object3D.add(new THREE.Mesh(this._officerGeometry, this.lambert));
    const shadow = new THREE.Mesh(this._officerShadowGeometry, this._shadowMaterial);
    shadow.position.y = 0.02;
    object3D.add(shadow);
    const unit = {
      kind: 'officer',
      object3D,
      position,
      heading: 0,
      health: 60,
      fireTimer: 0.6 + this.rng() * 1.8,
      phase: this.rng() * TAU,
    };
    object3D.position.copy(position);
    this.group.add(object3D);
    this.units.push(unit);
    return unit;
  }

  _spawnRoadblock(target) {
    const aheadX = target.x + Math.sin(target.heading ?? 0) * 76;
    const aheadZ = target.z + Math.cos(target.heading ?? 0) * 76;
    const node = this.graph.nearest(aheadX, aheadZ);
    if (node === this._roadblockNode) return;
    this._roadblockNode = node;
    const center = this.graph.nodes[node];
    const edge = this.graph.adjacency[node]?.[0];
    if (!edge) return;
    const heading = edge.a === node
      ? Math.atan2(this.graph.nodes[edge.b].x - center.x, this.graph.nodes[edge.b].z - center.z)
      : Math.atan2(this.graph.nodes[edge.a].x - center.x, this.graph.nodes[edge.a].z - center.z);
    const object3D = new THREE.Group();
    object3D.name = 'PVD roadblock';
    for (let i = -1; i <= 1; i += 1) {
      const barrier = new THREE.Mesh(this._barrierGeometry, this.lambert);
      const lateral = i * 3.6;
      barrier.position.set(
        center.x + Math.cos(heading) * lateral,
        this.city.groundY(center.x, center.z) + 0.1,
        center.z - Math.sin(heading) * lateral,
      );
      barrier.rotation.y = heading;
      object3D.add(barrier);
    }
    this.group.add(object3D);
    this.units.push({
      kind: 'roadblock',
      object3D,
      position: new THREE.Vector3(center.x, this.city.groundY(center.x, center.z), center.z),
      health: Infinity,
    });
    for (const side of [-1, 1]) {
      this._spawnCruiser(target, {
        x: center.x + Math.cos(heading) * side * 8,
        z: center.z - Math.sin(heading) * side * 8,
        heading: heading + Math.PI / 2,
      });
    }
  }

  _spawnAir(target) {
    const object3D = new THREE.Group();
    object3D.name = 'Gaviota air unit';
    object3D.add(new THREE.Mesh(this._helicopterGeometry, this.lambert));
    const rotor = new THREE.Mesh(this._rotorGeometry, this.lambert);
    rotor.position.y = 1;
    object3D.add(rotor);
    const beam = new THREE.Mesh(this._beamGeometry, this._beamMaterial);
    beam.position.y = -8.5;
    object3D.add(beam);
    const glow = new THREE.Mesh(this._glowGeometry, this._glowMaterial);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -17;
    object3D.add(glow);
    const position = new THREE.Vector3(target.x + 26, this.city.groundY(target.x, target.z) + 19, target.z + 18);
    object3D.position.copy(position);
    this.group.add(object3D);
    this.units.push({ kind: 'air', object3D, position, rotor, beam, glow, heading: 0, health: 250 });
  }

  _syncUnits(target) {
    const level = this.wanted;
    let cruisers = 0;
    let officers = 0;
    for (const unit of this.units) {
      if (unit.kind === 'cruiser') cruisers += 1;
      else if (unit.kind === 'officer') officers += 1;
    }
    const wantedCruisers = Math.min(MAX_WANTED, level + (level >= 3 ? 1 : 0));
    const wantedOfficers = level <= 1 ? 0 : level === 2 ? 1 : level === 3 ? 2 : level === 4 ? 4 : 6;
    for (let i = cruisers; i < wantedCruisers; i += 1) this._spawnCruiser(target);
    for (let i = officers; i < wantedOfficers; i += 1) this._spawnOfficer(target);
    if (level >= 3 && !this.units.some((unit) => unit.kind === 'roadblock')) this._spawnRoadblock(target);
    if (level >= 4 && !this.units.some((unit) => unit.kind === 'air')) this._spawnAir(target);
  }

  _updateRoute(unit, target) {
    const from = this.graph.nearest(unit.position.x, unit.position.z);
    const to = this.graph.nearest(target.x, target.z);
    const route = this.graph.path(from, to);
    unit.route = route.length > 1 ? route : [from, to];
    unit.node = from;
    unit.t = 0;
    unit.next = unit.route[1] ?? from;
  }

  _edgeTo(unit) {
    return this.graph.adjacency[unit.node]?.find((item) => item.a === unit.next || item.b === unit.next);
  }

  _updateCruiser(unit, dt, target) {
    const flash = Math.floor((this.time + unit.phase) * 6) % 2 === 0;
    unit.red.visible = flash;
    unit.blue.visible = !flash;
    if (unit.parked) return;
    unit.routeAge += dt;
    if (unit.next < 0 || unit.routeAge > 1.6) {
      this._updateRoute(unit, target);
      unit.routeAge = 0;
    }
    let edge = this._edgeTo(unit);
    if (!edge) {
      this._updateRoute(unit, target);
      edge = this._edgeTo(unit);
    }
    if (!edge) return;
    const a = this.graph.nodes[unit.node];
    const b = this.graph.nodes[unit.next];
    unit.speed = damp(unit.speed, 27 + this.wanted * 1.6, 1.2, dt);
    unit.t += (unit.speed * dt) / edge.length;
    let guard = 0;
    while (unit.t >= 1 && guard < 4) {
      guard += 1;
      unit.t -= 1;
      const index = unit.route.indexOf(unit.next);
      unit.node = unit.next;
      unit.next = unit.route[index + 1] ?? unit.node;
      if (unit.node === unit.next) this._updateRoute(unit, target);
      edge = this._edgeTo(unit);
      if (!edge) {
        this._updateRoute(unit, target);
        edge = this._edgeTo(unit);
      }
      if (!edge) return;
    }
    this.graph.lanePoint(unit.node, unit.next, unit.t, unit.position);
    unit.position.y = this.city.groundY(unit.position.x, unit.position.z) + 0.12;
    const heading = Math.atan2(b.x - a.x, b.z - a.z);
    unit.heading = angleTo(unit.heading, heading, Math.min(1, dt * 7));
    unit.object3D.position.copy(unit.position);
    unit.object3D.rotation.y = unit.heading;
  }

  _pulse(from, to) {
    const pulse = this._firePulses.find((item) => item.life <= 0);
    if (!pulse) return;
    scratchA.subVectors(to, from);
    const length = scratchA.length();
    if (length < 0.1) return;
    pulse.mesh.position.copy(from).addScaledVector(scratchA, 0.5);
    pulse.mesh.scale.set(1, 1, length);
    pulse.mesh.quaternion.setFromUnitVectors(FORWARD, scratchA.normalize());
    pulse.mesh.visible = true;
    pulse.life = 0.1;
  }

  _updateOfficer(unit, dt, target, player) {
    const dx = target.x - unit.position.x;
    const dz = target.z - unit.position.z;
    const distance = Math.hypot(dx, dz);
    const desired = distance > 14 ? 4.6 + this.wanted * 0.35 : 0;
    if (desired > 0 && distance > 0.1) {
      unit.position.x += (dx / distance) * desired * dt;
      unit.position.z += (dz / distance) * desired * dt;
      this.city.collide(unit.position, 0.42);
    }
    unit.position.y = this.city.groundY(unit.position.x, unit.position.z);
    unit.heading = Math.atan2(dx, dz);
    unit.object3D.position.copy(unit.position);
    unit.object3D.position.y += Math.abs(Math.sin(this.time * 8 + unit.phase)) * 0.045 * Math.min(1, desired);
    unit.object3D.rotation.y = unit.heading;

    unit.fireTimer -= dt;
    if (unit.fireTimer <= 0 && distance < OFFICER_FIRE_RANGE) {
      unit.fireTimer = 0.9 + this.rng() * 1.2;
      scratchA.set(unit.position.x, unit.position.y + 1.2, unit.position.z);
      scratchB.set(target.x, (target.y ?? this.city.groundY(target.x, target.z)) + 1.1, target.z);
      this._pulse(scratchA, scratchB);
      if (player && distance < OFFICER_RANGE && typeof player.takeDamage === 'function') {
        player.takeDamage(3 + Math.round(this.rng() * 4));
      }
      this._audio()?.sfx?.('gunshot');
    }
  }

  _updateAir(unit, dt, target) {
    const floor = this.city.groundY(target.x, target.z);
    unit.position.x = damp(unit.position.x, target.x + 14, 0.9, dt);
    unit.position.z = damp(unit.position.z, target.z + 10, 0.9, dt);
    unit.position.y = damp(unit.position.y, floor + 20, 1.4, dt);
    unit.rotor.rotation.y += dt * 28;
    unit.object3D.position.copy(unit.position);
    unit.glow.position.x = target.x - unit.position.x;
    unit.glow.position.z = target.z - unit.position.z;
    unit.glow.position.y = floor - unit.position.y + 0.3;
    unit.beam.lookAt(target.x, floor, target.z);
    unit.beam.rotateX(Math.PI / 2);
  }

  damage(unit, amount) {
    if (!unit || !Number.isFinite(unit.health)) return false;
    unit.health -= amount;
    if (unit.health > 0) return false;
    this.group.remove(unit.object3D);
    const index = this.units.indexOf(unit);
    if (index >= 0) this.units.splice(index, 1);
    return true;
  }

  update(dt, player) {
    this.time += dt;
    const target = this.focus ?? player?.position ?? {
      x: this.city.spawnPoint[0], y: 0, z: this.city.spawnPoint[2], heading: 0,
    };
    for (const pulse of this._firePulses) {
      if (pulse.life <= 0) continue;
      pulse.life -= dt;
      pulse.mesh.visible = pulse.life > 0;
    }
    if (this.wanted <= 0) {
      this._setSiren(false);
      return;
    }
    if (this.targetX === undefined) {
      this.lastSeen = 0;
    } else {
      const dx = target.x - this.targetX;
      const dz = target.z - this.targetZ;
      this.lastSeen = dx * dx + dz * dz < SIGHT_RANGE * SIGHT_RANGE ? 0 : this.lastSeen + dt;
    }
    this.targetX = target.x;
    this.targetZ = target.z;
    if (this.lastSeen > Math.min(40, 20 + this.wanted * 4)) this._setWanted(this.wanted - 1);
    if (this.wanted <= 0) return;

    this._syncUnits(target);
    for (const unit of this.units) {
      if (unit.kind === 'cruiser') this._updateCruiser(unit, dt, target);
      else if (unit.kind === 'officer') this._updateOfficer(unit, dt, target, player);
      else if (unit.kind === 'air') this._updateAir(unit, dt, target);
    }
    this._setSiren(true);
  }
}
