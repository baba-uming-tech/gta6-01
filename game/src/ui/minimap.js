import { WORLD } from '../config.js';

const SIZE = 168;
const HALF = SIZE / 2;
const RADIUS = 80;
const TAU = Math.PI * 2;
const VIEW_METRES = 105;
const BLOCK = WORLD.block;
const ROAD = WORLD.road;
const HALF_ROAD = ROAD / 2;
const ORIGIN_X = -BLOCK * WORLD.grid / 2;
const ORIGIN_Z = -BLOCK * (WORLD.grid - 1) / 2;

export class Minimap {
  constructor(canvas, city) {
    this.canvas = canvas;
    this.city = city;
    this.ctx = canvas.getContext('2d');
    this.scale = RADIUS / VIEW_METRES;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SIZE * dpr);
    canvas.height = Math.round(SIZE * dpr);
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._vignette = this.ctx.createRadialGradient(HALF, HALF, RADIUS * 0.6, HALF, HALF, RADIUS);
    this._vignette.addColorStop(0, 'rgba(12,20,28,0)');
    this._vignette.addColorStop(1, 'rgba(12,20,28,0.45)');
  }

  draw(player, blips) {
    const ctx = this.ctx;
    const s = this.scale;
    const px = player?.position?.x ?? 0;
    const pz = player?.position?.z ?? 0;
    const heading = player?.inVehicle && player?.vehicle ? player.vehicle.heading : (player?.yaw ?? 0);
    const pulse = Math.sin(performance.now() * 0.005);
    const mapX = (x) => HALF + (x - px) * s;
    const mapY = (z) => HALF + (z - pz) * s;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(HALF, HALF, RADIUS, 0, TAU);
    ctx.clip();

    ctx.fillStyle = '#d6c49c';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const beachY = mapY(272);
    const waterY = mapY(300);
    ctx.fillStyle = '#e6d3a8';
    ctx.fillRect(0, beachY, SIZE, SIZE - beachY);
    ctx.fillStyle = '#1d7f8c';
    ctx.fillRect(0, waterY, SIZE, SIZE - waterY);
    ctx.strokeStyle = 'rgba(180,240,238,0.42)';
    ctx.lineWidth = 1;
    for (let z = 304; z < 420; z += 11) {
      const y = mapY(z);
      if (y < 0 || y > SIZE) continue;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y + 2);
      ctx.stroke();
    }
    for (const pierX of [150, 190, 230]) {
      const x = mapX(pierX);
      ctx.fillStyle = '#8b6a43';
      ctx.fillRect(x - 4 * s, mapY(270), 8 * s, 74 * s);
    }

    const firstI = Math.floor((px - VIEW_METRES - ORIGIN_X) / BLOCK);
    const lastI = Math.ceil((px + VIEW_METRES - ORIGIN_X) / BLOCK);
    const firstJ = Math.floor((pz - VIEW_METRES - ORIGIN_Z) / BLOCK);
    const lastJ = Math.ceil((pz + VIEW_METRES - ORIGIN_Z) / BLOCK);

    for (let i = firstI; i <= lastI; i += 1) {
      for (let j = firstJ; j <= lastJ; j += 1) {
        const x0 = ORIGIN_X + i * BLOCK + HALF_ROAD;
        const z0 = ORIGIN_Z + j * BLOCK + HALF_ROAD;
        if (z0 > 268) continue;
        const size = BLOCK - ROAD;
        const bx = mapX(x0);
        const by = mapY(z0);
        const bw = size * s;
        const bh = size * s;
        if (bx > SIZE || by > SIZE || bx + bw < 0 || by + bh < 0) continue;
        ctx.fillStyle = (Math.abs(i * 7 + j * 13) & 1) ? '#e7d8b8' : '#e2d0ac';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = 'rgba(96,74,52,0.28)';
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.fillStyle = '#c4ad86';
        const split = Math.abs(i * 37 + j * 91) % 5;
        if (split < 3) {
          ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
        } else {
          ctx.fillRect(bx + 3, by + 3, (bw - 7) / 2, bh - 6);
          ctx.fillRect(bx + (bw + 1) / 2, by + 3, (bw - 7) / 2, bh - 6);
        }
      }
    }

    ctx.fillStyle = '#3b3f45';
    for (let i = firstI; i <= lastI; i += 1) {
      const x = mapX(ORIGIN_X + i * BLOCK);
      ctx.fillRect(x - HALF_ROAD * s, 0, ROAD * s, SIZE);
    }
    for (let j = firstJ; j <= lastJ; j += 1) {
      const y = mapY(ORIGIN_Z + j * BLOCK);
      ctx.fillRect(0, y - HALF_ROAD * s, SIZE, ROAD * s);
    }
    ctx.strokeStyle = 'rgba(255,226,160,0.72)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    for (let i = firstI; i <= lastI; i += 1) {
      const x = mapX(ORIGIN_X + i * BLOCK);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SIZE);
      ctx.stroke();
    }
    for (let j = firstJ; j <= lastJ; j += 1) {
      const y = mapY(ORIGIN_Z + j * BLOCK);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.save();
    ctx.fillStyle = '#fff3d4';
    ctx.shadowColor = '#14202a';
    ctx.shadowBlur = 4;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', HALF, 15);
    ctx.restore();

    if (blips) {
      for (let i = 0; i < blips.length; i += 1) {
        const blip = blips[i];
        if (!blip) continue;
        const bx = mapX(blip.x);
        const by = mapY(blip.z);
        const dx = bx - HALF;
        const dy = by - HALF;
        const distance = Math.hypot(dx, dy);
        const clamped = distance > RADIUS - 9;
        const k = clamped ? (RADIUS - 9) / (distance || 1) : 1;
        this._drawBlip(blip.kind, HALF + dx * k, HALF + dy * k, pulse, clamped);
      }
    }

    ctx.save();
    ctx.translate(HALF, HALF);
    ctx.rotate(Math.PI - heading);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6.5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6.5);
    ctx.closePath();
    ctx.fillStyle = '#fff8e8';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#10202b';
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = this._vignette;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(HALF, HALF, RADIUS, 0, TAU);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(18,27,34,0.92)';
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,227,175,0.85)';
    ctx.stroke();
  }

  _drawBlip(kind, x, y, pulse, clamped) {
    const ctx = this.ctx;
    if (kind === 'mission') {
      if (!clamped) {
        ctx.beginPath();
        ctx.arc(x, y, 8 + pulse * 2, 0, TAU);
        ctx.strokeStyle = `rgba(255,214,91,${0.35 + pulse * 0.2})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd65b';
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#3a2b14';
      ctx.strokeRect(-4.5, -4.5, 9, 9);
      ctx.restore();
      return;
    }
    if (kind === 'garage') {
      ctx.fillStyle = '#3a8dff';
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#eaf4ff';
      ctx.strokeRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', x, y + 0.5);
      ctx.textBaseline = 'alphabetic';
      return;
    }
    if (kind === 'hospital') {
      ctx.fillStyle = '#f5f0e6';
      ctx.fillRect(x - 4.5, y - 1.5, 9, 3);
      ctx.fillRect(x - 1.5, y - 4.5, 3, 9);
      ctx.strokeStyle = '#204f45';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x - 4.5, y - 1.5, 9, 3);
      ctx.strokeRect(x - 1.5, y - 4.5, 3, 9);
      return;
    }
    const radius = kind === 'air' ? 4 : 5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fillStyle = '#e84440';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#fff3d4';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, TAU);
    ctx.fillStyle = '#fff3d4';
    ctx.fill();
  }
}
