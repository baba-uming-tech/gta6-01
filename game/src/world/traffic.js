// Road traffic and sidewalk crowds for Velamar. Every car and pedestrian is an instance of a
// merged, vertex-coloured prototype, so the whole living street costs only a handful of draw
// calls. Cars follow the road graph in both directions, slow for the car ahead and brake; people
// bob as they walk and flinch or flee when gunfire or a horn goes off nearby.

import * as THREE from 'three';
import { VEHICLE, WORLD } from '../config.js';
import { clamp, damp, makeRng, smoothstep } from '../core/rng.js';
import { makeBox, makeCylinder, mergeParts } from '../render/parts.js';

const CAR_COUNT = 28;
const PED_COUNT = 48;
const PLAYER_CLEARANCE = 25;
const CAMERA_CLEARANCE = 25;
const PED_CLEARANCE = 4;
const CAR_FAR = 215;
const PED_FAR = 185;
const SIDEWALK_Y = 0.3;
const SIDEWALK_OFFSET = WORLD.road / 2 + 1.6;
const LOOK_AHEAD = 17;
const TAU = Math.PI * 2;

const WALK = 0;
const FLINCH = 1;
const FLEE = 2;
const DOWN = 3;

const CAR_COLORS = [
  '#d8a13c', '#2f6b7f', '#b8493f', '#e8edf2', '#4d7f6d',
  '#c4436b', '#d8d2c0', '#285a86', '#e8b06a', '#8b6a43',
];
const PED_TINTS = ['#ffffff', '#f2e6d8', '#dfe9ef', '#f5dcc8', '#eadfc4'];

const MATRIX = new THREE.Matrix4();
const POSITION = new THREE.Vector3();
const ROTATION = new THREE.Euler();
const QUATERNION = new THREE.Quaternion();
const SCALE = new THREE.Vector3();
const SCRATCH = new THREE.Vector3();
const SCRATCH_B = new THREE.Vector3();
const SCRATCH_C = new THREE.Vector3();
const TINT = new THREE.Color();

function box(w, h, d, color, x, y, z) {
  return { geometry: makeBox(w, h, d, color), position: [x, y, z] };
}

function wheels(spec) {
  const parts = [];
  const halfWidth = spec.width / 2 - 0.05;
  const axle = spec.length * 0.32;
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      parts.push({
        geometry: makeCylinder(0.35, 0.35, 0.2, 10, '#191b1f'),
        position: [side * halfWidth, 0.37, end * axle],
        rotation: [0, 0, Math.PI / 2],
      });
      parts.push({
        geometry: makeCylinder(0.17, 0.17, 0.22, 8, '#b9bec4'),
        position: [side * halfWidth, 0.37, end * axle],
        rotation: [0, 0, Math.PI / 2],
      });
    }
  }
  return parts;
}

function carGeometry(kind) {
  const spec = VEHICLE[kind];
  const { length: l, width: w, height: h } = spec;
  const body = '#ffffff';
  const glass = '#2b4b5c';
  const trim = '#242a31';
  let parts;
  if (kind === 'van') {
    parts = [
      box(w, h * 0.74, l, body, 0, 0.38 + h * 0.37, 0),
      box(w * 0.9, h * 0.22, l * 0.17, glass, 0, h * 0.81, l * 0.38),
      box(w * 0.94, h * 0.06, l * 0.7, '#e8dfc8', 0, h * 0.56, -l * 0.05),
      box(w * 0.96, 0.12, l * 0.08, trim, 0, 0.46, -l * 0.44),
    ];
  } else if (kind === 'coupe' || kind === 'sports') {
    parts = [
      box(w, h * 0.48, l, body, 0, 0.4 + h * 0.24, 0),
      box(w * 0.82, h * 0.3, l * 0.34, glass, 0, h * 0.72, -l * 0.06),
      box(w * 0.86, h * 0.07, l * 0.36, body, 0, h * 0.88, -l * 0.06),
      box(w * 0.88, 0.1, l * 0.14, trim, 0, h * 0.93, -l * 0.38),
      box(w * 0.5, 0.05, l * 0.16, '#e8edf2', 0, 0.4 + h * 0.5, l * 0.28),
    ];
  } else {
    parts = [
      box(w, h * 0.42, l, body, 0, 0.45 + h * 0.21, 0),
      box(w * 0.89, h * 0.3, l * 0.44, glass, 0, h * 0.75, -l * 0.04),
      box(w * 0.92, h * 0.06, l * 0.46, body, 0, h * 0.92, -l * 0.04),
      box(w * 0.87, 0.09, l * 0.17, '#9aa0a4', 0, 0.46 + h * 0.43, l * 0.34),
      box(w * 0.87, 0.09, l * 0.15, '#9aa0a4', 0, 0.46 + h * 0.43, -l * 0.35),
      box(0.09, h * 0.26, l * 0.42, trim, -w * 0.45, h * 0.75, -l * 0.04),
      box(0.09, h * 0.26, l * 0.42, trim, w * 0.45, h * 0.75, -l * 0.04),
    ];
  }
  return mergeParts([...parts, ...wheels(spec)]);
}

function lampGeometry(mode) {
  const parts = mode === 'head'
    ? [box(0.42, 0.16, 0.08, '#fff3c8', -0.56, 0.62, 2.25),
      box(0.42, 0.16, 0.08, '#fff3c8', 0.56, 0.62, 2.25)]
    : [box(0.44, 0.16, 0.08, '#ff4a38', -0.56, 0.68, -2.26),
      box(0.44, 0.16, 0.08, '#ff4a38', 0.56, 0.68, -2.26)];
  return mergeParts(parts);
}

function pedestrianGeometry(kind) {
  const skin = kind === 'worker' ? '#a8704e' : '#c98d63';
  const shirt = kind === 'worker' ? '#2f6b7f' : '#f0e2c4';
  const trousers = kind === 'worker' ? '#4a4038' : '#3d4a57';
  const hat = kind === 'worker' ? '#c4433f' : '#2b211b';
  return mergeParts([
    box(0.2, 0.82, 0.22, trousers, -0.14, 0.46, 0),
    box(0.2, 0.82, 0.22, trousers, 0.14, 0.46, 0),
    box(0.23, 0.12, 0.34, '#3c3028', -0.14, 0.07, 0.06),
    box(0.23, 0.12, 0.34, '#3c3028', 0.14, 0.07, 0.06),
    box(0.58, 0.68, 0.32, shirt, 0, 1.23, 0),
    box(0.16, 0.58, 0.18, shirt, -0.38, 1.22, 0),
    box(0.16, 0.58, 0.18, shirt, 0.38, 1.22, 0),
    box(0.13, 0.14, 0.14, skin, -0.38, 0.86, 0),
    box(0.13, 0.14, 0.14, skin, 0.38, 0.86, 0),
    box(0.28, 0.12, 0.26, skin, 0, 1.64, 0),
    box(0.3, 0.33, 0.29, skin, 0, 1.85, 0),
    box(0.33, 0.1, 0.32, hat, 0, 2.01, 0),
    box(0.36, 0.04, 0.12, hat, 0, 1.98, 0.16),
  ]);
}

function setInstance(mesh, slot, x, y, z, heading, sx, sy, sz, pitch = 0, roll = 0) {
  POSITION.set(x, y, z);
  ROTATION.set(pitch, heading, roll);
  QUATERNION.setFromEuler(ROTATION);
  SCALE.set(sx, sy, sz);
  MATRIX.compose(POSITION, QUATERNION, SCALE);
  mesh.setMatrixAt(slot, MATRIX);
}

function angleTo(current, target, t) {
  const turn = ((target - current + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return current + turn * t;
}

export class Traffic {
  constructor(scene, city, rng) {
    this.city = city;
    this.graph = city.graph;
    this.rng = rng ?? makeRng(9137);
    this.night = false;
    this.cars = [];
    this.peds = [];
    this._focusX = city.spawnPoint[0];
    this._focusZ = city.spawnPoint[2];
    this._focusHeading = Math.PI / 2;
    this._lastFocusX = this._focusX;
    this._lastFocusZ = this._focusZ;
    this._avoidPlayer = { x: this._focusX, z: this._focusZ };
    this._avoidCamera = { x: this._focusX, z: this._focusZ };
    this._avoid = [this._avoidPlayer, this._avoidCamera];

    this.group = new THREE.Group();
    this.group.name = 'Traffic and pedestrians';
    scene.add(this.group);

    const carKinds = ['sedan', 'coupe', 'van'];
    for (let i = 0; i < CAR_COUNT; i += 1) {
      const roll = this.rng();
      const kind = roll < 0.52 ? carKinds[0] : roll < 0.8 ? carKinds[1] : carKinds[2];
      this.cars.push({
        kind,
        length: VEHICLE[kind].length,
        position: new THREE.Vector3(),
        heading: 0,
        speed: 6 + this.rng() * 6,
        desired: 11 + this.rng() * 8,
        edge: 0,
        dir: 1,
        t: 0,
        prevEdge: -1,
        prevDir: 1,
        braking: false,
        slot: 0,
        color: new THREE.Color(CAR_COLORS[Math.floor(this.rng() * CAR_COLORS.length)]),
      });
    }
    for (let i = 0; i < PED_COUNT; i += 1) {
      const worker = this.rng() < 0.3;
      this.peds.push({
        worker,
        position: new THREE.Vector3(),
        heading: 0,
        baseSpeed: 1.05 + this.rng() * 0.95,
        speed: 0,
        edge: 0,
        dir: this.rng() < 0.5 ? 1 : -1,
        side: this.rng() < 0.5 ? 1 : -1,
        t: 0,
        phase: this.rng() * TAU,
        scale: 0.9 + this.rng() * 0.22,
        state: WALK,
        timer: 0,
        threatX: 0,
        threatZ: 0,
        slot: 0,
        color: new THREE.Color(PED_TINTS[Math.floor(this.rng() * PED_TINTS.length)]),
      });
    }

    const lambert = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.carMeshes = [];
    for (const kind of carKinds) {
      const members = this.cars.filter((car) => car.kind === kind);
      members.forEach((car, slot) => { car.slot = slot; });
      const mesh = new THREE.InstancedMesh(carGeometry(kind), lambert, members.length);
      mesh.name = `Traffic ${kind}`;
      members.forEach((car) => {
        car.mesh = mesh;
        mesh.setColorAt(car.slot, car.color);
      });
      this._prepare(mesh);
      this.carMeshes.push(mesh);
    }

    this.brakeMesh = new THREE.InstancedMesh(lampGeometry('brake'), new THREE.MeshBasicMaterial({
      vertexColors: true, fog: false,
    }), CAR_COUNT);
    this.brakeMesh.name = 'Traffic brake lights';
    this._prepare(this.brakeMesh);
    this.headlights = new THREE.InstancedMesh(lampGeometry('head'), new THREE.MeshBasicMaterial({
      vertexColors: true, fog: false,
    }), CAR_COUNT);
    this.headlights.name = 'Traffic headlights';
    this.headlights.visible = false;
    this._prepare(this.headlights);

    this.pedMeshes = [];
    for (const worker of [false, true]) {
      const members = this.peds.filter((ped) => ped.worker === worker);
      members.forEach((ped, slot) => { ped.slot = slot; });
      const mesh = new THREE.InstancedMesh(pedestrianGeometry(worker ? 'worker' : 'local'), lambert, members.length);
      mesh.name = worker ? 'Pedestrians workers' : 'Pedestrians locals';
      members.forEach((ped) => mesh.setColorAt(ped.slot, ped.color));
      this._prepare(mesh);
      this.pedMeshes.push(mesh);
    }

    this.shadows = new THREE.InstancedMesh(
      makeBox(1, 0.02, 1, '#1c1b1c'),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.26, depthWrite: false }),
      CAR_COUNT + PED_COUNT,
    );
    this.shadows.name = 'Traffic contact shadows';
    this._prepare(this.shadows);

    for (const car of this.cars) this.placeCar(car, this._focusX, this._focusZ, PLAYER_CLEARANCE, 85);
    for (const ped of this.peds) this.placePed(ped, this._focusX, this._focusZ, 10, 55);
    this.update(0, { x: this._focusX, z: this._focusZ }, { x: this._focusX, z: this._focusZ });
  }

  _prepare(mesh) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  _lanes(edge, dir) {
    return dir > 0 ? [edge.a, edge.b] : [edge.b, edge.a];
  }

  _pointOnRoad(edge, dir, t, out) {
    const [from, to] = this._lanes(edge, dir);
    return this.graph.lanePoint(from, to, t, out);
  }

  _pointOnPavement(edge, side, t, out) {
    const a = this.graph.nodes[edge.a];
    const b = this.graph.nodes[edge.b];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz) || 1;
    out.set(
      a.x + dx * t - (dz / length) * SIDEWALK_OFFSET * side,
      SIDEWALK_Y,
      a.z + dz * t + (dx / length) * SIDEWALK_OFFSET * side,
    );
    return out;
  }

  _headingOnRoad(edge, dir) {
    const [from, to] = this._lanes(edge, dir);
    const a = this.graph.nodes[from];
    const b = this.graph.nodes[to];
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  _chooseEdge(node, avoid) {
    const options = this.graph.adjacency[node];
    if (!options || !options.length) return avoid;
    if (options.length === 1) return options[0];
    let total = 0;
    const weights = [];
    for (const edge of options) {
      if (edge === avoid && options.length > 1) {
        weights.push(0);
        continue;
      }
      const next = edge.a === node ? edge.b : edge.a;
      const ax = this.graph.nodes[node].x;
      const az = this.graph.nodes[node].z;
      const bx = this.graph.nodes[next].x;
      const bz = this.graph.nodes[next].z;
      const ix = ax - this._incomingX;
      const iz = az - this._incomingZ;
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const alignment = (ix * (bx - ax) + iz * (bz - az)) / ((Math.hypot(ix, iz) || 1) * len);
      const weight = alignment > 0.8 ? 5 : alignment > 0.1 ? 2 : 1;
      total += weight;
      weights.push(weight);
    }
    let pick = this.rng() * total;
    for (let i = 0; i < options.length; i += 1) {
      pick -= weights[i];
      if (pick <= 0) return options[i];
    }
    return options[options.length - 1];
  }

  _place(entity, x, z, minRadius, maxRadius, isPed) {
    const startX = entity.position.x;
    const startY = entity.position.y;
    const startZ = entity.position.z;
    const startHeading = entity.heading;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const angle = this.rng() * TAU;
      const radius = minRadius + this.rng() * (maxRadius - minRadius);
      const node = this.graph.nearest(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius);
      const options = this.graph.adjacency[node];
      if (!options.length) continue;
      const edge = options[Math.floor(this.rng() * options.length)];
      const dir = edge.a === node ? 1 : -1;
      const t = dir > 0 ? this.rng() * 0.75 : 1 - this.rng() * 0.75;
      if (isPed) this._pointOnPavement(edge, entity.side, t, entity.position);
      else this._pointOnRoad(edge, dir, t, entity.position);
      let clear = true;
      for (let i = 0; i < this._avoid.length; i += 1) {
        const point = this._avoid[i];
        const limit = isPed ? PED_CLEARANCE : i === 0 ? PLAYER_CLEARANCE : CAMERA_CLEARANCE;
        const dx = point.x - entity.position.x;
        const dz = point.z - entity.position.z;
        if (dx * dx + dz * dz < limit * limit) {
          clear = false;
          break;
        }
      }
      if (clear) {
        const siblings = isPed ? this.peds : this.cars;
        for (const other of siblings) {
          if (other === entity) continue;
          const dx = other.position.x - entity.position.x;
          const dz = other.position.z - entity.position.z;
          if (dx * dx + dz * dz < (isPed ? 5 : 64)) {
            clear = false;
            break;
          }
        }
      }
      if (!clear) continue;
      entity.edge = edge.index;
      entity.dir = dir;
      entity.t = t;
      entity.prevEdge = -1;
      entity.heading = isPed
        ? this._headingOnRoad(edge, 1) + (entity.dir > 0 ? 0 : Math.PI)
        : this._headingOnRoad(edge, dir);
      if (!isPed) {
        entity.speed = Math.min(entity.speed, 9);
        entity.braking = false;
      } else {
        entity.state = WALK;
        entity.timer = 0;
      }
      return;
    }
    entity.position.set(startX, startY, startZ);
    entity.heading = startHeading;
  }

  placeCar(car, x, z, minRadius = 45, maxRadius = 145) {
    this._place(car, x, z, minRadius, maxRadius, false);
  }

  placePed(ped, x, z, minRadius = 40, maxRadius = 135) {
    this._place(ped, x, z, minRadius, maxRadius, true);
  }

  redistribute(x, z, cameraPos = null) {
    this._avoidPlayer.x = x;
    this._avoidPlayer.z = z;
    if (cameraPos) {
      this._avoidCamera.x = cameraPos.x;
      this._avoidCamera.z = cameraPos.z;
    } else {
      this._avoidCamera.x = x;
      this._avoidCamera.z = z;
    }
    for (const car of this.cars) this.placeCar(car, x, z, PLAYER_CLEARANCE, 105);
    for (const ped of this.peds) this.placePed(ped, x, z, 10, 78);
    this.update(0, SCRATCH.set(x, 0, z), cameraPos);
  }

  setNight(on) {
    this.night = on;
    this.headlights.visible = on;
  }

  gunfire(x, z, radius = 62) {
    for (const ped of this.peds) {
      if (ped.state === DOWN) continue;
      const dx = ped.position.x - x;
      const dz = ped.position.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance > radius) continue;
      ped.threatX = x;
      ped.threatZ = z;
      if (distance < radius * 0.42 && ped.state !== FLEE) {
        ped.state = FLINCH;
        ped.timer = 0.45 + this.rng() * 0.4;
      } else {
        this._startFlee(ped, x, z);
      }
    }
  }

  horn(x, z, radius = 20) {
    for (const ped of this.peds) {
      if (ped.state === DOWN) continue;
      const dx = ped.position.x - x;
      const dz = ped.position.z - z;
      if (dx * dx + dz * dz > radius * radius) continue;
      this._startFlee(ped, x, z, 3.5);
    }
  }

  _startFlee(ped, x, z, duration = 6) {
    const heading = this._headingOnRoad(this.graph.edges[ped.edge], 1);
    const awayX = ped.position.x - x;
    const awayZ = ped.position.z - z;
    const forward = Math.cos(heading) * awayZ + Math.sin(heading) * awayX;
    if (forward < 0) ped.dir = -ped.dir;
    ped.heading = heading + (ped.dir > 0 ? 0 : Math.PI);
    ped.threatX = x;
    ped.threatZ = z;
    ped.state = FLEE;
    ped.timer = duration + this.rng() * 3;
  }

  knockDown(ped) {
    if (!ped || ped.state === DOWN) return;
    ped.state = DOWN;
    ped.timer = 11 + this.rng() * 5;
  }

  stagger(ped, x, z) {
    if (!ped || ped.state === DOWN) return;
    ped.state = FLINCH;
    ped.timer = 0.7 + this.rng() * 0.5;
    ped.threatX = x;
    ped.threatZ = z;
  }

  _trackFocus(playerPos) {
    if (!playerPos) return;
    this._focusX = playerPos.x;
    this._focusZ = playerPos.z;
    const dx = this._focusX - this._lastFocusX;
    const dz = this._focusZ - this._lastFocusZ;
    if (dx * dx + dz * dz > 0.04) {
      this._focusHeading = Math.atan2(dx, dz);
      this._lastFocusX = this._focusX;
      this._lastFocusZ = this._focusZ;
    }
  }

  _updateCar(car, dt) {
    const edge = this.graph.edges[car.edge];
    const heading = this._headingOnRoad(edge, car.dir);
    let gap = Infinity;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.position.x - car.position.x;
      const dz = other.position.z - car.position.z;
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0 || ahead > LOOK_AHEAD) continue;
      const lateral = Math.abs(dz * fx - dx * fz);
      if (lateral > 2.5) continue;
      gap = Math.min(gap, ahead - (car.length + other.length) * 0.5);
    }
    let target = car.desired;
    if (gap < LOOK_AHEAD) target = Math.min(target, clamp((gap - 3.2) * 1.5, 2.2, car.desired));
    car.braking = car.speed > target + 0.8;
    car.speed = damp(car.speed, target, car.braking ? 3.8 : 1.15, dt);

    car.t += (car.speed * dt) / edge.length;
    if (car.t >= 1) {
      const [from, to] = this._lanes(edge, car.dir);
      const a = this.graph.nodes[from];
      const b = this.graph.nodes[to];
      this._incomingX = b.x - a.x;
      this._incomingZ = b.z - a.z;
      const next = this._chooseEdge(to, edge.index);
      const nextDir = next.a === to ? 1 : -1;
      car.prevEdge = edge.index;
      car.prevDir = car.dir;
      car.edge = next.index;
      car.dir = nextDir;
      car.t -= 1;
    }

    const active = this.graph.edges[car.edge];
    this._pointOnRoad(active, car.dir, car.t, car.position);
    let poseHeading = this._headingOnRoad(active, car.dir);
    if (car.prevEdge >= 0) {
      const span = Math.min(0.4, 5 / active.length);
      if (car.t < span) {
        const blend = smoothstep(0, 1, car.t / span);
        this._pointOnRoad(this.graph.edges[car.prevEdge], car.prevDir, 1, SCRATCH);
        car.position.lerpVectors(SCRATCH, car.position, blend);
        const oldHeading = this._headingOnRoad(this.graph.edges[car.prevEdge], car.prevDir);
        poseHeading = angleTo(oldHeading, poseHeading, blend);
      } else {
        car.prevEdge = -1;
      }
    }
    car.heading = poseHeading;
  }

  _updatePed(ped, dt) {
    if (ped.state === DOWN) {
      ped.timer -= dt;
      if (ped.timer <= 0) this.placePed(ped, this._focusX, this._focusZ, 35, 130);
      return;
    }
    if (ped.timer > 0) {
      ped.timer -= dt;
      if (ped.timer <= 0) ped.state = WALK;
    }
    const speed = ped.state === FLINCH ? 0 : ped.state === FLEE ? ped.baseSpeed * 4.2 : ped.baseSpeed;
    ped.speed = speed;
    ped.phase += dt * (3.2 + speed * 3.4);

    const edge = this.graph.edges[ped.edge];
    ped.t += (ped.dir * speed * dt) / edge.length;
    while (ped.t < 0 || ped.t >= 1) {
      const node = ped.t >= 1 ? edge.b : edge.a;
      const nxt = this._chooseEdge(node, edge.index);
      const previous = this.graph.nodes[node];
      const other = this.graph.nodes[nxt.a === node ? nxt.b : nxt.a];
      this._incomingX = other.x - previous.x;
      this._incomingZ = other.z - previous.z;
      ped.edge = nxt.index;
      ped.dir = nxt.a === node ? 1 : -1;
      if (ped.t >= 1) ped.t -= 1;
      else ped.t += 1;
    }

    const active = this.graph.edges[ped.edge];
    this._pointOnPavement(active, ped.side, ped.t, ped.position);
    let heading = this._headingOnRoad(active, 1) + (ped.dir > 0 ? 0 : Math.PI);
    if (ped.state === FLINCH) {
      heading = Math.atan2(ped.threatX - ped.position.x, ped.threatZ - ped.position.z);
    } else if (ped.state === FLEE) {
      const away = Math.atan2(ped.position.x - ped.threatX, ped.position.z - ped.threatZ);
      heading = angleTo(heading, away, 0.35);
    }
    ped.heading = heading;
  }

  _writeCar(car) {
    setInstance(car.mesh, car.slot, car.position.x, car.position.y, car.position.z, car.heading, 1, 1, 1);
    const stretch = car.length / 4.7;
    setInstance(this.brakeMesh, car.slot, car.position.x, car.position.y, car.position.z, car.heading, 1, 1, stretch);
    setInstance(this.headlights, car.slot, car.position.x, car.position.y, car.position.z, car.heading, 1, 1, stretch);
    const value = car.braking ? 1 : 0.24;
    TINT.setRGB(value, value, value);
    this.brakeMesh.setColorAt(car.slot, TINT);
    setInstance(this.shadows, car.slot, car.position.x + 0.2, 0.145, car.position.z + 0.2,
      car.heading, car.length * 1.06, 1, car.length * 0.48);
  }

  _writePed(ped) {
    const mesh = ped.worker ? this.pedMeshes[1] : this.pedMeshes[0];
    const down = ped.state === DOWN;
    const bob = down ? 0 : Math.abs(Math.sin(ped.phase)) * 0.055 * (ped.speed / ped.baseSpeed);
    const crouch = ped.state === FLINCH ? 0.78 : 1;
    const lean = ped.state === FLEE ? Math.sin(ped.phase) * 0.12 : Math.sin(ped.phase) * 0.035;
    setInstance(mesh, ped.slot, ped.position.x, ped.position.y + bob, ped.position.z,
      ped.heading, ped.scale, ped.scale * crouch, ped.scale,
      down ? Math.PI / 2 : 0, lean);
    setInstance(this.shadows, CAR_COUNT + ped.slot, ped.position.x + 0.12, 0.305, ped.position.z + 0.12,
      ped.heading, 0.95, 1, 0.75);
  }

  update(dt, playerPos, cameraPos = null) {
    this._trackFocus(playerPos);
    if (playerPos) {
      this._avoidPlayer.x = playerPos.x;
      this._avoidPlayer.z = playerPos.z;
    }
    if (cameraPos) {
      this._avoidCamera.x = cameraPos.x;
      this._avoidCamera.z = cameraPos.z;
    }
    const fx = this._focusX;
    const fz = this._focusZ;
    for (const car of this.cars) {
      const dx = car.position.x - fx;
      const dz = car.position.z - fz;
      const px = car.position.x - this._avoidPlayer.x;
      const pz = car.position.z - this._avoidPlayer.z;
      const cx = car.position.x - this._avoidCamera.x;
      const cz = car.position.z - this._avoidCamera.z;
      if (px * px + pz * pz < 36 || cx * cx + cz * cz < 25
        || dx * dx + dz * dz > CAR_FAR * CAR_FAR) this.placeCar(car, fx, fz, PLAYER_CLEARANCE, 150);
      this._updateCar(car, dt);
      this._writeCar(car);
    }
    for (const ped of this.peds) {
      const dx = ped.position.x - fx;
      const dz = ped.position.z - fz;
      if (dx * dx + dz * dz > PED_FAR * PED_FAR) this.placePed(ped, fx, fz, 40, 135);
      this._updatePed(ped, dt);
      this._writePed(ped);
    }
    for (const mesh of this.carMeshes) mesh.instanceMatrix.needsUpdate = true;
    for (const mesh of this.pedMeshes) mesh.instanceMatrix.needsUpdate = true;
    this.brakeMesh.instanceMatrix.needsUpdate = true;
    this.headlights.instanceMatrix.needsUpdate = true;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.brakeMesh.instanceColor.needsUpdate = true;
  }
}
