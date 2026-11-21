// Day-night cycle: paints the sky dome, sun, fog and lights from the hour of day. Night lights
// in the city are toggled through scene.userData.onNightChange by the game wiring.

import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/rng.js';
import { NIGHT } from '../config.js';

const HOURS = [0, 5, 6.5, 9, 12, 16, 17.5, 19, 20.5, 24];
const KEYS = [
  { top: '#14284f', horizon: '#4b3d64', sun: '#a8bde2', fog: '#2b3656', hemiSky: '#8599c6', hemiGround: '#56515e' },
  { top: '#1e3358', horizon: '#77546f', sun: '#d78a6e', fog: '#554761', hemiSky: '#6a7195', hemiGround: '#3b3340' },
  { top: '#5f88b2', horizon: '#f0aa72', sun: '#ffb068', fog: '#e8a57f', hemiSky: '#ffd6aa', hemiGround: '#6b5d55' },
  { top: '#7fc4e8', horizon: '#d9e8df', sun: '#fff1ce', fog: '#c9dedb', hemiSky: '#e8f4ff', hemiGround: '#807768' },
  { top: '#7fc4e8', horizon: '#e8f0dc', sun: '#fff5d8', fog: '#d6e6d5', hemiSky: '#eaf6ff', hemiGround: '#8c806c' },
  { top: '#74b6d8', horizon: '#ffd9a0', sun: '#ffd08a', fog: '#e8c89b', hemiSky: '#ffe6bd', hemiGround: '#7d6c58' },
  { top: '#6899c0', horizon: '#ffb567', sun: '#ff9d4f', fog: '#eda675', hemiSky: '#ffd3a0', hemiGround: '#6d5847' },
  { top: '#33446e', horizon: '#e76f50', sun: '#f27044', fog: '#9a5d5a', hemiSky: '#c38e8b', hemiGround: '#4a3b46' },
  { top: '#1a2c52', horizon: '#7d4d67', sun: '#9a6aa2', fog: '#55465f', hemiSky: '#8f94bd', hemiGround: '#554a56' },
  { top: '#14284f', horizon: '#4b3d64', sun: '#a8bde2', fog: '#2b3656', hemiSky: '#8599c6', hemiGround: '#56515e' },
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
      new THREE.SphereGeometry(52, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffd08a, fog: false, depthWrite: false }),
    );
    this.sunOrb.renderOrder = -900;
    scene.add(this.sunOrb);
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
    this.sunLight.intensity = lerp(0.45, 2.2, daylight) * lerp(1, 0.88, golden * (1 - night));
    this.ambient.color.set(a.hemiSky).lerp(SCRATCH_NEXT.set(b.hemiSky), t);
    this.ambient.groundColor.set(a.hemiGround).lerp(SCRATCH_NEXT.set(b.hemiGround), t);
    this.ambient.intensity = lerp(2.4, 1.55, daylight);
    this.fill.intensity = night * NIGHT.ambient;
    this.sunOrb.material.color.copy(this._sunColor);
    this.sunOrb.visible = this.sunDirection.y > -0.12;
    this.moonOrb.visible = night > 0.15;

    if (this.scene.fog) {
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.near = lerp(90, 260, daylight);
      this.scene.fog.far = lerp(720, 1500, daylight);
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
      this.moonOrb.position.copy(camera.position).addScaledVector(this.sunDirection, -1700);
    }
  }
}
