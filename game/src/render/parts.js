// Small geometry primitives and procedural textures. Every car, character and prop is assembled
// from these parts and merged into one vertex-coloured geometry so it costs a single draw call.

import * as THREE from 'three';
import { makeRng } from '../core/rng.js';

function withVertexColor(geometry, color) {
  const tint = new THREE.Color(color);
  const count = geometry.attributes.position.count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    data[i * 3] = tint.r;
    data[i * 3 + 1] = tint.g;
    data[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return geometry;
}

export function makeBox(w, h, d, color) {
  return withVertexColor(new THREE.BoxGeometry(w, h, d), color);
}

export function makeCylinder(rTop, rBot, h, seg, color) {
  return withVertexColor(new THREE.CylinderGeometry(rTop, rBot, h, seg), color);
}

// Each entry is either a geometry or { geometry, position, rotation, scale }. Transforms are baked
// into the vertices, so the result has no children and can be drawn with one material.
export function mergeParts(list) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const matrix = new THREE.Matrix4();
  const offset = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const rotation = new THREE.Euler();
  const size = new THREE.Vector3();

  for (const item of list) {
    const source = item.geometry ?? item;
    const transformed = item !== source;
    const geometry = source.index ? source.toNonIndexed() : transformed ? source.clone() : source;
    if (transformed) {
      rotation.set(item.rotation?.[0] ?? 0, item.rotation?.[1] ?? 0, item.rotation?.[2] ?? 0);
      quaternion.setFromEuler(rotation);
      offset.set(item.position?.[0] ?? 0, item.position?.[1] ?? 0, item.position?.[2] ?? 0);
      size.set(item.scale?.[0] ?? 1, item.scale?.[1] ?? 1, item.scale?.[2] ?? 1);
      matrix.compose(offset, quaternion, size);
      geometry.applyMatrix4(matrix);
    }
    const pos = geometry.attributes.position;
    const nor = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    const col = geometry.attributes.color;
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0);
      uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      colors.push(col ? col.getX(i) : 1, col ? col.getY(i) : 1, col ? col.getZ(i) : 1);
    }
    if (geometry !== source) geometry.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}

export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function facadeTexture(kind, night = false) {
  const rnd = makeRng(kind.length * 7919 + (night ? 331 : 17));
  const isGlass = kind === 'tower';
  const isShop = kind === 'shop' || kind === 'lowrise';
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = night
      ? (isGlass ? '#223c4e' : '#3b3340')
      : isGlass ? '#8fb7c9' : isShop ? '#e8b06a' : '#f2e2c9';
    ctx.fillRect(0, 0, w, h);
    const rows = isGlass ? 10 : isShop ? 5 : 7;
    const cols = isGlass ? 6 : 4;
    const cellW = w / (cols + 1);
    const cellH = h / (rows + 1);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = cellW * (col + 0.5);
        const y = cellH * (row + 0.7);
        const lit = rnd() < (night ? 0.68 : isGlass ? 0.22 : 0.3);
        ctx.fillStyle = lit
          ? (night ? '#ffdf95' : isGlass ? '#ffe2a6' : '#3a4a57')
          : night ? '#182634' : isGlass ? '#4e7386' : '#3a4a57';
        if (!night && !isGlass && !lit) ctx.fillStyle = '#3a4a57';
        ctx.fillRect(x, y, cellW * 0.66, cellH * 0.5);
        if (!isGlass) {
          ctx.fillStyle = night ? '#1b202a' : '#f5f0e6';
          ctx.fillRect(x - 1, y + cellH * 0.5, cellW * 0.72, 2);
        }
      }
    }
    if (isShop) {
      ctx.fillStyle = night ? '#7d2e4b' : '#b6403f';
      ctx.fillRect(0, h - cellH * 0.8, w, cellH * 0.24);
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = i % 2 ? '#f5f0e6' : '#d8a13c';
        ctx.fillRect(i * (w / 5), h - cellH * 0.6, w / 5, cellH * 0.14);
      }
    }
  });
}

export function textTexture(text, opts = {}) {
  const width = opts.width ?? 512;
  const height = opts.height ?? 256;
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = opts.bg ?? '#1d2b3a';
    ctx.fillRect(0, 0, w, h);
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, w - 12, h - 12);
    }
    ctx.font = `800 ${opts.size ?? 64}px system-ui, sans-serif`;
    ctx.fillStyle = opts.color ?? '#fff3d4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2, w - 28);
  });
}
