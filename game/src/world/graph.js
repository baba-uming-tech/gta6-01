import * as THREE from 'three';
import { WORLD } from '../config.js';
import { clamp } from '../core/rng.js';

export class RoadGraph {
  constructor(options = {}) {
    this.block = options.block ?? WORLD.block;
    this.cols = options.cols ?? WORLD.grid;
    this.rows = options.rows ?? WORLD.grid - 1;
    this.originX = options.originX ?? -this.block * this.cols / 2;
    this.originZ = options.originZ ?? -this.block * this.rows / 2;
    this.laneOffset = options.laneOffset ?? 2.7;
    this.groundY = options.groundY ?? (() => 0);

    this.nodes = [];
    this.edges = [];
    this.adjacency = [];
    this._buildGrid();
  }

  _buildGrid() {
    for (let j = 0; j <= this.rows; j += 1) {
      for (let i = 0; i <= this.cols; i += 1) {
        const x = this.originX + i * this.block;
        const z = this.originZ + j * this.block;
        const index = this.nodes.length;
        this.nodes.push({ index, i, j, x, y: this.groundY(x, z), z });
        this.adjacency.push([]);
      }
    }
    for (let j = 0; j <= this.rows; j += 1) {
      for (let i = 0; i <= this.cols; i += 1) {
        if (i < this.cols) this._connect(this.index(i, j), this.index(i + 1, j));
        if (j < this.rows) this._connect(this.index(i, j), this.index(i, j + 1));
      }
    }
  }

  index(i, j) {
    return j * (this.cols + 1) + i;
  }

  _connect(a, b) {
    const na = this.nodes[a];
    const nb = this.nodes[b];
    const edge = {
      index: this.edges.length,
      a,
      b,
      length: Math.hypot(nb.x - na.x, nb.z - na.z),
    };
    this.edges.push(edge);
    this.adjacency[a].push(edge);
    this.adjacency[b].push(edge);
  }

  nearest(x, z) {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < this.nodes.length; i += 1) {
      const node = this.nodes[i];
      const distance = (node.x - x) ** 2 + (node.z - z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  path(a, b) {
    if (a === b) return [a];
    const count = this.nodes.length;
    if (a < 0 || b < 0 || a >= count || b >= count) return [];
    const distance = new Float64Array(count);
    const previous = new Int32Array(count);
    const visited = new Uint8Array(count);
    distance.fill(Infinity);
    previous.fill(-1);
    distance[a] = 0;

    for (let step = 0; step < count; step += 1) {
      let current = -1;
      let shortest = Infinity;
      for (let i = 0; i < count; i += 1) {
        if (!visited[i] && distance[i] < shortest) {
          shortest = distance[i];
          current = i;
        }
      }
      if (current === -1 || current === b) break;
      visited[current] = 1;
      for (const edge of this.adjacency[current]) {
        const next = edge.a === current ? edge.b : edge.a;
        const candidate = shortest + edge.length;
        if (candidate < distance[next]) {
          distance[next] = candidate;
          previous[next] = current;
        }
      }
    }

    if (previous[b] === -1) return [];
    const route = [];
    let cursor = b;
    while (cursor !== -1) {
      route.push(cursor);
      if (cursor === a) break;
      cursor = previous[cursor];
    }
    return route.reverse();
  }

  lanePoint(n0, n1, t, out = new THREE.Vector3()) {
    const a = this.nodes[n0];
    const b = this.nodes[n1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz) || 1;
    const step = clamp(t, 0, 1);
    out.set(
      a.x + dx * step - (dz / length) * this.laneOffset,
      a.y + (b.y - a.y) * step + 0.12,
      a.z + dz * step + (dx / length) * this.laneOffset,
    );
    return out;
  }
}
