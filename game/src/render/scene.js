// Owns the three.js scene, camera, renderer and the frame statistics, filmic tone mapped for a high-contrast golden hour.
// No shadows and no post-processing: the whole game is drawn with Lambert/Basic materials and merged geometry.

import * as THREE from 'three';
import { PALETTE, QUALITY } from '../config.js';

export class Renderer {
  constructor(host) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(PALETTE.haze, 260, 1500);
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 6000);
    this.camera.position.set(0, 12, 26);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(PALETTE.skyHorizon, 1);
    if (host) host.appendChild(this.renderer.domElement);

    this._projectPoint = new THREE.Vector3();
    this.stats = { fps: 0, drawCalls: 0, triangles: 0, frames: 0 };
    this.quality = 'mid';
    this._lastTime = 0;

    this._buildGround();

    this.setQuality('mid');
    window.addEventListener('resize', () => this.resize());
  }

  _buildGround() {
    const material = new THREE.MeshLambertMaterial({ color: PALETTE.ground });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), material);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.08;
    this.scene.add(this.ground);
  }

  setQuality(name) {
    const preset = QUALITY[name] ?? QUALITY.mid;
    this.quality = QUALITY[name] ? name : 'mid';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
    this.resize();
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  framePoint(worldX, worldY, worldZ) {
    this.camera.updateMatrixWorld();
    const point = this._projectPoint.set(worldX, worldY, worldZ).project(this.camera);
    const x = (point.x + 1) * 0.5;
    const y = (1 - point.y) * 0.5;
    return { x, y, onScreen: x >= 0 && x <= 1 && y >= 0 && y <= 1 && point.z >= -1 && point.z <= 1 };
  }

  render() {
    const now = performance.now();
    if (this._lastTime) {
      const elapsed = (now - this._lastTime) / 1000;
      if (elapsed > 0 && elapsed < 1) {
        const instant = 1 / elapsed;
        this.stats.fps = this.stats.fps ? this.stats.fps * 0.9 + instant * 0.1 : instant;
      }
    }
    this._lastTime = now;
    this.renderer.render(this.scene, this.camera);
    this.stats.frames += 1;
    this.stats.drawCalls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
  }
}
