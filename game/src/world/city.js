import * as THREE from 'three';
import { WORLD, PALETTE, DISTRICT, NIGHT } from '../config.js';
import { makeRng, clamp } from '../core/rng.js';
import { makeBox, makeCylinder, mergeParts, facadeTexture, textTexture } from '../render/parts.js';
import { RoadGraph } from './graph.js';

const ROAD_HALF = WORLD.road / 2;
const LOT = WORLD.block - WORLD.road - WORLD.sidewalk * 2;
const PAVEMENT = LOT + WORLD.sidewalk * 2;
const COLS = WORLD.grid;
const ROWS = WORLD.grid - 1;
const ORIGIN_X = -WORLD.block * COLS / 2;
const ORIGIN_Z = -WORLD.block * ROWS / 2;
const BUILDING_Y = 0.34;
const SPAWN = [-164, 1.75, 227.5];
const SPAWN_CLEARANCE = 4;

const MATRIX = new THREE.Matrix4();
const POSITION = new THREE.Vector3();
const QUATERNION = new THREE.Quaternion();
const EULER = new THREE.Euler();
const SCALE = new THREE.Vector3();
const COLOR = new THREE.Color();

const FOOTPRINT = {
  tower: { x: 7.6, z: 7.6 },
  midrise: { x: 8.2, z: 7.1 },
  lowrise: { x: 8.6, z: 7.8 },
};

function part(w, h, d, color, x, y, z, rotation) {
  const item = { geometry: makeBox(w, h, d, color), position: [x, y, z] };
  if (rotation) item.rotation = rotation;
  return item;
}

function mergedMesh(group, parts, material) {
  const mesh = new THREE.Mesh(mergeParts(parts), material);
  group.add(mesh);
  return mesh;
}

function blockCenter(i, j) {
  return [ORIGIN_X + (i + 0.5) * WORLD.block, ORIGIN_Z + (j + 0.5) * WORLD.block];
}

function makeCollision() {
  const cell = WORLD.block;
  const cells = new Map();
  const clearZones = [];
  let stamp = 0;

  function key(cx, cz) {
    return `${cx},${cz}`;
  }

  function reserve(minX, maxX, minZ, maxZ) {
    clearZones.push({ minX, maxX, minZ, maxZ });
  }

  function add(minX, maxX, minZ, maxZ) {
    for (const zone of clearZones) {
      if (minX < zone.maxX && maxX > zone.minX && minZ < zone.maxZ && maxZ > zone.minZ) return;
    }
    const box = { minX, maxX, minZ, maxZ, stamp: -1 };
    const fromX = Math.floor(minX / cell);
    const toX = Math.floor(maxX / cell);
    const fromZ = Math.floor(minZ / cell);
    const toZ = Math.floor(maxZ / cell);
    for (let cx = fromX; cx <= toX; cx += 1) {
      for (let cz = fromZ; cz <= toZ; cz += 1) {
        const id = key(cx, cz);
        let bucket = cells.get(id);
        if (!bucket) {
          bucket = [];
          cells.set(id, bucket);
        }
        bucket.push(box);
      }
    }
  }

  function collide(pos, radius = 0.6) {
    stamp += 1;
    for (let pass = 0; pass < 2; pass += 1) {
      const fromX = Math.floor((pos.x - radius) / cell);
      const toX = Math.floor((pos.x + radius) / cell);
      const fromZ = Math.floor((pos.z - radius) / cell);
      const toZ = Math.floor((pos.z + radius) / cell);
      let moved = false;
      for (let cx = fromX; cx <= toX; cx += 1) {
        for (let cz = fromZ; cz <= toZ; cz += 1) {
          const bucket = cells.get(key(cx, cz));
          if (!bucket) continue;
          for (const box of bucket) {
            if (box.stamp === stamp) continue;
            box.stamp = stamp;
            const minX = box.minX - radius;
            const maxX = box.maxX + radius;
            const minZ = box.minZ - radius;
            const maxZ = box.maxZ + radius;
            const inside = pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ;
            if (!inside) continue;
            const left = pos.x - minX;
            const right = maxX - pos.x;
            const back = pos.z - minZ;
            const front = maxZ - pos.z;
            const smallest = Math.min(left, right, back, front);
            if (smallest <= 0) continue;
            if (smallest === left) pos.x = minX;
            else if (smallest === right) pos.x = maxX;
            else if (smallest === back) pos.z = minZ;
            else pos.z = maxZ;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    const minX = ORIGIN_X - ROAD_HALF + 1;
    const maxX = ORIGIN_X + COLS * WORLD.block + ROAD_HALF - 1;
    const minZ = ORIGIN_Z - ROAD_HALF + 1;
    const shore = pos.x > 120 ? 336 : pos.x < 20 ? 292 : 266;
    if (pos.x < minX) pos.x = minX;
    else if (pos.x > maxX) pos.x = maxX;
    if (pos.z < minZ) pos.z = minZ;
    else if (pos.z > shore) pos.z = shore;
    return pos;
  }

  return { add, collide, reserve, count: () => cells.size };
}

function buildSurfaces(group, quality) {
  const parts = [];
  const minX = ORIGIN_X - ROAD_HALF;
  const maxX = ORIGIN_X + COLS * WORLD.block + ROAD_HALF;
  const minZ = ORIGIN_Z - ROAD_HALF;
  const maxZ = ORIGIN_Z + ROWS * WORLD.block + ROAD_HALF;
  const dashEvery = quality === 'low' ? 18 : 12;
  const crosswalkStride = quality === 'low' ? 4 : 3;
  const crosswalkStripes = quality === 'low' ? [-2, 0, 2] : [-2, -1, 0, 1, 2];

  for (let j = 0; j <= ROWS; j += 1) {
    const z = ORIGIN_Z + j * WORLD.block;
    parts.push(part(maxX - minX, 0.12, WORLD.road, PALETTE.asphalt, 0, 0.06, z));
    for (const side of [-1, 1]) {
      parts.push(part(maxX - minX, 0.02, 0.14, '#e8c35a', 0, 0.13, z + side * 0.27));
      if (j % 2 === 0) {
        for (let x = minX + 5; x < maxX - 3; x += dashEvery) {
          parts.push(part(Math.min(5, maxX - 3 - x), 0.02, 0.12, '#ede7d8', x, 0.135, z + side * 3.6));
        }
      }
    }
  }

  for (let i = 0; i <= COLS; i += 1) {
    const x = ORIGIN_X + i * WORLD.block;
    parts.push(part(WORLD.road, 0.12, maxZ - minZ, PALETTE.asphalt, x, 0.06, 0));
    for (const side of [-1, 1]) {
      parts.push(part(0.14, 0.02, maxZ - minZ, '#e8c35a', x + side * 0.27, 0.13, 0));
      if (i % 2 === 0) {
        for (let z = minZ + 5; z < maxZ - 3; z += dashEvery) {
          parts.push(part(0.12, 0.02, Math.min(5, maxZ - 3 - z), '#ede7d8', x + side * 3.6, 0.135, z));
        }
      }
    }
  }

  for (let j = 0; j <= ROWS; j += 1) {
    const z = ORIGIN_Z + j * WORLD.block;
    for (let i = 0; i <= COLS; i += 1) {
      if ((i + j) % crosswalkStride) continue;
      const x = ORIGIN_X + i * WORLD.block;
      for (const side of [-1, 1]) {
        for (const stripe of crosswalkStripes) {
          parts.push(part(0.55, 0.02, 1.45, '#fff6e2', x + side * (ROAD_HALF + 1.4), 0.14, z + stripe * 1.85));
          parts.push(part(1.45, 0.02, 0.55, '#fff6e2', x + stripe * 1.85, 0.14, z + side * (ROAD_HALF + 1.4)));
        }
      }
    }
  }

  for (let j = 0; j < ROWS; j += 1) {
    for (let i = 0; i < COLS; i += 1) {
      const [x, z] = blockCenter(i, j);
      parts.push(part(PAVEMENT, 0.28, PAVEMENT, PALETTE.kerb, x, 0.14, z));
      parts.push(part(LOT, 0.08, LOT, '#d8c9a8', x, 0.3, z));
    }
  }

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  mergedMesh(group, parts, material);
}

function buildWater(group, quality) {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 1200),
    new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.94 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.02, 890);
  group.add(water);

  const waves = [];
  const count = quality === 'low' ? 30 : 72;
  const rng = makeRng(4177);
  for (let i = 0; i < count; i += 1) {
    const x = -700 + rng() * 1400;
    const z = 300 + rng() * 420;
    waves.push(part(10 + rng() * 28, 0.03, 0.35, '#6fc4c9', x, 0.015, z));
  }
  mergedMesh(group, waves, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 }));
}

function buildBeach(group, quality) {
  const parts = [
    part(500, 0.18, 26, PALETTE.sand, -140, 0.09, 279),
    part(500, 0.04, 6, '#d4bd8f', -140, 0.2, 286),
    part(500, 0.03, 2.5, '#d9ede4', -140, 0.22, 291),
    part(500, 0.3, 5, PALETTE.kerb, -140, 0.15, 268),
  ];
  mergedMesh(group, parts, new THREE.MeshLambertMaterial({ vertexColors: true }));

  const umbrella = mergeParts([
    { geometry: makeCylinder(0.07, 0.07, 2.4, 6, '#8b6a43'), position: [0, 1.2, 0] },
    { geometry: makeCylinder(0.05, 1.9, 1.3, 8, '#d85f4f'), position: [0, 2.75, 0] },
    { geometry: makeCylinder(0.05, 1.5, 0.22, 8, '#fff2d6'), position: [0, 3.35, 0] },
  ]);
  const placements = [];
  const count = quality === 'low' ? 8 : 18;
  for (let i = 0; i < count; i += 1) {
    placements.push({
      x: -350 + i * (700 / count),
      y: 0.18,
      z: 274 + (i % 3) * 5.5,
      rotation: i * 0.7,
      color: i % 2 ? '#e8b06a' : '#f5f0e6',
    });
  }
  addInstances(group, umbrella, new THREE.MeshLambertMaterial({ vertexColors: true }), placements);
}

function buildingPrototype(kind) {
  if (kind === 'tower') {
    return mergeParts([
      { geometry: makeBox(10, 38, 10, '#ffffff'), position: [0, 19, 0] },
      { geometry: makeBox(15, 5, 15, PALETTE.stucco[1]), position: [0, 2.5, 0] },
      { geometry: makeBox(10.6, 0.8, 10.6, PALETTE.kerb), position: [0, 38.4, 0] },
      { geometry: makeCylinder(0.12, 0.18, 5, 6, '#d8d2c0'), position: [0, 41, 0] },
    ]);
  }
  if (kind === 'midrise') {
    return mergeParts([
      { geometry: makeBox(15, 14, 13, '#ffffff'), position: [0, 7, 0] },
      { geometry: makeBox(16, 2, 14, PALETTE.stucco[1]), position: [0, 1, 0] },
      { geometry: makeBox(15.5, 0.7, 13.5, PALETTE.kerb), position: [0, 14.3, 0] },
      { geometry: makeBox(15.4, 0.25, 0.6, PALETTE.stucco[2]), position: [0, 4, 6.6] },
      { geometry: makeBox(15.4, 0.25, 0.6, PALETTE.stucco[2]), position: [0, 8, 6.6] },
      { geometry: makeBox(15.4, 0.25, 0.6, PALETTE.stucco[2]), position: [0, 12, 6.6] },
    ]);
  }
  return mergeParts([
    { geometry: makeBox(16, 7, 12, '#ffffff'), position: [0, 3.5, 0] },
    { geometry: makeBox(16.5, 0.5, 12.5, PALETTE.stucco[1]), position: [0, 7.25, 0] },
    { geometry: makeBox(17, 0.5, 2.6, '#b6403f'), position: [0, 3.1, 6.6] },
    { geometry: makeBox(17, 0.18, 0.7, '#e8b06a'), position: [0, 2.8, 7.6] },
    { geometry: makeBox(2.4, 2.6, 0.2, '#3a4a57'), position: [-4, 1.3, 6.05] },
  ]);
}

function addInstances(group, geometry, material, placements) {
  if (!placements.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  for (let i = 0; i < placements.length; i += 1) {
    const item = placements[i];
    POSITION.set(item.x, item.y ?? BUILDING_Y, item.z);
    EULER.set(0, item.rotation ?? 0, 0);
    QUATERNION.setFromEuler(EULER);
    SCALE.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
    MATRIX.compose(POSITION, QUATERNION, SCALE);
    mesh.setMatrixAt(i, MATRIX);
    COLOR.set(item.color ?? '#ffffff');
    mesh.setColorAt(i, COLOR);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  group.add(mesh);
  return mesh;
}

function districtCenters() {
  return DISTRICT.map((d) => ({ ...d, cx: d.x * WORLD.block, cz: d.z * WORLD.block }));
}

function nearestDistrict(x, z, districts) {
  let best = districts[0];
  let bestDistance = Infinity;
  for (const district of districts) {
    const distance = (district.cx - x) ** 2 + (district.cz - z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = district;
    }
  }
  return best;
}

function chooseBuildingType(district, rng) {
  const roll = rng();
  if (district.id === 'centro') return roll < 0.64 ? 'tower' : 'midrise';
  if (district.id === 'mercado') return roll < 0.74 ? 'lowrise' : 'midrise';
  if (district.id === 'muelle') return roll < 0.62 ? 'lowrise' : 'midrise';
  if (district.id === 'cerroalto') return roll < 0.62 ? 'midrise' : 'tower';
  return roll < 0.48 ? 'midrise' : 'lowrise';
}

function buildBuildings(group, rng, collision, garage, hospital) {
  const districts = districtCenters();
  const placements = { tower: [], midrise: [], lowrise: [] };
  const tints = ['#fff8ec', '#f2e2c9', '#e8b06a', '#f5f0e6', '#d8e4e8'];

  for (let j = 0; j < ROWS; j += 1) {
    for (let i = 0; i < COLS; i += 1) {
      const [x, z] = blockCenter(i, j);
      if ((x === garage.x && z === garage.z) || (x === hospital.x && z === hospital.z)) continue;
      if (x > 120 && z > 160) continue;
      const district = nearestDistrict(x, z, districts);
      const kind = chooseBuildingType(district, rng);
      const jitterX = (rng() - 0.5) * 2.4;
      const jitterZ = (rng() - 0.5) * 2.4;
      const sx = kind === 'tower' ? 0.88 + rng() * 0.16 : 0.9 + rng() * 0.12;
      const sz = kind === 'tower' ? 0.88 + rng() * 0.16 : 0.9 + rng() * 0.12;
      const sy = kind === 'tower' ? 0.72 + rng() * 1.15
        : kind === 'midrise' ? 0.8 + rng() * 0.5 : 0.85 + rng() * 0.35;
      const rotation = rng() < 0.12 ? Math.PI / 2 : 0;
      const color = tints[Math.floor(rng() * tints.length)];
      placements[kind].push({ x: x + jitterX, z: z + jitterZ, sx, sy, sz, rotation, color });
      const footprint = FOOTPRINT[kind];
      const hx = (rotation ? footprint.z : footprint.x) * sx + 0.4;
      const hz = (rotation ? footprint.x : footprint.z) * sz + 0.4;
      collision.add(x + jitterX - hx, x + jitterX + hx, z + jitterZ - hz, z + jitterZ + hz);
    }
  }

  const windowMeshes = [];
  for (const kind of ['tower', 'midrise', 'lowrise']) {
    const geometry = buildingPrototype(kind);
    const day = addInstances(group, geometry, new THREE.MeshLambertMaterial({
      vertexColors: true, map: facadeTexture(kind),
    }), placements[kind]);
    const night = addInstances(group, geometry, new THREE.MeshBasicMaterial({
      vertexColors: true, map: facadeTexture(kind, true),
    }), placements[kind]);
    night.visible = false;
    windowMeshes.push({ day, night });
  }
  return windowMeshes;
}

function palmPrototype() {
  const parts = [
    { geometry: makeCylinder(0.22, 0.42, 7, 6, '#8b6a43'), position: [0, 3.5, 0] },
    { geometry: makeCylinder(0.3, 0.38, 0.5, 6, '#6f5738'), position: [0, 0.25, 0] },
  ];
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    parts.push({
      geometry: makeBox(0.55, 0.1, 4.4, PALETTE.foliage),
      position: [Math.sin(angle) * 1.9, 7.1 - (i % 2) * 0.25, Math.cos(angle) * 1.9],
      rotation: [0.16, angle, 0],
    });
  }
  return mergeParts(parts);
}

function lampPrototype() {
  return mergeParts([
    { geometry: makeCylinder(0.08, 0.14, 7, 6, '#4a4f55'), position: [0, 3.5, 0] },
    { geometry: makeBox(1.7, 0.12, 0.12, '#4a4f55'), position: [0.85, 6.95, 0] },
    { geometry: makeBox(0.9, 0.22, 0.45, '#ffe0a0'), position: [1.55, 6.8, 0] },
  ]);
}

function trafficLightPrototype() {
  return mergeParts([
    { geometry: makeCylinder(0.09, 0.13, 6, 6, '#4a4f55'), position: [0, 3, 0] },
    { geometry: makeBox(0.85, 2.1, 0.6, '#252c33'), position: [0.45, 5.5, 0] },
    { geometry: makeBox(0.32, 0.32, 0.08, '#e35a4a'), position: [0.45, 6.1, 0.34] },
    { geometry: makeBox(0.32, 0.32, 0.08, '#e8c35a'), position: [0.45, 5.5, 0.34] },
    { geometry: makeBox(0.32, 0.32, 0.08, '#5cc98a'), position: [0.45, 4.9, 0.34] },
  ]);
}

function benchPrototype() {
  return mergeParts([
    { geometry: makeBox(2.4, 0.16, 0.7, '#8b6a43'), position: [0, 0.65, 0] },
    { geometry: makeBox(2.4, 0.7, 0.14, '#a37c4f'), position: [0, 1.05, -0.3] },
    { geometry: makeBox(0.16, 0.65, 0.6, '#4a4f55'), position: [-0.9, 0.33, 0] },
    { geometry: makeBox(0.16, 0.65, 0.6, '#4a4f55'), position: [0.9, 0.33, 0] },
  ]);
}

function hydrantPrototype() {
  return mergeParts([
    { geometry: makeCylinder(0.22, 0.28, 0.9, 8, '#c4433f'), position: [0, 0.45, 0] },
    { geometry: makeCylinder(0.3, 0.3, 0.16, 8, '#d85f4f'), position: [0, 0.82, 0] },
    { geometry: makeBox(0.62, 0.16, 0.2, '#d85f4f'), position: [0, 0.55, 0] },
  ]);
}

function buildStreetProps(group, rng, quality) {
  const palms = [];
  const lamps = [];
  const lights = [];
  const benches = [];
  const hydrants = [];
  const palmStride = quality === 'low' ? 3 : 2;

  for (let j = 0; j <= ROWS; j += 1) {
    const z = ORIGIN_Z + j * WORLD.block;
    for (let i = 0; i < COLS; i += 1) {
      const x = ORIGIN_X + (i + 0.5) * WORLD.block;
      if ((i + j) % palmStride === 0 && z < 258) {
        for (const side of [-1, 1]) {
          palms.push({ x, y: 0.28, z: z + side * (ROAD_HALF + 1.7), rotation: rng() * 6.28, color: '#ffffff' });
        }
      }
      if ((i + j) % 3 === 0 && z < 258) {
        benches.push({ x, y: 0.28, z: z + (ROAD_HALF + 2.4), rotation: 0, color: '#ffffff' });
      }
    }
  }

  for (let i = 0; i <= COLS; i += 1) {
    const x = ORIGIN_X + i * WORLD.block;
    for (let j = 0; j < ROWS; j += 1) {
      const z = ORIGIN_Z + (j + 0.5) * WORLD.block;
      if ((i + j) % 3 === 0) {
        for (const side of [-1, 1]) {
          palms.push({ x: x + side * (ROAD_HALF + 1.7), y: 0.28, z, rotation: rng() * 6.28, color: '#ffffff' });
        }
      }
    }
  }

  for (let j = 0; j <= ROWS; j += 1) {
    for (let i = 0; i <= COLS; i += 1) {
      const x = ORIGIN_X + i * WORLD.block;
      const z = ORIGIN_Z + j * WORLD.block;
      if ((i + j) % 2 === 0) {
        lamps.push({
          x: x + ROAD_HALF + 1.2,
          y: 0.28,
          z: z + ROAD_HALF + 1.2,
          rotation: i % 2 ? Math.PI / 2 : 0,
          color: '#ffffff',
        });
      }
      if ((i + j) % 3 === 0) {
        lights.push({
          x: x - ROAD_HALF - 1.1,
          y: 0.28,
          z: z + ROAD_HALF + 1.1,
          rotation: j % 2 ? Math.PI / 2 : 0,
          color: '#ffffff',
        });
      }
      if ((i + j) % 4 === 1) {
        hydrants.push({ x: x + ROAD_HALF + 1.3, y: 0.28, z: z - ROAD_HALF - 1.3, color: '#ffffff' });
      }
    }
  }

  for (let i = 0; i < 14; i += 1) {
    benches.push({ x: -340 + i * 32, y: 0.3, z: 271, rotation: 0, color: '#ffffff' });
  }

  const lambert = new THREE.MeshLambertMaterial({ vertexColors: true });
  addInstances(group, palmPrototype(), lambert, palms);
  addInstances(group, lampPrototype(), lambert, lamps);
  addInstances(group, trafficLightPrototype(), lambert, lights);
  addInstances(group, benchPrototype(), lambert, benches);
  addInstances(group, hydrantPrototype(), lambert, hydrants);

  const glows = [];
  const pools = [];
  for (const lamp of lamps) {
    const armX = Math.cos(lamp.rotation) * 1.55;
    const armZ = -Math.sin(lamp.rotation) * 1.55;
    glows.push({ x: lamp.x + armX, y: 7.18, z: lamp.z + armZ, color: '#fff0b8' });
    pools.push({ x: lamp.x + armX, y: 0.315, z: lamp.z + armZ, color: '#ffd08a' });
  }
  const lampsOn = [
    addInstances(group, makeBox(1.05, 0.1, 0.55, '#ffffff'),
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }), glows),
    addInstances(group, makeBox(8.2, 0.02, 8.2, '#ffffff'),
      new THREE.MeshBasicMaterial({
        vertexColors: true, transparent: true, opacity: NIGHT.lampPoolOpacity,
        depthWrite: false, fog: false,
      }), pools),
  ];
  for (const mesh of lampsOn) mesh.visible = false;

  const shadows = [];
  for (const [items, width, depth] of [
    [palms, 2.6, 2.6], [lamps, 1.5, 1.5], [benches, 3.1, 1.4], [hydrants, 1.2, 1.2],
  ]) {
    for (const item of items) {
      shadows.push({ x: item.x + 0.25, y: (item.y ?? 0.28) + 0.025, z: item.z + 0.25, sx: width, sz: depth });
    }
  }
  addInstances(group, makeBox(1, 0.02, 1, '#1c1b1c'), new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.24, depthWrite: false,
  }), shadows);

  return lampsOn;
}

function buildBillboards(group) {
  const nightSigns = [];
  const brands = [
    { text: 'SOL BRAVO', bg: '#b6403f', color: '#fff3d4', border: '#e8c35a' },
    { text: 'RADIO MAREA 88.7', bg: '#1d3a52', color: '#37e0d6', border: '#37e0d6' },
    { text: 'BANCO COCAL', bg: '#204f45', color: '#f5f0e6', border: '#d8a13c' },
  ];
  const spots = [
    { x: -200, z: -60, rot: 0, brand: 0 },
    { x: 40, z: 60, rot: 0, brand: 1 },
    { x: 120, z: -100, rot: Math.PI / 2, brand: 2 },
    { x: -60, z: 100, rot: 0, brand: 2 },
    { x: 200, z: -20, rot: Math.PI / 2, brand: 0 },
    { x: -160, z: -180, rot: 0, brand: 1 },
    { x: 80, z: 180, rot: 0, brand: 0 },
    { x: -20, z: -220, rot: Math.PI / 2, brand: 2 },
    { x: 240, z: 80, rot: Math.PI / 2, brand: 1 },
  ];
  const post = mergeParts([
    { geometry: makeCylinder(0.12, 0.16, 7, 6, '#4a4f55'), position: [-3, 3.5, 0] },
    { geometry: makeCylinder(0.12, 0.16, 7, 6, '#4a4f55'), position: [3, 3.5, 0] },
    { geometry: makeBox(6.4, 0.2, 0.2, '#4a4f55'), position: [0, 6.6, 0] },
  ]);
  const postPlacements = spots.map((spot) => ({ x: spot.x, y: 0.3, z: spot.z, rotation: spot.rot, color: '#ffffff' }));
  addInstances(group, post, new THREE.MeshLambertMaterial({ vertexColors: true }), postPlacements);

  for (let brand = 0; brand < brands.length; brand += 1) {
    const sign = makeBox(9, 4, 0.3, '#ffffff');
    const material = new THREE.MeshBasicMaterial({
      map: textTexture(brands[brand].text, {
        bg: brands[brand].bg,
        color: brands[brand].color,
        border: brands[brand].border,
        size: brands[brand].text.length > 12 ? 42 : 64,
      }),
      side: THREE.DoubleSide,
    });
    const placements = spots
      .filter((spot) => spot.brand === brand)
      .map((spot) => ({ x: spot.x, y: 7.5, z: spot.z, rotation: spot.rot, color: '#ffffff' }));
    addInstances(group, sign, material, placements);
    const glowPlacements = spots
      .filter((spot) => spot.brand === brand)
      .map((spot) => ({
        x: spot.x + Math.sin(spot.rot) * 0.28,
        y: 7.5,
        z: spot.z + Math.cos(spot.rot) * 0.28,
        rotation: spot.rot,
        color: brands[brand].border,
      }));
    const glow = addInstances(group, makeBox(11, 5.6, 0.12, '#ffffff'),
      new THREE.MeshBasicMaterial({
        vertexColors: true, fog: false, transparent: true,
        opacity: NIGHT.signGlowOpacity, blending: THREE.AdditiveBlending, depthWrite: false,
      }), glowPlacements);
    if (glow) {
      glow.visible = false;
      nightSigns.push(glow);
    }
  }
  return nightSigns;
}

function buildDocks(group, rng, collision) {
  const pierParts = [];
  for (const x of [150, 190, 230]) {
    pierParts.push(part(9, 0.45, 78, '#8b6a43', x, 0.22, 304));
    for (let z = 272; z < 342; z += 6) {
      pierParts.push(part(9.2, 0.05, 0.25, '#b08b5c', x, 0.47, z));
    }
    for (const side of [-1, 1]) {
      for (let z = 280; z < 340; z += 20) {
        pierParts.push(part(0.3, 1.2, 0.3, '#4a4f55', x + side * 4, 0.6, z));
      }
    }
  }
  mergedMesh(group, pierParts, new THREE.MeshLambertMaterial({ vertexColors: true }));

  const container = makeBox(6, 2.6, 2.4, '#ffffff');
  const containerPlacements = [];
  const containerColors = ['#b8493f', '#2f6b7f', '#d8a13c', '#4d7f6d', '#d8d2c0'];
  for (let bx = 160; bx <= 240; bx += 40) {
    for (let bz = 180; bz <= 240; bz += 40) {
      for (let stack = 0; stack < 3; stack += 1) {
        for (let row = 0; row < 2; row += 1) {
          const x = bx - 8 + row * 9 + (rng() - 0.5) * 1.2;
          const z = bz - 6 + (stack % 2) * 1.5;
          const y = BUILDING_Y + stack * 2.65;
          containerPlacements.push({ x, y, z, rotation: 0, color: containerColors[Math.floor(rng() * containerColors.length)] });
          if (stack === 0) collision.add(x - 3, x + 3, z - 1.2, z + 1.2);
        }
      }
    }
  }
  addInstances(group, container, new THREE.MeshLambertMaterial({ vertexColors: true }), containerPlacements);

  const hull = mergeParts([
    { geometry: makeBox(4.2, 1.1, 10, '#ffffff'), position: [0, 0.55, 0] },
    { geometry: makeBox(3.2, 0.45, 5.5, '#e8edf2'), position: [0, 1.3, -1] },
    { geometry: makeBox(2.4, 1.3, 2.8, '#2f6b7f'), position: [0, 2.1, -1.4] },
    { geometry: makeBox(0.2, 1.6, 0.2, '#4a4f55'), position: [0, 3.4, -1.4] },
  ]);
  const boats = [];
  const boatColors = ['#e8edf2', '#d85f4f', '#d8a13c', '#37a0a6'];
  for (let i = 0; i < 8; i += 1) {
    boats.push({
      x: [145, 155, 185, 195, 225, 235, 170, 210][i],
      y: -0.05,
      z: 308 + (i % 4) * 9,
      rotation: Math.PI / 2 + (i % 2 ? 0.08 : -0.08),
      color: boatColors[i % boatColors.length],
    });
  }
  addInstances(group, hull, new THREE.MeshLambertMaterial({ vertexColors: true }), boats);
}

function addFlatSign(group, text, x, y, z, rotation, opts) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(opts.width ?? 9, opts.height ?? 2.4),
    new THREE.MeshBasicMaterial({ map: textTexture(text, opts), side: THREE.DoubleSide }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotation;
  group.add(mesh);
}

function buildLandmarks(group, garage, hospital, collision) {
  const parts = [
    part(19, 0.3, 17, PALETTE.kerb, garage.x, 0.49, garage.z),
    part(16, 6, 12, PALETTE.stucco[1], garage.x, 3.5, garage.z),
    part(17, 0.5, 13, '#b6403f', garage.x, 6.75, garage.z),
    part(17, 0.45, 3, '#d8a13c', garage.x, 4.3, garage.z + 6.8),
    part(19, 0.3, 17, PALETTE.kerb, hospital.x, 0.49, hospital.z),
    part(16, 12, 13, '#f5f0e6', hospital.x, 6.3, hospital.z),
    part(17, 0.6, 14, '#c9c2b2', hospital.x, 12.4, hospital.z),
    part(5.4, 1.2, 0.3, '#c4433f', hospital.x, 8.5, hospital.z + 6.7),
    part(1.2, 5.4, 0.3, '#c4433f', hospital.x, 8.5, hospital.z + 6.7),
  ];
  mergedMesh(group, parts, new THREE.MeshLambertMaterial({ vertexColors: true }));
  addFlatSign(group, 'TALLER TUCO', garage.x, 5.3, garage.z + 8.4, 0, {
    bg: '#1d2b3a', color: '#ffd98a', border: '#e8b06a', size: 52,
  });
  addFlatSign(group, 'CLINICA SOLARIS', hospital.x, 10.5, hospital.z + 6.9, 0, {
    bg: '#204f45', color: '#fff3d4', border: '#37e0d6', size: 44,
  });
  collision.add(garage.x - 8, garage.x + 8, garage.z - 6, garage.z + 6);
  collision.add(hospital.x - 8, hospital.x + 8, hospital.z - 6.5, hospital.z + 6.5);
}

export function buildCity(scene, rng, quality = 'mid') {
  const stream = rng ?? makeRng(7);
  const level = typeof quality === 'string' ? quality : quality?.label ?? 'mid';
  const group = new THREE.Group();
  group.name = 'Velamar';
  scene.add(group);

  const graph = new RoadGraph({
    block: WORLD.block,
    cols: COLS,
    rows: ROWS,
    originX: ORIGIN_X,
    originZ: ORIGIN_Z,
  });
  const collision = makeCollision();
  collision.reserve(
    SPAWN[0] - SPAWN_CLEARANCE, SPAWN[0] + SPAWN_CLEARANCE,
    SPAWN[2] - SPAWN_CLEARANCE, SPAWN[2] + SPAWN_CLEARANCE,
  );
  const garage = { x: -140, z: -140 };
  const hospital = { x: 100, z: -40 };

  buildSurfaces(group, level);
  buildWater(group, level);
  buildBeach(group, level);
  const windowMeshes = buildBuildings(group, stream, collision, garage, hospital);
  const lampsOn = buildStreetProps(group, stream, level);
  const nightSigns = buildBillboards(group);
  buildDocks(group, stream, collision);
  buildLandmarks(group, garage, hospital, collision);

  const minRoadX = ORIGIN_X;
  const maxRoadX = ORIGIN_X + COLS * WORLD.block;
  const minRoadZ = ORIGIN_Z;
  const maxRoadZ = ORIGIN_Z + ROWS * WORLD.block;

  function nearestRoad(x, z) {
    const ix = clamp(Math.round((x - minRoadX) / WORLD.block), 0, COLS);
    const iz = clamp(Math.round((z - minRoadZ) / WORLD.block), 0, ROWS);
    const roadX = minRoadX + ix * WORLD.block;
    const roadZ = minRoadZ + iz * WORLD.block;
    const verticalZ = clamp(z, minRoadZ, maxRoadZ);
    const horizontalX = clamp(x, minRoadX, maxRoadX);
    const verticalDistance = Math.hypot(x - roadX, z - verticalZ);
    const horizontalDistance = Math.hypot(x - horizontalX, z - roadZ);
    if (verticalDistance <= horizontalDistance) {
      return { x: roadX, z: verticalZ, distance: verticalDistance, node: graph.nearest(x, z) };
    }
    return { x: horizontalX, z: roadZ, distance: horizontalDistance, node: graph.nearest(x, z) };
  }

  const districts = districtCenters();
  const city = {
    group,
    graph,
    setNight(on) {
      for (const pair of windowMeshes) {
        pair.day.visible = !on;
        pair.night.visible = on;
      }
      for (const mesh of lampsOn) mesh.visible = on;
      group.userData.night = on;
    },
    nearestRoad,
    isOnRoad(x, z) {
      return nearestRoad(x, z).distance <= ROAD_HALF;
    },
    groundY() {
      return 0;
    },
    collide(pos, radius = 0.6) {
      return collision.collide(pos, radius);
    },
    landmarks: [
      { id: 'garage', name: 'Taller Tuco', x: garage.x, z: garage.z },
      { id: 'hospital', name: 'Clinica Solaris', x: hospital.x, z: hospital.z },
      { id: 'beach', name: 'Playa Costanera', x: -140, z: 288 },
      { id: 'marina', name: 'Muelle de Velamar', x: 190, z: 300 },
      { id: 'viewpoint', name: 'Cerro Alto', x: 200, z: -200 },
    ],
    districts,
    spawnPoint: SPAWN.slice(),
    spawnLookAt: [-64, 2.15, 206],
    garage,
    hospital,
    colliderCount: collision.count,
  };
  return city;
}
