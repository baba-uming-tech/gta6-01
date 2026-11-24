// Every tuning number, colour and control binding for VELAMAR lives here.
// Distances are metres; one city block is 40 m with a 12 m road and 3 m sidewalks on each side.

export const WORLD = { block: 40, road: 12, sidewalk: 3, grid: 14 };

export const PALETTE = {
  skyTop: '#7fc4e8',
  skyHorizon: '#ffd9a0',
  sun: '#ffd9a0',
  haze: '#e8c89b',
  asphalt: '#545a63',
  kerb: '#c9c2b2',
  stucco: ['#f2e2c9', '#e8b06a', '#f5f0e6'],
  glass: '#8fb7c9',
  foliage: '#2f6b3f',
  sand: '#e6d3a8',
  water: '#1d7f8c',
  neon: ['#ff4f7a', '#37e0d6'],
  ground: '#d6c09a',
  white: '#fff6e2',
  black: '#181b20',
};

export const QUALITY = {
  low: { pixelRatio: 0.75, label: 'low' },
  mid: { pixelRatio: 1, label: 'mid' },
  high: { pixelRatio: 1.5, label: 'high' },
};

export const NIGHT = {
  ambient: 0.62,
  lampGlowOpacity: 0.95,
  lampPoolOpacity: 0.82,
  signGlowOpacity: 0.3,
};

export const KEYBINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  sprint: 'ShiftLeft', jump: 'Space', handbrake: 'ShiftLeft',
  enter: 'KeyE', fire: 'Mouse0', aim: 'Mouse2', reload: 'KeyR',
  weapon1: 'Digit1', weapon2: 'Digit2', weapon3: 'Digit3',
  camera: 'KeyC', map: 'KeyM', pause: 'Escape',
  save: 'F5', load: 'F9', confirm: 'Enter', raiseWanted: 'KeyK',
};

export const DISTRICT = [
  { id: 'costanera', name: 'Costanera', x: -3, z: 4, color: '#e6d3a8' },
  { id: 'centro', name: 'Centro', x: 2, z: -2, color: '#8fb7c9' },
  { id: 'mercado', name: 'Mercado', x: -3, z: -3, color: '#e8b06a' },
  { id: 'muelle', name: 'Muelle', x: 4, z: 4, color: '#1d7f8c' },
  { id: 'cerroalto', name: 'Cerro Alto', x: 5, z: -5, color: '#2f6b3f' },
];

export const VEHICLE = {
  sedan: { name: 'Sedan', length: 4.5, width: 1.9, height: 1.45, mass: 1.2, topSpeed: 34, accel: 12, grip: 7.5, color: '#b8493f' },
  coupe: { name: 'Coupe', length: 4.4, width: 1.9, height: 1.28, mass: 1, topSpeed: 46, accel: 16, grip: 8.5, color: '#d8a13c' },
  van: { name: 'Van', length: 5.4, width: 2.1, height: 2.2, mass: 1.8, topSpeed: 28, accel: 9, grip: 6.5, color: '#d8d2c0' },
  pickup: { name: 'Pickup', length: 5.3, width: 2.05, height: 1.9, mass: 1.6, topSpeed: 33, accel: 11, grip: 7, color: '#4d7f6d' },
  sports: { name: 'Sports', length: 4.3, width: 2, height: 1.15, mass: 0.9, topSpeed: 54, accel: 19, grip: 9.5, color: '#c4436b' },
  police: { name: 'PVD Cruiser', length: 4.8, width: 2, height: 1.5, mass: 1.35, topSpeed: 40, accel: 14, grip: 8, color: '#e8edf2' },
};
