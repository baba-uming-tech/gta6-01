// The clock drives every visual here: dome colours, the sun and its glow, haze and lighting all shift on a bold sunset scale.
// City lamps follow the dark/light switch exposed as scene.userData.onNightChange and wired up by the game.

import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/rng.js';
import { NIGHT } from '../config.js';

const HOURS = [0, 5, 6.5, 9, 12, 16, 17.5, 19, 20.5, 24];
const KEYS = [
  { top: '#0a1230', horizon: '#2b2748', sun: '#8fa8d8', fog: '#121a30', hemiSky: '#2b3a63', hemiGround: '#191822' },
  { top: '#152548', horizon: '#7c4a60', sun: '#d9846a', fog: '#3a3150', hemiSky: '#4e5884', hemiGround: '#241f2b' },
  { top: '#3a6c9c', horizon: '#ff9448', sun: '#ff9440', fog: '#b9704e', hemiSky: '#ffcf9a', hemiGround: '#3a2e2a' },
  { top: '#4f9fd6', horizon: '#cfe4e0', sun: '#fff3d2', fog: '#a9c6c7', hemiSky: '#dcefff', hemiGround: '#6b6250' },
  { top: '#3f9cdb', horizon: '#dfeae0', sun: '#fffbe8', fog: '#b6d2cd', hemiSky: '#e4f4ff', hemiGround: '#76694f' },
  { top: '#3a86c4', horizon: '#ffbe62', sun: '#ffb45c', fog: '#d2924f', hemiSky: '#ffdfae', hemiGround: '#5f4f3c' },
  { top: '#2a5a98', horizon: '#ff7526', sun: '#ff8828', fog: '#b85934', hemiSky: '#ffab60', hemiGround: '#3f342c' },
  { top: '#1d3768', horizon: '#dc4c28', sun: '#e85a24', fog: '#713434', hemiSky: '#a2656c', hemiGround: '#2b2330' },
  { top: '#101e3e', horizon: '#5b3a5e', sun: '#7a5590', fog: '#332a44', hemiSky: '#5b5f8e', hemiGround: '#221d28' },
  { top: '#0a1230', horizon: '#2b2748', sun: '#8fa8d8', fog: '#121a30', hemiSky: '#2b3a63', hemiGround: '#191822' },
];

const SCRATCH_COLOR = new THREE.Color();
const SCRATCH_NEXT = new THREE.Color();

function keyframe(hour) {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < HOURS.length - 2 && h > HOURS[i + 1]) i += 1;
  const t = clamp((h - HOURS[i]) / (HOURS[i + 1] - HOURS[i]), 0, 1);
  return { a: KEYS[i], b: KEYS[i + 1], t };
}

function mix(target, a, b, t) {
  SCRATCH_COLOR.set(a);
  SCRATCH_NEXT.set(b);
  return target.copy(SCRATCH_COLOR).lerp(SCRATCH_NEXT, t);
}

export class SkySystem {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.hour = 17.2;
    this.auto = true;
    this.isNight = false;
    this.sunDirection = new THREE.Vector3();
    this.topColor = new THREE.Color();
    this.horizonColor = new THREE.Color();
    this.fogColor = new THREE.Color();
    this._paintedHour = -1;
    this._sunColor = new THREE.Color();

    const geometry = new THREE.SphereGeometry(2600, 24, 16);
    this._heights = new Float32Array(geometry.attributes.position.count);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      this._heights[i] = clamp(position.getY(i) / 1600 + 0.35, 0, 1);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(position.count * 3), 3));
    this.sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    this.sky.renderOrder = -1000;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    this.ambient = new THREE.HemisphereLight(0xffe6bd, 0x6d5847, 1.5);
    scene.add(this.ambient);
    this.fill = new THREE.AmbientLight(0xcdd9ff, 0);
    scene.add(this.fill);
    this.sunLight = new THREE.DirectionalLight(0xffd08a, 2.1);
    scene.add(this.sunLight);
    this.sunOrb = new THREE.Mesh(
      new THREE.SphereGeometry(88, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xffd08a, fog: false, depthWrite: false }),
    );
    this.sunOrb.renderOrder = -900;
    scene.add(this.sunOrb);
    this.sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(180, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.30, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.sunHalo.renderOrder = -950;
    scene.add(this.sunHalo);
    this.moonOrb = new THREE.Mesh(
      new THREE.SphereGeometry(34, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xe8e6d4, fog: false, depthWrite: false }),
    );
    this.moonOrb.renderOrder = -900;
    scene.add(this.moonOrb);

    this.setHour(this.hour);
  }

  setHour(hour) {
    this.hour = ((hour % 24) + 24) % 24;
    const { a, b, t } = keyframe(this.hour);
    const angle = ((this.hour - 6) / 12) * Math.PI;
    this.sunDirection.set(Math.cos(angle), Math.sin(angle), -0.38).normalize();
    const daylight = smoothstep(-0.12, 0.24, this.sunDirection.y);
    const golden = 1 - smoothstep(0.08, 0.5, this.sunDirection.y);
    const night = 1 - smoothstep(-0.1, 0.08, this.sunDirection.y);
    const wasNight = this.isNight;
    this.isNight = night > 0.5;

    mix(this.topColor, a.top, b.top, t);
    mix(this.horizonColor, a.horizon, b.horizon, t);
    mix(this.fogColor, a.fog, b.fog, t);
    this.fogColor.lerp(this.horizonColor, 0.28);
    mix(this._sunColor, a.sun, b.sun, t);

    this.sunLight.position.copy(this.sunDirection).multiplyScalar(500);
    this.sunLight.color.copy(this._sunColor);
    this.sunLight.intensity = lerp(0.55, 2.75, daylight);
    this.ambient.color.set(a.hemiSky).lerp(SCRATCH_NEXT.set(b.hemiSky), t);
    this.ambient.groundColor.set(a.hemiGround).lerp(SCRATCH_NEXT.set(b.hemiGround), t);
    this.ambient.intensity = lerp(2.3, 1.25, daylight);
    this.fill.intensity = night * NIGHT.ambient;
    this.sunOrb.material.color.copy(this._sunColor);
    this.sunOrb.visible = this.sunDirection.y > -0.12;
    this.sunHalo.visible = this.sunOrb.visible;
    this.moonOrb.visible = night > 0.15;

    if (this.scene.fog) {
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.near = lerp(70, 230, daylight);
      this.scene.fog.far = lerp(520, 1350, daylight);
    }
    if (this.renderer?.renderer) this.renderer.renderer.setClearColor(this.horizonColor, 1);

    if (Math.abs(this.hour - this._paintedHour) > 0.012) {
      this._paintSky();
      this._paintedHour = this.hour;
    }
    const onNightChange = this.scene.userData.onNightChange;
    if (onNightChange && wasNight !== this.isNight) onNightChange(this.isNight);
  }

  _paintSky() {
    const color = this.sky.geometry.attributes.color;
    const top = this.topColor;
    const horizon = this.horizonColor;
    for (let i = 0; i < this._heights.length; i += 1) {
      const t = Math.pow(this._heights[i], 0.8);
      SCRATCH_COLOR.copy(horizon).lerp(top, t);
      color.setXYZ(i, SCRATCH_COLOR.r, SCRATCH_COLOR.g, SCRATCH_COLOR.b);
    }
    color.needsUpdate = true;
  }

  setNight(on) {
    if (on === this.isNight) return;
    this.setHour(on ? (this.hour > 5.5 && this.hour < 18.5 ? 22 : this.hour) : (this.hour > 18.5 || this.hour < 5.5 ? 12 : this.hour));
  }

  update(dt, camera) {
    if (this.auto) this.setHour(this.hour + dt / 30);
    if (camera) {
      this.sky.position.copy(camera.position);
      this.sunOrb.position.copy(camera.position).addScaledVector(this.sunDirection, 1800);
      this.sunHalo.position.copy(this.sunOrb.position);
      this.moonOrb.position.copy(camera.position).addScaledVector(this.sunDirection, -1700);
    }
  }
}
