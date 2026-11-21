import * as THREE from 'three';
import { VEHICLE } from '../config.js';
import { clamp, damp } from '../core/rng.js';
import { makeBox, makeCylinder, makeCylinder as cylinder, mergeParts, textTexture } from '../render/parts.js';

const GLASS = '#29495a';
const TRIM = '#242a31';
const RUBBER = '#191b1f';
const RIM = '#c6cad0';
const HEADLIGHT = '#fff2c8';
const TAILLIGHT = '#c33b34';
const BRAKE = '#ff5544';

function box(w, h, d, color, x, y, z, rotation) {
  const part = { geometry: makeBox(w, h, d, color), position: [x, y, z] };
  if (rotation) part.rotation = rotation;
  return part;
}

function wheelParts(spec) {
  const parts = [];
  const halfWidth = spec.width / 2 - 0.06;
  const axle = spec.length * 0.32;
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      parts.push({
        geometry: makeCylinder(0.36, 0.36, 0.24, 10, RUBBER),
        position: [side * halfWidth, 0.38, end * axle],
        rotation: [0, 0, Math.PI / 2],
      });
      parts.push({
        geometry: cylinder(0.19, 0.19, 0.26, 8, RIM),
        position: [side * halfWidth, 0.38, end * axle],
        rotation: [0, 0, Math.PI / 2],
      });
    }
  }
  return parts;
}

function sedanParts(spec, color) {
  const { length: l, width: w, height: h } = spec;
  return [
    box(w, h * 0.44, l, color, 0, 0.42 + h * 0.22, 0),
    box(w * 0.9, h * 0.3, l * 0.46, GLASS, 0, h * 0.78, -l * 0.05),
    box(w * 0.93, 0.14, l * 0.48, color, 0, h * 0.95, -l * 0.05),
    box(w * 0.85, 0.1, l * 0.2, '#8f9599', 0, 0.45 + h * 0.44, l * 0.34),
    box(w * 0.85, 0.1, l * 0.16, '#8f9599', 0, 0.45 + h * 0.44, -l * 0.36),
    box(0.1, h * 0.28, l * 0.44, TRIM, -w * 0.45, h * 0.78, -l * 0.05),
    box(0.1, h * 0.28, l * 0.44, TRIM, w * 0.45, h * 0.78, -l * 0.05),
  ];
}

function coupeParts(spec, color) {
  const { length: l, width: w, height: h } = spec;
  return [
    box(w, h * 0.5, l, color, 0, 0.36 + h * 0.25, 0),
    box(w * 0.82, h * 0.3, l * 0.36, GLASS, 0, h * 0.76, -l * 0.08),
    box(w * 0.86, 0.1, l * 0.38, color, 0, h * 0.92, -l * 0.08),
    box(w * 0.9, 0.13, l * 0.12, TRIM, 0, h * 0.98, -l * 0.45),
    box(w * 0.4, 0.1, l * 0.2, '#f5f0e6', 0, 0.39 + h * 0.5, l * 0.28),
  ];
}

function vanParts(spec, color) {
  const { length: l, width: w, height: h } = spec;
  return [
    box(w, h * 0.76, l, color, 0, 0.38 + h * 0.38, 0),
    box(w * 0.9, h * 0.24, l * 0.2, GLASS, 0, h * 0.84, l * 0.36),
    box(w * 0.92, h * 0.08, l * 0.78, '#f2e2c9', 0, h * 0.52, -l * 0.02),
    box(0.08, h * 0.26, l * 0.1, TRIM, -w * 0.5, h * 0.5, l * 0.05),
    box(w * 0.94, 0.12, l * 0.08, '#2f6b7f', 0, 0.5, -l * 0.42),
  ];
}

function pickupParts(spec, color) {
  const { length: l, width: w, height: h } = spec;
  return [
    box(w, h * 0.46, l * 0.55, color, 0, 0.42 + h * 0.23, l * 0.22),
    box(w * 0.9, h * 0.34, l * 0.34, GLASS, 0, h * 0.76, -l * 0.16),
    box(w * 0.94, 0.12, l * 0.36, color, 0, h * 0.95, -l * 0.16),
    box(w * 0.88, 0.12, l * 0.42, '#6f5738', 0, 0.58, -l * 0.29),
    box(0.14, 0.42, l * 0.42, color, -w * 0.45, 0.8, -l * 0.29),
    box(0.14, 0.42, l * 0.42, color, w * 0.45, 0.8, -l * 0.29),
    box(w * 0.9, 0.4, 0.14, color, 0, 0.78, -l * 0.49),
  ];
}

function sportsParts(spec, color) {
  const { length: l, width: w, height: h } = spec;
  return [
    box(w, h * 0.5, l * 0.94, color, 0, 0.3 + h * 0.25, 0),
    box(w * 0.78, h * 0.3, l * 0.4, GLASS, 0, h * 0.7, 0),
    box(w * 0.84, 0.08, l * 0.4, color, 0, h * 0.86, 0),
    box(w * 0.5, 0.12, l * 0.14, TRIM, 0, h * 0.96, -l * 0.44),
    box(0.14, 0.52, l * 0.14, TRIM, -w * 0.4, h * 0.82, -l * 0.45),
    box(0.14, 0.52, l * 0.14, TRIM, w * 0.4, h * 0.82, -l * 0.45),
    box(w * 0.16, 0.04, l * 0.8, '#f5f0e6', 0, 0.31 + h * 0.5, 0),
  ];
}

function policeParts(spec, color) {
  const { length: l, width: w, height: h } = spec;
  return [
    ...sedanParts(spec, color),
    box(w * 0.96, h * 0.16, l * 0.48, '#285a86', 0, 0.46, 0),
    box(w * 0.52, 0.12, 0.34, '#d84448', -0.26, h + 0.12, -l * 0.04),
    box(w * 0.52, 0.12, 0.34, '#3179c4', 0.26, h + 0.12, -l * 0.04),
    box(w * 0.6, 0.04, 0.24, '#d8d2c0', 0, h + 0.2, -l * 0.04),
  ];
}

const BODIES = {
  sedan: sedanParts,
  coupe: coupeParts,
  van: vanParts,
  pickup: pickupParts,
  sports: sportsParts,
  police: policeParts,
};

function lightParts(spec, mode) {
  const { length: l, width: w, height: h } = spec;
  const color = mode === 'head' ? HEADLIGHT : mode === 'brake' ? BRAKE : TAILLIGHT;
  const y = mode === 'head' ? 0.5 + h * 0.2 : 0.5 + h * 0.24;
  const z = mode === 'head' ? l / 2 + 0.02 : -l / 2 - 0.02;
  return [
    box(w * 0.24, 0.14, 0.08, color, -w * 0.31, y, z),
    box(w * 0.24, 0.14, 0.08, color, w * 0.31, y, z),
  ];
}

export class Vehicle {
  constructor(scene, city, specId = 'sedan', opts = {}) {
    this.city = city;
    this.specId = BODIES[specId] ? specId : 'sedan';
    this.spec = VEHICLE[this.specId];
    this.position = new THREE.Vector3(opts.x ?? 0, city.groundY(opts.x ?? 0, opts.z ?? 0), opts.z ?? 0);
    this.heading = opts.heading ?? 0;
    this.speed = opts.speed ?? 0;
    this.lateral = 0;
    this.health = 100;
    this.occupants = [];
    this.driver = null;
    this.capacity = this.specId === 'van' ? 3 : 4;
    this.braking = false;
    this.smoke = 0;

    const color = opts.color ?? this.spec.color;
    this.object3D = new THREE.Group();
    this.object3D.name = `${this.spec.name} ${opts.label ?? ''}`.trim();
    this.body = new THREE.Mesh(
      mergeParts([...BODIES[this.specId](this.spec, color), ...wheelParts(this.spec)]),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    this.object3D.add(this.body);

    this.headlights = new THREE.Mesh(
      mergeParts(lightParts(this.spec, 'head')),
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
    );
    this.taillights = new THREE.Mesh(
      mergeParts(lightParts(this.spec, 'tail')),
      new THREE.MeshBasicMaterial({ vertexColors: true }),
    );
    this.brakeLights = new THREE.Mesh(
      mergeParts(lightParts(this.spec, 'brake')),
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
    );
    this.brakeLights.visible = false;
    this.headlights.visible = false;
    this.object3D.add(this.headlights, this.taillights, this.brakeLights);

    if (this.specId === 'police') {
      const badge = new THREE.Mesh(
        new THREE.PlaneGeometry(this.spec.width * 0.42, 0.34),
        new THREE.MeshBasicMaterial({ map: textTexture('PVD', { bg: '#285a86', color: '#fff3d4', size: 130 }), side: THREE.DoubleSide }),
      );
      badge.position.set(0, 0.55 + this.spec.height * 0.24, this.spec.length * 0.5 + 0.05);
      this.object3D.add(badge);
    }

    this.shadow = new THREE.Mesh(
      makeBox(this.spec.width * 1.16, 0.02, this.spec.length * 1.06, '#1c1b1c'),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    this.shadow.position.y = 0.025;
    this.object3D.add(this.shadow);

    scene.add(this.object3D);
    this._desired = new THREE.Vector3();
    this._focus = new THREE.Vector3();
    this.applyTransform();
  }

  get speedKmh() {
    return Math.abs(this.speed) * 3.6;
  }

  setPose(x, z, heading = this.heading, speed = 0) {
    this.position.set(x, this.city.groundY(x, z), z);
    this.heading = heading;
    this.speed = speed;
    this.lateral = 0;
    this.applyTransform();
  }

  enter(driver = null) {
    if (this.occupants.length >= this.capacity) return false;
    if (driver) this.occupants.push(driver);
    this.driver = driver ?? this.driver;
    return true;
  }

  exit(driver = null) {
    const index = driver ? this.occupants.indexOf(driver) : this.occupants.length - 1;
    const leaving = index >= 0 ? this.occupants.splice(index, 1)[0] : driver;
    if (this.driver === leaving) this.driver = null;
    return leaving;
  }

  setDriver(driver) {
    if (driver) {
      this.occupants.length = 0;
      this.enter(driver);
    } else {
      this.exit(this.driver);
    }
  }

  setNight(on) {
    this.headlights.visible = on;
    this.brakeLights.visible = on && this.braking;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    this.smoke = this.health < 35 ? 1 : 0;
    return this.health;
  }

  update(dt, controls = {}, city = this.city) {
    const spec = this.spec;
    const throttle = clamp(controls.throttle ?? 0, -1, 1);
    const steer = clamp(controls.steer ?? 0, -1, 1);
    const handbrake = Boolean(controls.handbrake);
    this.braking = Boolean(controls.brake) || handbrake || throttle * this.speed < -0.1;

    if (throttle) {
      const power = spec.accel * (throttle * this.speed < 0 ? 1.5 : 1);
      this.speed += throttle * power * dt;
    } else {
      this.speed = damp(this.speed, 0, 1.1, dt);
    }
    if (this.braking) this.speed = damp(this.speed, 0, handbrake ? 2.4 : 6.5, dt);
    this.speed = clamp(this.speed, -spec.topSpeed * 0.28, spec.topSpeed);

    const traction = handbrake ? spec.grip * 0.18 : spec.grip;
    const motion = clamp(Math.abs(this.speed) / 5, 0, 1);
    this.heading += steer * motion * (handbrake ? 1.9 : 1.35) * Math.sign(this.speed || 1) * dt;
    this.lateral = damp(this.lateral, handbrake ? steer * Math.min(Math.abs(this.speed) * 0.5, 8) : 0, traction, dt);

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const rx = -fz;
    const rz = fx;
    const oldX = this.position.x;
    const oldZ = this.position.z;
    this.position.x += (fx * this.speed + rx * this.lateral) * dt;
    this.position.z += (fz * this.speed + rz * this.lateral) * dt;
    city.collide(this.position, spec.width * 0.43);
    if (Math.hypot(this.position.x - oldX, this.position.z - oldZ) < Math.abs(this.speed) * dt * 0.45) {
      this.speed *= 0.35;
      this.damage(2 * dt);
    }
    this.position.y = city.groundY(this.position.x, this.position.z);
    this.applyTransform();
    this.brakeLights.visible = this.braking;
  }

  applyTransform() {
    this.object3D.position.copy(this.position);
    this.object3D.rotation.y = this.heading;
  }

  updateCamera(dt, camera, look = {}, snap = false) {
    const back = 7.4 + Math.min(Math.abs(this.speed) * 0.11, 3.2);
    const yaw = this.heading + clamp(look.yaw ?? 0, -1.1, 1.1);
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    this._desired.set(
      this.position.x - sy * back,
      this.position.y + 2.7 + Math.min(Math.abs(this.speed) * 0.02, 0.8) + (look.pitch ?? 0) * 3,
      this.position.z - cy * back,
    );
    const floor = this.city.groundY(this._desired.x, this._desired.z) + 0.8;
    if (this._desired.y < floor) this._desired.y = floor;
    if (snap) camera.position.copy(this._desired);
    else {
      camera.position.x = damp(camera.position.x, this._desired.x, 7, dt);
      camera.position.y = damp(camera.position.y, this._desired.y, 7, dt);
      camera.position.z = damp(camera.position.z, this._desired.z, 7, dt);
    }
    this._focus.set(this.position.x, this.position.y + 0.8 + this.spec.height * 0.45, this.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(this._focus);
  }
}
