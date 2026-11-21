import * as THREE from 'three';
import { STORY } from './story.js';
import { makeBox, makeCylinder, mergeParts } from '../render/parts.js';

const GARAGE = { x: -140, z: -128 };
const MARINA = { x: 190, z: 296 };
const CLINIC = { x: 100, z: -31 };
const STOLEN_CAR = { x: -119, z: -114, heading: Math.PI / 2 };
const DEBTOR = { x: -200, z: -200 };
const MENA = { x: 200, z: -200 };
const SURVIVE_SECONDS = 28;
const GIVER_RANGE = 8;
const CHECKPOINTS = [
  { x: -120, z: 220 },
  { x: 40, z: 220 },
  { x: 200, z: 220 },
  { x: 200, z: 40 },
  { x: 40, z: -60 },
  { x: -120, z: 60 },
  { x: -120, z: 220 },
];

export const MISSIONS = [
  {
    id: 1, name: 'Package for Nina', type: 'go-to', reward: 450,
    giver: { speaker: 'Nina Salas', location: 'Costanera', x: -64, z: 206 },
    objective: 'Deliver Nina\'s package to the marina',
  },
  {
    id: 2, name: 'Wheels for Tuco', type: 'steal', reward: 600,
    giver: { speaker: 'Tuco Bravo', location: 'Taller Tuco', x: -140, z: -128 },
    objective: 'Steal the marked sedan in Mercado',
  },
  {
    id: 3, name: 'Quiet Parking', type: 'deliver', reward: 800,
    giver: { speaker: 'Nina Salas', location: 'Taller Tuco', x: -140, z: -126 },
    objective: 'Deliver the stolen car to Taller Tuco',
  },
  {
    id: 4, name: 'A Debt Remembered', type: 'kill', reward: 950,
    giver: { speaker: 'La Vieja', location: 'Mercado', x: -200, z: -94 },
    objective: 'Take down La Vieja\'s debtor',
  },
  {
    id: 5, name: 'Hot Night', type: 'survive', reward: 1100,
    giver: { speaker: 'Nina Salas', location: 'Costanera', x: -200, z: 206 },
    objective: 'Survive the PVD pursuit',
  },
  {
    id: 6, name: 'Boulevard Sprint', type: 'race', reward: 1400,
    giver: { speaker: 'Tuco Bravo', location: 'Taller Tuco', x: -140, z: -128 },
    objective: 'Complete Tuco\'s checkpoint race',
  },
  {
    id: 7, name: 'Safe Passage', type: 'escort', reward: 1650,
    giver: { speaker: 'Nina Salas', location: 'Muelle', x: 190, z: 296 },
    objective: 'Escort the courier to Clinica Solaris',
  },
  {
    id: 8, name: 'Last Word', type: 'kill', reward: 2500,
    giver: { speaker: 'Coronel Mena', location: 'Cerro Alto', x: 200, z: -194 },
    objective: 'Take down Coronel Mena',
  },
];

function distanceSquared(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function makeBeacon() {
  const group = new THREE.Group();
  group.name = 'Mission giver beacon';
  const shellMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd65b, transparent: true, opacity: 0.19,
    depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff0b8, transparent: true, opacity: 0.72, depthWrite: false, fog: false,
  });
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd65b, transparent: true, opacity: 0.6, depthWrite: false, fog: false,
  });
  const shell = new THREE.Mesh(makeCylinder(1.25, 1.25, 12, 10, '#ffd65b'), shellMaterial);
  shell.position.y = 6;
  const core = new THREE.Mesh(makeCylinder(0.15, 0.15, 12, 6, '#fff0b8'), coreMaterial);
  core.position.y = 6;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.1, 6, 24), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  const cap = new THREE.Mesh(makeBox(0.62, 0.62, 0.62, '#fff0b8'), coreMaterial);
  cap.position.y = 12.25;
  cap.rotation.y = Math.PI / 4;
  group.add(shell, core, ring, cap);
  group.visible = false;
  return { group, shellMaterial, coreMaterial, ring };
}

function courierGeometry() {
  return mergeParts([
    { geometry: makeBox(0.22, 0.8, 0.24, '#3d4a57'), position: [-0.14, 0.45, 0] },
    { geometry: makeBox(0.22, 0.8, 0.24, '#3d4a57'), position: [0.14, 0.45, 0] },
    { geometry: makeBox(0.6, 0.72, 0.34, '#2f6b7f'), position: [0, 1.25, 0] },
    { geometry: makeBox(0.16, 0.55, 0.18, '#2f6b7f'), position: [-0.38, 1.22, 0] },
    { geometry: makeBox(0.16, 0.55, 0.18, '#2f6b7f'), position: [0.38, 1.22, 0] },
    { geometry: makeBox(0.3, 0.32, 0.3, '#c98d63'), position: [0, 1.82, 0] },
    { geometry: makeBox(0.34, 0.1, 0.34, '#2b211b'), position: [0, 2.01, 0] },
    { geometry: makeBox(0.38, 0.42, 0.16, '#b8493f'), position: [0.3, 0.96, 0.2] },
  ]);
}

export class Missions {
  constructor(city, hud, audio = null) {
    this.city = city;
    this.hud = hud;
    this.audio = audio;
    this.index = 0;
    this.time = 0;
    this._current = null;
    this._stage = 'idle';
    this._view = {};
    this._target = { x: 0, z: 0 };
    this._giver = { x: 0, z: 0 };
    this._shotBeacon = null;
    this._dialogue = [];
    this._dialogueTimer = 0;
    this._completeTimer = 0;
    this._stolenVehicle = null;
    this._escortWarning = false;
    this._active = {
      vehicle: null, ped: null, checkpoint: 0, survival: 0, reheat: 0, courier: null,
    };
    this._ctx = { game: null, player: null, police: null, traffic: null, vehicles: [] };
    this._tint = new THREE.Color();

    this.group = new THREE.Group();
    this.group.name = 'Mission props';
    city.group.add(this.group);
    this.beacon = makeBeacon();
    this.group.add(this.beacon.group);
    this.courierMesh = new THREE.Mesh(
      courierGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    this.courierMesh.visible = false;
    this.group.add(this.courierMesh);
  }

  attach(ctx) {
    Object.assign(this._ctx, ctx);
    return this;
  }

  get current() {
    const mission = this._current;
    if (!mission) return null;
    const view = this._view;
    view.id = mission.id;
    view.name = mission.name;
    view.type = mission.type;
    view.reward = mission.reward;
    view.giver = mission.giver;
    view.stage = this._stage;
    view.target = this.targetFor(mission);
    view.objective = this.objectiveFor(mission);
    view.prompt = this.prompt;
    return view;
  }

  get objectiveText() {
    if (this._current) return this.objectiveFor(this._current);
    const next = this.available();
    return next ? `Meet ${next.giver.speaker} · ${next.giver.location}` : 'All Velamar jobs complete';
  }

  setShotBeacon(x, z) {
    this._shotBeacon = { x, z };
    this.target = this._shotBeacon;
    return this;
  }

  get marker() {
    if (this._shotBeacon) return this._shotBeacon;
    const target = this.targetFor(this._current);
    if (target) return target;
    const mission = this.available() ?? this._current;
    if (!mission) return null;
    this._giver.x = mission.giver.x;
    this._giver.z = mission.giver.z;
    return this._giver;
  }

  get prompt() {
    if (this._current || this._ctx.player?.inVehicle) return '';
    const next = this.available();
    const player = this._ctx.player;
    if (!next || !player) return '';
    return distanceSquared(player.position.x, player.position.z, next.giver.x, next.giver.z)
      <= GIVER_RANGE * GIVER_RANGE ? `START ${next.name.toUpperCase()}` : '';
  }

  available() {
    return MISSIONS[this.index] ?? null;
  }

  targetFor(mission) {
    if (!mission) return null;
    const out = this._target;
    const active = this._active;
    if (mission.id === 1) {
      out.x = MARINA.x;
      out.z = MARINA.z;
    } else if (mission.id === 2) {
      const vehicle = active.vehicle;
      out.x = vehicle?.position?.x ?? STOLEN_CAR.x;
      out.z = vehicle?.position?.z ?? STOLEN_CAR.z;
    } else if (mission.id === 3) {
      out.x = GARAGE.x;
      out.z = GARAGE.z;
    } else if (mission.id === 4) {
      out.x = active.ped?.position?.x ?? DEBTOR.x;
      out.z = active.ped?.position?.z ?? DEBTOR.z;
    } else if (mission.id === 5) {
      return null;
    } else if (mission.id === 6) {
      const checkpoint = CHECKPOINTS[Math.min(active.checkpoint, CHECKPOINTS.length - 1)];
      out.x = checkpoint.x;
      out.z = checkpoint.z;
    } else if (mission.id === 7) {
      const courier = active.courier;
      out.x = courier?.position?.x ?? MARINA.x;
      out.z = courier?.position?.z ?? MARINA.z;
    } else {
      out.x = active.ped?.position?.x ?? MENA.x;
      out.z = active.ped?.position?.z ?? MENA.z;
    }
    return out;
  }

  objectiveFor(mission) {
    if (this._stage === 'complete' || this._stage === 'staged') {
      return `MISSION COMPLETE · +$${mission.reward.toLocaleString('en-US')}`;
    }
    if (mission.id === 5) {
      const left = Math.max(0, Math.ceil(SURVIVE_SECONDS - this._active.survival));
      return `Survive the PVD pursuit · ${left}s`;
    }
    if (mission.id === 6) {
      const number = Math.min(this._active.checkpoint + 1, CHECKPOINTS.length);
      return `Checkpoint ${number}/${CHECKPOINTS.length} · reach the yellow beacon`;
    }
    if (mission.id === 7 && this._escortWarning) return 'Courier waiting · get back to the courier';
    return mission.objective;
  }

  tryStart(player = this._ctx.player) {
    if (this._current || !player || player.inVehicle) return false;
    const next = this.available();
    if (!next) return false;
    if (distanceSquared(player.position.x, player.position.z, next.giver.x, next.giver.z)
      > GIVER_RANGE * GIVER_RANGE) return false;
    return this.start(next.id);
  }

  start(id) {
    const mission = MISSIONS.find((item) => item.id === id);
    if (!mission || (mission.id <= this.index && this._stage !== 'staged')) return false;
    return this._begin(mission);
  }

  _begin(mission) {
    this._current = mission;
    this._stage = 'active';
    this._active.vehicle = null;
    this._active.ped = null;
    this._active.checkpoint = 0;
    this._active.survival = 0;
    this._active.reheat = 0;
    this._active.courier = null;
    this._escortWarning = false;
    this.courierMesh.visible = false;

    if (mission.id === 2) {
      const fleet = this._ctx.vehicles ?? [];
      const vehicle = fleet.find((item) => item.specId === 'sedan') ?? fleet[0];
      if (vehicle && vehicle.specId !== 'police') {
        vehicle.setPose(STOLEN_CAR.x, STOLEN_CAR.z, STOLEN_CAR.heading);
        this._active.vehicle = vehicle;
        this._stolenVehicle = vehicle;
      }
    } else if (mission.id === 3) {
      this._active.vehicle = this._stolenVehicle;
    } else if (mission.id === 4) {
      this._prepareTarget(DEBTOR.x, DEBTOR.z, '#c98d63');
    } else if (mission.id === 5) {
      this._ctx.police?.setWanted?.(3);
      this._ctx.police?.setFocus?.(null);
    } else if (mission.id === 6) {
      const coupe = (this._ctx.vehicles ?? []).find((item) => item.specId === 'coupe');
      if (coupe) coupe.setPose(CHECKPOINTS[0].x, CHECKPOINTS[0].z, Math.PI / 2);
    } else if (mission.id === 7) {
      this._prepareCourier();
    } else if (mission.id === 8) {
      this._prepareTarget(MENA.x, MENA.z, '#8c3340');
    }

    this._dialogue.length = 0;
    for (const line of STORY.dialogue[mission.id] ?? []) this._dialogue.push(line);
    this._sayNext();
    this.audio?.sfx?.('missionStart');
    return true;
  }

  _prepareTarget(x, z, color) {
    const ped = this._pickPed(x, z);
    if (!ped) return;
    this._active.ped = ped;
    if (color && ped.mesh?.instanceColor) {
      this._tint.set(color);
      ped.color.copy(this._tint);
      ped.mesh.setColorAt(ped.slot, this._tint);
      ped.mesh.instanceColor.needsUpdate = true;
    }
    this._holdPed(x, z);
  }

  _pickPed(x, z) {
    const peds = this._ctx.traffic?.peds ?? [];
    let best = null;
    let bestDistance = Infinity;
    for (const ped of peds) {
      if (ped.state === 3) continue;
      const distance = distanceSquared(ped.position.x, ped.position.z, x, z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = ped;
      }
    }
    return best;
  }

  _holdPed(x, z) {
    const ped = this._active.ped;
    if (!ped || ped.state === 3) return;
    ped.position.set(x, this.city.groundY(x, z) + 0.3, z);
    this._ctx.traffic?.stagger?.(ped, x, z);
    ped.timer = 1.2;
  }

  _prepareCourier() {
    const graph = this.city.graph;
    const from = graph.nearest(MARINA.x, MARINA.z);
    const to = graph.nearest(CLINIC.x, CLINIC.z);
    const route = graph.path(from, to);
    const path = [];
    for (const node of route) path.push({ x: graph.nodes[node].x, z: graph.nodes[node].z });
    path.push({ x: CLINIC.x, z: CLINIC.z });
    const start = path[0] ?? { x: MARINA.x, z: MARINA.z };
    this._active.courier = {
      path, index: 1, heading: 0,
      position: new THREE.Vector3(start.x, this.city.groundY(start.x, start.z) + 0.3, start.z),
    };
    this.courierMesh.position.copy(this._active.courier.position);
    this.courierMesh.visible = true;
  }

  _updateCourier(dt, player) {
    const courier = this._active.courier;
    if (!courier) return false;
    const tooFar = player && distanceSquared(player.position.x, player.position.z,
      courier.position.x, courier.position.z) > 48 * 48;
    this._escortWarning = tooFar;
    if (!tooFar) {
      const goal = courier.path[courier.index];
      if (goal) {
        const dx = goal.x - courier.position.x;
        const dz = goal.z - courier.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.8) {
          courier.index += 1;
        } else {
          const step = Math.min(distance, 5.6 * dt);
          courier.position.x += (dx / distance) * step;
          courier.position.z += (dz / distance) * step;
          courier.position.y = this.city.groundY(courier.position.x, courier.position.z) + 0.3;
          courier.heading = Math.atan2(dx, dz);
        }
      }
    }
    this.courierMesh.position.copy(courier.position);
    this.courierMesh.rotation.y = courier.heading;
    this.courierMesh.position.y += Math.abs(Math.sin(this.time * 8)) * 0.04;
    const arrived = courier.index >= courier.path.length;
    if (!arrived || !player) return false;
    return distanceSquared(player.position.x, player.position.z,
      courier.position.x, courier.position.z) < 30 * 30;
  }

  _sayNext() {
    const line = this._dialogue.shift();
    if (!line) {
      this.hud?.say?.('', '');
      return;
    }
    this.hud?.say?.(line.speaker, line.line, Boolean(line.instant));
    this._dialogueTimer = Math.max(2.4, line.line.length * 0.026 + 1.3);
  }

  _updateDialogue(dt) {
    if (this._dialogueTimer <= 0) return;
    this._dialogueTimer -= dt;
    if (this._dialogueTimer > 0) return;
    if (this._dialogue.length) this._sayNext();
    else if (this._stage !== 'complete') {
      this._dialogueTimer = 0;
      this.hud?.say?.('', '');
    }
  }

  _updateMarker(dt) {
    const mission = this._current;
    const next = this.available();
    const point = this.marker;
    this.beacon.group.visible = Boolean(point) && (Boolean(mission) || Boolean(next));
    if (!point) return;
    this.beacon.group.position.set(point.x, this.city.groundY(point.x, point.z) + 0.08, point.z);
    const pulse = Math.sin(this.time * 3.2);
    this.beacon.shellMaterial.opacity = 0.15 + pulse * 0.05;
    this.beacon.coreMaterial.opacity = 0.62 + pulse * 0.14;
    this.beacon.ring.scale.setScalar(1 + pulse * 0.12);
    this.beacon.ring.rotation.z += dt * 0.8;
  }

  update(dt, player = this._ctx.player) {
    this.time += dt;
    this._updateMarker(dt);
    this._updateDialogue(dt);
    if (this._stage === 'complete') {
      this._completeTimer -= dt;
      if (this._completeTimer <= 0) {
        this._current = null;
        this._stage = 'idle';
        this.hud?.say?.('', '');
      }
      return;
    }
    if (!this._current || this._stage !== 'active' || !player) return;
    const mission = this._current;
    const active = this._active;

    if (mission.id === 1) {
      if (distanceSquared(player.position.x, player.position.z, MARINA.x, MARINA.z) < 13 * 13) {
        this.complete(mission.id);
      }
    } else if (mission.id === 2) {
      const vehicle = active.vehicle;
      const stolen = player.inVehicle && player.vehicle
        && (vehicle ? player.vehicle === vehicle : player.vehicle.specId !== 'police');
      if (stolen) this.complete(mission.id);
    } else if (mission.id === 3) {
      const vehicle = active.vehicle;
      const delivered = player.inVehicle && player.vehicle
        && (vehicle ? player.vehicle === vehicle : player.vehicle.specId !== 'police')
        && distanceSquared(player.position.x, player.position.z, GARAGE.x, GARAGE.z) < 14 * 14;
      if (delivered) this.complete(mission.id);
    } else if (mission.id === 4 || mission.id === 8) {
      const spot = mission.id === 4 ? DEBTOR : MENA;
      if (active.ped?.state === 3) this.complete(mission.id);
      else this._holdPed(spot.x, spot.z);
    } else if (mission.id === 5) {
      const police = this._ctx.police;
      if (police?.wanted > 0 && player.health > 0) {
        active.survival += dt;
        active.reheat = 0;
      } else if (police) {
        active.reheat += dt;
        if (active.reheat >= 4) {
          police.setWanted?.(3);
          active.reheat = 0;
        }
      }
      if (active.survival >= SURVIVE_SECONDS) this.complete(mission.id);
    } else if (mission.id === 6) {
      const checkpoint = CHECKPOINTS[active.checkpoint];
      if (checkpoint && player.inVehicle
        && distanceSquared(player.position.x, player.position.z, checkpoint.x, checkpoint.z) < 14 * 14) {
        active.checkpoint += 1;
        this.audio?.sfx?.('pickup');
        if (active.checkpoint >= CHECKPOINTS.length) this.complete(mission.id);
        else this.hud?.toast?.(`CHECKPOINT ${active.checkpoint}/${CHECKPOINTS.length - 1}`);
      }
    } else if (mission.id === 7) {
      if (this._updateCourier(dt, player)) this.complete(mission.id);
    }
  }

  complete(id) {
    const mission = this._current;
    if (!mission || mission.id !== id || this._stage !== 'active') return false;
    this._stage = 'complete';
    this._completeTimer = 4.2;
    this.index = Math.max(this.index, mission.id);
    const player = this._ctx.player;
    if (player) player.money += mission.reward;
    this.hud?.toast?.(`MISSION COMPLETE · +$${mission.reward.toLocaleString('en-US')}`);
    this._dialogue.length = 0;
    this._dialogue.push({
      speaker: mission.giver.speaker,
      line: STORY.complete[mission.id - 1] ?? 'Another job in the books.',
    });
    this._dialogueTimer = 0;
    this._sayNext();
    this.audio?.sfx?.('missionComplete');
    return true;
  }

  reset() {
    this._shotBeacon = null;
    this.target = null;
    this.index = 0;
    this.time = 0;
    this._current = null;
    this._stage = 'idle';
    this._dialogue.length = 0;
    this._dialogueTimer = 0;
    this._completeTimer = 0;
    this._stolenVehicle = null;
    this._escortWarning = false;
    this._active.vehicle = null;
    this._active.ped = null;
    this._active.checkpoint = 0;
    this._active.survival = 0;
    this._active.reheat = 0;
    this._active.courier = null;
    this.courierMesh.visible = false;
    this.hud?.say?.('', '');
  }

  stage(name, game) {
    this.reset();
    if (name === '1-cover') {
      this.hud?.say?.('Nina Salas', STORY.intro.line, true);
    } else if (name === '4-mission') {
      this._current = MISSIONS[0];
      this._stage = 'staged';
      this.hud?.toast?.('MISSION COMPLETE · +$450');
      this.hud?.say?.('Nina Salas', STORY.complete[0], true);
      if (game?.player) game.player.money += 450;
    }
    return this;
  }
}
