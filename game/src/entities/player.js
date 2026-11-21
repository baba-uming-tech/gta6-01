// Third-person on-foot controller for Rafa Quintero. Every limb is merged into one vertex-coloured
// geometry on its own pivot so the walk cycle can swing arms and legs without extra draw calls.
// The camera rides a smoothed spring arm that shortens when city.collide reports a wall.

import * as THREE from 'three';
import { KEYBINDS } from '../config.js';
import { clamp, damp } from '../core/rng.js';
import { makeBox, mergeParts } from '../render/parts.js';

const SKIN = '#c98d63';
const SHIRT = '#f0e2c4';
const VEST = '#2f6b7f';
const TROUSERS = '#3d4a57';
const BOOTS = '#4a352a';
const HAIR = '#2b211b';
const BELT = '#8b6a43';
const SCARF = '#c4433f';

const FEET_Y = 0.28;
const WALK_SPEED = 4.6;
const SPRINT_SPEED = 8.6;
const ACCEL = 11;
const TURN_RATE = 12;
const GRAVITY = 24;
const JUMP_SPEED = 8.4;
const FOCUS_HEIGHT = 1.35;
const CAMERA_EYE_HEIGHT = 2.8;
const CAMERA_CLEARANCE = 0.7;
const MOUSE_SENSITIVITY = 0.0026;
const DEFAULT_DISTANCE = 6.5;
const CAMERA_MIN = 2.1;
const CAMERA_MAX = 11;
const PITCH_MIN = -25 * Math.PI / 180;
const PITCH_MAX = 45 * Math.PI / 180;

function part(w, h, d, color, x, y, z) {
  return { geometry: makeBox(w, h, d, color), position: [x, y, z] };
}

function buildBody() {
  return mergeParts([
    part(0.62, 0.62, 0.34, SHIRT, 0, 1.26, 0),
    part(0.64, 0.42, 0.08, VEST, 0, 1.3, 0.19),
    part(0.64, 0.42, 0.08, VEST, 0, 1.3, -0.19),
    part(0.56, 0.24, 0.31, SHIRT, 0, 0.9, 0),
    part(0.6, 0.08, 0.37, BELT, 0, 1.05, 0),
    part(0.24, 0.12, 0.08, SCARF, 0, 1.55, 0.19),
    part(0.18, 0.14, 0.18, SKIN, 0, 1.62, 0),
    part(0.3, 0.34, 0.28, SKIN, 0, 1.8, 0),
    part(0.32, 0.12, 0.32, HAIR, 0, 1.95, 0),
    part(0.34, 0.05, 0.18, VEST, 0, 1.93, 0.21),
    part(0.07, 0.06, 0.05, SKIN, 0, 1.78, 0.18),
    part(0.05, 0.04, 0.02, HAIR, -0.08, 1.85, 0.165),
    part(0.05, 0.04, 0.02, HAIR, 0.08, 1.85, 0.165),
  ]);
}

function buildLeg() {
  return mergeParts([
    part(0.25, 0.46, 0.27, TROUSERS, 0, -0.23, 0),
    part(0.21, 0.44, 0.24, TROUSERS, 0, -0.66, 0),
    part(0.24, 0.14, 0.36, BOOTS, 0, -0.87, 0.07),
    part(0.26, 0.05, 0.39, '#2e211b', 0, -0.95, 0.07),
  ]);
}

function buildArm() {
  return mergeParts([
    part(0.18, 0.38, 0.2, SHIRT, 0, -0.19, 0),
    part(0.15, 0.34, 0.17, SKIN, 0, -0.53, 0),
    part(0.14, 0.13, 0.14, SKIN, 0, -0.78, 0),
  ]);
}

function dampAngle(current, target, lambda, dt) {
  const turn = Math.PI * 2;
  let delta = ((target - current + Math.PI) % turn + turn) % turn - Math.PI;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export class Player {
  constructor(scene, city) {
    this.city = city;
    this.position = new THREE.Vector3(city.spawnPoint[0], FEET_Y, city.spawnPoint[2]);
    this.velocity = new THREE.Vector3();
    this.health = 100;
    this.armour = 50;
    this.money = 500;
    this.weapon = 'pistol';
    this.ammo = { pistol: 12, smg: 45, shotgun: 8 };
    this.inVehicle = false;
    this.vehicle = null;
    this.camera = null;
    this.sensitivity = 1;
    this.invertY = false;

    const skin = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.root = new THREE.Group();
    this.root.name = 'Rafa Quintero';
    this.rig = new THREE.Group();
    this.root.add(this.rig);

    this.body = new THREE.Mesh(buildBody(), skin);
    this.rig.add(this.body);

    this.arms = [];
    this.legs = [];
    const armGeometry = buildArm();
    const legGeometry = buildLeg();
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.37, 1.52, 0);
      arm.rotation.z = side * 0.08;
      arm.add(new THREE.Mesh(armGeometry, skin));
      this.arms.push(arm);
      this.rig.add(arm);

      const leg = new THREE.Group();
      leg.position.set(side * 0.16, 0.96, 0);
      leg.add(new THREE.Mesh(legGeometry, skin));
      this.legs.push(leg);
      this.rig.add(leg);
    }

    this.shadow = new THREE.Mesh(
      makeBox(0.95, 0.02, 0.75, '#1c1b1c'),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.shadow.position.y = 0.02;
    this.root.add(this.shadow);
    scene.add(this.root);

    this.yaw = Math.PI / 2;
    this.cameraYaw = this.yaw;
    this.cameraPitch = 0;
    this.cameraDistance = DEFAULT_DISTANCE;
    this.zoom = DEFAULT_DISTANCE;
    this.phase = 0;
    this.gait = 0;
    this.land = 0;
    this.lastStep = -1;
    this.onGround = true;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
    this._focus = new THREE.Vector3();
    this._anchor = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._probe = new THREE.Vector3();

    this.reset(city.spawnPoint[0], city.spawnPoint[2], this.yaw);
  }

  reset(x, z, yaw = Math.PI / 2, camera = null) {
    this.position.set(x, FEET_Y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.cameraYaw = yaw;
    this.cameraPitch = 0;
    this.cameraDistance = this.zoom;
    this.phase = 0;
    this.gait = 0;
    this.land = 0;
    this.lastStep = -1;
    this.onGround = true;
    this.inVehicle = false;
    this.vehicle = null;
    this.root.visible = true;
    this.root.position.copy(this.position);
    this.root.rotation.y = this.yaw;
    this.rig.position.y = 0;
    this.rig.rotation.x = 0;
    if (camera) this.updateCamera(1, camera, true);
  }

  update(dt, input, camera, ctx) {
    this.camera = camera;
    if (this.inVehicle) {
      if (!this.vehicle) {
        this.inVehicle = false;
        this.root.visible = true;
        return;
      }
      const throttle = (input.isDown(KEYBINDS.forward) ? 1 : 0) - (input.isDown(KEYBINDS.back) ? 1 : 0);
      const steer = (input.isDown(KEYBINDS.right) ? 1 : 0) - (input.isDown(KEYBINDS.left) ? 1 : 0);
      const handbrake = input.isDown(KEYBINDS.handbrake) || input.isDown(KEYBINDS.jump);
      this.vehicle.update(dt, {
        throttle,
        steer,
        brake: input.isDown(KEYBINDS.back),
        handbrake,
      }, this.city);
      this.cameraYaw = dampAngle(this.cameraYaw, this.vehicle.heading, 4, dt)
        + input.mouseDX * MOUSE_SENSITIVITY * this.sensitivity;
      this.cameraPitch = clamp(this.cameraPitch
        + input.mouseDY * MOUSE_SENSITIVITY * this.sensitivity * (this.invertY ? -1 : 1), PITCH_MIN, PITCH_MAX);
      const lookYaw = ((this.cameraYaw - this.vehicle.heading + Math.PI) % (Math.PI * 2)
        + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.vehicle.updateCamera(dt, camera, { yaw: lookYaw, pitch: this.cameraPitch });
      this.position.copy(this.vehicle.position).setY(FEET_Y);
      this.yaw = this.vehicle.heading;
      ctx?.audio?.engine?.(this.vehicle.speed / this.vehicle.spec.topSpeed);
      return;
    }

    camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    if (this._forward.lengthSq() < 1e-6) this._forward.set(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    this._forward.normalize();
    this._right.set(-this._forward.z, 0, this._forward.x);

    const axisRight = (input.isDown(KEYBINDS.right) ? 1 : 0) - (input.isDown(KEYBINDS.left) ? 1 : 0);
    const axisForward = (input.isDown(KEYBINDS.forward) ? 1 : 0) - (input.isDown(KEYBINDS.back) ? 1 : 0);
    this._wish.set(0, 0, 0)
      .addScaledVector(this._forward, axisForward)
      .addScaledVector(this._right, axisRight);
    const moving = this._wish.lengthSq() > 0;
    if (moving) this._wish.normalize();
    const sprinting = input.isDown(KEYBINDS.sprint);
    this._wish.multiplyScalar(moving ? (sprinting ? SPRINT_SPEED : WALK_SPEED) : 0);

    this.velocity.x = damp(this.velocity.x, this._wish.x, ACCEL, dt);
    this.velocity.z = damp(this.velocity.z, this._wish.z, ACCEL, dt);

    if (input.pressed(KEYBINDS.jump) && this.onGround) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.velocity.y -= GRAVITY * dt;
      this.position.y += this.velocity.y * dt;
      const ground = this.city.groundY(this.position.x, this.position.z) + FEET_Y;
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.velocity.y = 0;
        this.onGround = true;
        this.land = 1;
        ctx?.audio?.sfx?.('land');
      }
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.city.collide(this.position, 0.42);
    this.root.position.copy(this.position);

    const planarSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (planarSpeed > 0.4) {
      this.yaw = dampAngle(this.yaw, Math.atan2(this.velocity.x, this.velocity.z), TURN_RATE, dt);
    }
    this.root.rotation.y = this.yaw;

    this.animate(dt, planarSpeed, sprinting, ctx);

    this.cameraYaw += input.mouseDX * MOUSE_SENSITIVITY * this.sensitivity;
    this.cameraPitch = clamp(this.cameraPitch
      + input.mouseDY * MOUSE_SENSITIVITY * this.sensitivity * (this.invertY ? -1 : 1), PITCH_MIN, PITCH_MAX);
    if (input.pressed(KEYBINDS.camera)) this.zoom = this.zoom === DEFAULT_DISTANCE ? 9.5 : DEFAULT_DISTANCE;
    if (input.wheel) this.zoom = clamp(this.zoom + input.wheel * 0.006, CAMERA_MIN, CAMERA_MAX);
    this.updateCamera(dt, camera, false);
  }

  animate(dt, planarSpeed, sprinting, ctx) {
    const targetGait = this.onGround ? clamp(planarSpeed / WALK_SPEED, 0, 1.9) : 0;
    this.gait = damp(this.gait, targetGait, 9, dt);
    if (this.onGround && planarSpeed > 0.3) this.phase += dt * (5.4 + planarSpeed * 1.2);

    const swing = Math.sin(this.phase);
    this.legs[0].rotation.x = swing * 0.7 * this.gait;
    this.legs[1].rotation.x = -swing * 0.7 * this.gait;
    this.arms[0].rotation.x = -swing * 0.58 * this.gait;
    this.arms[1].rotation.x = swing * 0.58 * this.gait;

    if (!this.onGround) {
      this.legs[0].rotation.x = -0.4;
      this.legs[1].rotation.x = 0.22;
      this.arms[0].rotation.x = 0.5;
      this.arms[1].rotation.x = 0.5;
    }

    this.land = Math.max(0, this.land - dt * 3.6);
    const bob = Math.abs(Math.sin(this.phase)) * 0.055 * this.gait;
    this.rig.position.y = bob - this.land * 0.16;
    this.rig.rotation.x = this.onGround
      ? (sprinting ? clamp((planarSpeed - WALK_SPEED) / (SPRINT_SPEED - WALK_SPEED), 0, 1) * 0.09 : 0)
      : -0.05;

    if (this.onGround && this.gait > 0.2) {
      const step = Math.floor(this.phase / Math.PI);
      if (step !== this.lastStep) {
        this.lastStep = step;
        ctx?.audio?.sfx?.('footstep');
      }
    }
  }

  updateCamera(dt, camera, snap = false) {
    this._focus.set(this.position.x, this.position.y + FOCUS_HEIGHT, this.position.z);
    this._anchor.set(this.position.x, this.position.y + CAMERA_EYE_HEIGHT, this.position.z);
    this.cameraPitch = clamp(this.cameraPitch, PITCH_MIN, PITCH_MAX);

    const sy = Math.sin(this.cameraYaw);
    const cy = Math.cos(this.cameraYaw);
    const cp = Math.cos(this.cameraPitch);
    this._offset.set(-sy * cp, Math.sin(this.cameraPitch), -cy * cp);

    let allowed = this.zoom;
    for (let i = 1; i <= 8; i += 1) {
      const t = (i / 8) * this.zoom;
      this._probe.copy(this._anchor).addScaledVector(this._offset, t);
      const x = this._probe.x;
      const z = this._probe.z;
      this.city.collide(this._probe, 0.34);
      if (Math.abs(this._probe.x - x) > 0.02 || Math.abs(this._probe.z - z) > 0.02) {
        allowed = Math.max(CAMERA_MIN, t - 0.4);
        break;
      }
    }

    const lambda = allowed < this.cameraDistance ? 22 : 7;
    this.cameraDistance = snap ? allowed : damp(this.cameraDistance, allowed, lambda, dt);
    camera.position.copy(this._anchor).addScaledVector(this._offset, this.cameraDistance);
    const floor = this.city.groundY(camera.position.x, camera.position.z) + CAMERA_CLEARANCE;
    if (camera.position.y < floor) camera.position.y = floor;
    if (camera.near !== 0.1) {
      camera.near = 0.1;
      camera.updateProjectionMatrix();
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(this._focus);
  }

  takeDamage(amount) {
    let remaining = Math.max(0, amount);
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, remaining);
      this.armour -= absorbed;
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    return this.health;
  }

  heal(amount) {
    this.health = Math.min(100, this.health + Math.max(0, amount));
    return this.health;
  }

  setVehicle(vehicle) {
    if (!vehicle || vehicle.occupants?.length >= vehicle.capacity) return false;
    this.vehicle = vehicle;
    this.inVehicle = true;
    this.root.visible = false;
    this.velocity.set(0, 0, 0);
    this.cameraYaw = vehicle.heading;
    this.cameraPitch = 0;
    if (vehicle.setDriver) vehicle.setDriver(this);
    else vehicle.enter?.(this);
    return true;
  }

  exitVehicle() {
    const vehicle = this.vehicle;
    this.inVehicle = false;
    this.vehicle = null;
    this.root.visible = true;
    if (vehicle) {
      const side = 2.2;
      this.position.set(
        vehicle.position.x - Math.cos(vehicle.heading) * side,
        vehicle.position.y + FEET_Y,
        vehicle.position.z + Math.sin(vehicle.heading) * side,
      );
      this.city.collide(this.position, 0.42);
      this.root.position.copy(this.position);
      this.cameraYaw = vehicle.heading;
      this.cameraPitch = 0;
      if (vehicle.setDriver) vehicle.setDriver(null);
      else vehicle.exit?.(this);
    }
  }

  aimRay(out = new THREE.Ray()) {
    if (this.camera) {
      out.origin.copy(this.camera.position);
      this.camera.getWorldDirection(out.direction);
    } else {
      out.origin.copy(this.position).setY(this.position.y + FOCUS_HEIGHT);
      out.direction.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    }
    return out;
  }
}
