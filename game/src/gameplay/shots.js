const SHOTS = {
  '1-cover': {
    hour: 17.4,
    label: 'BOULEVARD · GOLDEN HOUR',
    player: [-164, 214, Math.PI],
    camera: [-164, 2.55, 220.4],
    lookAt: [-164, 1.63, 214],
    beacon: [-164, 168],
  },
  '2-chase': {
    hour: 16.6,
    label: 'CENTRO · PURSUIT',
    coupe: [-164, 214, Math.PI, 24],
    camera: [-164, 2.55, 222.6],
    lookAt: [-164, 1.5, 202],
    wanted: 3,
    cruisers: [
      { x: -167, z: 206, heading: 0.3 },
      { x: -161, z: 204, heading: -0.3 },
      { x: -164, z: 221, heading: 0 },
    ],
  },
  '3-combat': {
    hour: 22.3,
    label: 'MERCADO · 22:18',
    player: [-124, -120, Math.PI],
    camera: [-124, 2.6, -113.8],
    lookAt: [-124, 1.4, -122],
    wanted: 4,
    officers: [[-126, -126], [-122, -127], [-128, -123], [-124, -129]],
    air: [-124, 28, -146],
  },
  '4-mission': {
    hour: 19.2,
    label: 'MUELLE · DUSK',
    player: [189, 296, 0],
    target: [189, 2, 306],
    camera: [189, 2.6, 289.4],
    lookAt: [189, 1.5, 297],
    beacon: [194, 306],
    parkedCars: [
      { specId: 'sedan', x: 183, z: 301, heading: Math.PI / 2 },
      { specId: 'van', x: 196, z: 307, heading: -Math.PI / 2 },
      { specId: 'pickup', x: 184, z: 317, heading: Math.PI / 2 },
    ],
  },
};

const FOOT_OFFSET = [1.6, 2.2, -6.2];
const FOOT_LOOK_HEIGHT = 1.3;
const probe = { x: 0, y: 0, z: 0 };

function rotateY(offset, yaw) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: offset[0] * cos + offset[2] * sin,
    y: offset[1],
    z: -offset[0] * sin + offset[2] * cos,
  };
}

function setShotCamera(camera, position, lookAt) {
  camera.up.set(0, 1, 0);
  camera.position.set(position[0], position[1], position[2]);
  camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
}

function aimCameraAt(city, camera, subject, yaw, offset, lookHeight) {
  const rotated = rotateY(offset, yaw);
  let x = subject.x + rotated.x;
  let y = subject.y + rotated.y;
  let z = subject.z + rotated.z;
  for (let i = 0; i < 12; i += 1) {
    probe.x = x;
    probe.z = z;
    city.collide(probe, 3);
    if (Math.hypot(probe.x - x, probe.z - z) < 0.01) break;
    x += (subject.x - x) * 0.25;
    z += (subject.z - z) * 0.25;
  }
  camera.position.set(x, y, z);
  camera.up.set(0, 1, 0);
  camera.lookAt(subject.x, subject.y + lookHeight, subject.z);
}

function clearTrafficNearCamera(traffic, camera) {
  if (!traffic) return;
  for (const car of traffic.cars) {
    if (Math.hypot(car.position.x - camera.position.x, car.position.z - camera.position.z) >= 8) continue;
    traffic.placeCar(car, camera.position.x + 30, camera.position.z + 30, 40, 105);
  }
  for (const ped of traffic.peds) {
    if (Math.hypot(ped.position.x - camera.position.x, ped.position.z - camera.position.z) >= 8) continue;
    traffic.placePed(ped, camera.position.x + 30, camera.position.z + 30, 30, 78);
  }
}

function isAhead(entity, x, z, forwardX, forwardZ, radius) {
  const dx = entity.position.x - x;
  const dz = entity.position.z - z;
  const distanceSquared = dx * dx + dz * dz;
  return distanceSquared <= radius * radius && dx * forwardX + dz * forwardZ > 0;
}

function countAhead(entities, x, z, forwardX, forwardZ) {
  let count = 0;
  for (const entity of entities) {
    if (isAhead(entity, x, z, forwardX, forwardZ, 70)) count += 1;
  }
  return count;
}

function ensureAheadCrowd(traffic, x, z, yaw) {
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const carCenterX = x + forwardX * 42;
  const carCenterZ = z + forwardZ * 42;
  const pedCenterX = x + forwardX * 33;
  const pedCenterZ = z + forwardZ * 33;
  for (let pass = 0; pass < 4; pass += 1) {
    if (countAhead(traffic.cars, x, z, forwardX, forwardZ) >= 6
      && countAhead(traffic.peds, x, z, forwardX, forwardZ) >= 8) break;
    for (const car of traffic.cars) {
      if (isAhead(car, x, z, forwardX, forwardZ, 70)) continue;
      traffic.placeCar(car, carCenterX, carCenterZ, 8, 24);
    }
    for (const ped of traffic.peds) {
      if (isAhead(ped, x, z, forwardX, forwardZ, 70)) continue;
      traffic.placePed(ped, pedCenterX, pedCenterZ, 5, 22);
    }
  }
}

function putCarInLane(traffic, from, to, t, car) {
  const edge = traffic.graph.adjacency[from].find((item) => item.a === to || item.b === to);
  if (!edge) return false;
  car.edge = edge.index;
  car.dir = edge.a === from ? 1 : -1;
  car.t = t;
  car.prevEdge = -1;
  traffic.graph.lanePoint(from, to, t, car.position);
  car.heading = Math.atan2(
    traffic.graph.nodes[to].x - traffic.graph.nodes[from].x,
    traffic.graph.nodes[to].z - traffic.graph.nodes[from].z,
  );
  car.speed = Math.min(car.speed, 9);
  car.braking = false;
  return true;
}

function ensureOtherLaneCars(traffic, x, z) {
  const graph = traffic.graph;
  const north = graph.nearest(x - 4, z + 6);
  const middle = graph.nearest(x - 4, z - 34);
  const south = graph.nearest(x - 4, z - 74);
  const placements = [
    [north, middle, 0.83], [middle, south, 0.15],
    [middle, south, 0.45], [middle, south, 0.75],
  ];
  const cars = traffic.cars;
  for (let i = 0; i < placements.length && i < cars.length; i += 1) {
    putCarInLane(traffic, placements[i][0], placements[i][1], placements[i][2], cars[i]);
  }
}

function installShotTrafficFix(game) {
  const traffic = game.traffic;
  if (!traffic || traffic._shotFix) return;
  const redistribute = traffic.redistribute.bind(traffic);
  traffic._shotFix = true;
  traffic.redistribute = (x, z, cameraPos) => {
    redistribute(x, z, cameraPos);
    if (game.shot === '1-cover') ensureAheadCrowd(traffic, x, z, Math.PI);
    if (game.shot === '2-chase') ensureOtherLaneCars(traffic, -164, 214);
  };
}

function placeOnFoot(game, shot, offset, lookHeight) {
  const { player, renderer } = game;
  const [x, z] = shot.player;
  const yaw = Math.atan2(shot.target[0] - x, shot.target[2] - z);
  player.reset(x, z, yaw, renderer.camera);
  player.yaw = yaw;
  player.root.rotation.y = yaw;
  aimCameraAt(game.city, renderer.camera, player.position, yaw, offset, lookHeight);
}

function stageCover(game, shot) {
  const { player, renderer } = game;
  player.reset(shot.player[0], shot.player[1], shot.player[2], null);
  setShotCamera(renderer.camera, shot.camera, shot.lookAt);
  game.focus = { x: player.position.x, y: player.position.y + 1, z: player.position.z };
  game.trafficFocus = { x: shot.player[0], z: shot.player[1] };
  game.police?.clear();
}

function stageChase(game, shot) {
  const { city, renderer, player, police } = game;
  const coupe = game.vehicles.find((vehicle) => vehicle.specId === 'coupe') ?? game.vehicles[0];
  coupe.setPose(shot.coupe[0], shot.coupe[1], shot.coupe[2], shot.coupe[3]);
  player.setVehicle(coupe);
  player.position.copy(coupe.position);
  player.root.position.copy(coupe.position);
  setShotCamera(renderer.camera, shot.camera, shot.lookAt);
  game.focus = { x: coupe.position.x, y: coupe.position.y + 1, z: coupe.position.z };
  game.trafficFocus = { x: coupe.position.x, z: coupe.position.z };
  police?.stage('2-chase', {
    x: coupe.position.x, y: coupe.position.y, z: coupe.position.z, heading: coupe.heading,
  });
  police?.setWanted(shot.wanted);
  const cruisers = police?.units.filter((unit) => unit.kind === 'cruiser') ?? [];
  for (let i = 0; i < cruisers.length && i < shot.cruisers.length; i += 1) {
    const unit = cruisers[i];
    const pose = shot.cruisers[i];
    unit.position.set(pose.x, city.groundY(pose.x, pose.z) + 0.12, pose.z);
    unit.heading = pose.heading;
    unit.object3D.position.copy(unit.position);
    unit.object3D.rotation.y = unit.heading;
    unit.red.visible = true;
    unit.blue.visible = true;
  }
}

function stageCombat(game, shot) {
  const { player, renderer, city, police } = game;
  const [x, z, yaw] = shot.player;
  player.reset(x, z, yaw, null);
  player.yaw = yaw;
  player.root.rotation.y = yaw;
  setShotCamera(renderer.camera, shot.camera, shot.lookAt);
  police?.stage('3-combat', {
    x: player.position.x, y: player.position.y, z: player.position.z, heading: yaw,
  });
  police?.setWanted(shot.wanted);
  game.focus = { x: player.position.x, y: player.position.y + 1, z: player.position.z };
  game.trafficFocus = { x, z };
  const officers = police?.units.filter((unit) => unit.kind === 'officer') ?? [];
  for (let i = 0; i < officers.length && i < shot.officers.length; i += 1) {
    const unit = officers[i];
    const [ox, oz] = shot.officers[i];
    unit.position.set(ox, city.groundY(ox, oz), oz);
    unit.heading = Math.atan2(x - ox, z - oz);
    unit.object3D.position.copy(unit.position);
    unit.object3D.rotation.y = unit.heading;
  }
  const air = police?.units.find((unit) => unit.kind === 'air');
  if (air) {
    const [ax, ay, az] = shot.air;
    air.position.set(ax, ay, az);
    air.object3D.position.copy(air.position);
    const height = ay - city.groundY(x, z);
    air.beam.position.y = -height * 0.5;
    air.beam.scale.y = height / 17;
    air.beam.rotation.x = -Math.atan2(z - az, height);
    air.beam.rotation.z = Math.atan2(x - ax, height);
    air.glow.position.set(x - ax, city.groundY(x, z) - ay + 0.3, z - az);
  }
}

function stageParkedCars(game, shot) {
  for (const pose of shot.parkedCars) {
    const car = game.vehicles.find((vehicle) => vehicle.specId === pose.specId);
    car?.setPose(pose.x, pose.z, pose.heading);
  }
}

export function applyShot(name, game) {
  const shot = SHOTS[name] ?? SHOTS['1-cover'];
  game.state = 'shot';
  game.shot = SHOTS[name] ? name : '1-cover';
  game.shotLabel = shot.label;
  const camera = game.renderer.camera;
  game.sky.auto = false;
  game.sky.setHour(shot.hour);
  game.city.setNight(game.sky.isNight);
  installShotTrafficFix(game);

  if (game.shot === '1-cover') {
    stageCover(game, shot);
  } else if (game.shot === '2-chase' && game.vehicles?.length) {
    stageChase(game, shot);
  } else if (game.shot === '3-combat') {
    stageCombat(game, shot);
  } else {
    placeOnFoot(game, shot, FOOT_OFFSET, FOOT_LOOK_HEIGHT);
    setShotCamera(camera, shot.camera, shot.lookAt);
    game.trafficFocus = { x: game.player.position.x, z: game.player.position.z };
    game.police?.clear();
    if (shot.parkedCars) stageParkedCars(game, shot);
  }

  game.traffic?.redistribute(game.trafficFocus.x, game.trafficFocus.z, camera.position);
  clearTrafficNearCamera(game.traffic, camera);
  game.combat?.stage?.(game.shot, game);
  game.missions?.stage?.(game.shot, game);
  if (shot.beacon) game.missions?.setShotBeacon?.(shot.beacon[0], shot.beacon[1]);
  game.missions?.update(0, game.player);
  game.shotFrames = 0;
  return shot;
}

export const SHOT_NAMES = Object.keys(SHOTS);
