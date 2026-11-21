import { clamp, damp } from './rng.js';

const TAU = Math.PI * 2;

function midiToHz(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

const MENU_CHORDS = [
  [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62],
];
const MENU_ARP = [0, 1, 2, 1, 2, 1, 0, 2];
const DRIVE_BASS = [33, 33, 36, 33, 40, 40, 36, 31];
const DRIVE_LEAD = [69, 72, 76, 72, 74, 72, 69, 67];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.volume = 0.8;
    this.mode = 'off';
    this.time = 0;
    this.noise = null;
    this._last = Object.create(null);
    this._engineSeen = false;
    this._engineRpm = 0;
    this._engineTarget = 0;
    this._engineThrottle = 0;
    this._engineLevel = 0;
    this._sirenOn = false;
    this._sirenPhase = 0;
    this._musicStep = 0;
    this._musicNext = 0;
    this._ambienceOn = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return;
    try {
      this.ctx = new Context();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.0001;
      this.musicBus.connect(this.master);
      this._makeNoise();
      this._makeEngine();
      this._makeAmbience();
      this._makeSiren();
      this._musicNext = this.ctx.currentTime + 0.08;
      if (this.mode !== 'off') this.music(this.mode, true);
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
    }
  }

  _ready() {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setVolume(value) {
    const amount = Number(value);
    this.volume = Number.isFinite(amount) ? clamp(amount, 0, 1) : 0;
    if (!this.master) return;
    try {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    } catch {}
  }

  _makeNoise() {
    const length = Math.floor(this.ctx.sampleRate * 2);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.22 + white * 0.78;
      data[i] = last * 0.8;
    }
    this.noise = buffer;
  }

  _makeEngine() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 5;
    this.engineGain.connect(this.engineFilter);
    this.engineFilter.connect(this.master);

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;
    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'triangle';
    this.engineSub.frequency.value = 30;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    this.engineOsc.connect(this.engineGain);
    this.engineSub.connect(subGain);
    subGain.connect(this.engineGain);
    this.engineOsc.start();
    this.engineSub.start();

    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 900;
    airFilter.Q.value = 0.8;
    this.engineAir = ctx.createGain();
    this.engineAir.gain.value = 0.0001;
    air.connect(airFilter);
    airFilter.connect(this.engineAir);
    this.engineAir.connect(this.master);
    air.start();
  }

  _makeAmbience() {
    const ctx = this.ctx;
    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 480;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0001;
    wind.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    wind.start();

    const city = ctx.createBufferSource();
    city.buffer = this.noise;
    city.loop = true;
    const cityFilter = ctx.createBiquadFilter();
    cityFilter.type = 'bandpass';
    cityFilter.frequency.value = 260;
    cityFilter.Q.value = 0.5;
    this.cityGain = ctx.createGain();
    this.cityGain.gain.value = 0.0001;
    city.connect(cityFilter);
    cityFilter.connect(this.cityGain);
    this.cityGain.connect(this.master);
    city.start();
    this._ambienceOn = true;
  }

  _makeSiren() {
    const ctx = this.ctx;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0.0001;
    this.sirenFilter = ctx.createBiquadFilter();
    this.sirenFilter.type = 'bandpass';
    this.sirenFilter.frequency.value = 900;
    this.sirenFilter.Q.value = 1.2;
    this.sirenFilter.connect(this.sirenGain);
    if (ctx.createStereoPanner) {
      this.sirenPanner = ctx.createStereoPanner();
      this.sirenGain.connect(this.sirenPanner);
      this.sirenPanner.connect(this.master);
    } else {
      this.sirenGain.connect(this.master);
    }
    this.sirenHigh = ctx.createOscillator();
    this.sirenHigh.type = 'sine';
    this.sirenHigh.frequency.value = 940;
    this.sirenLow = ctx.createOscillator();
    this.sirenLow.type = 'sine';
    this.sirenLow.frequency.value = 660;
    this.sirenHighGain = ctx.createGain();
    this.sirenLowGain = ctx.createGain();
    this.sirenHighGain.gain.value = 0.0001;
    this.sirenLowGain.gain.value = 0.0001;
    this.sirenHigh.connect(this.sirenHighGain);
    this.sirenLow.connect(this.sirenLowGain);
    this.sirenHighGain.connect(this.sirenFilter);
    this.sirenLowGain.connect(this.sirenFilter);
    this.sirenHigh.start();
    this.sirenLow.start();
  }

  _tone(freq, at, duration, peak, type = 'sine', bus = null, endFreq = freq) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), at);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(gain);
    gain.connect(bus ?? this.master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  _burst(at, duration, peak, frequency, type = 'bandpass', q = 1, bus = null, endFrequency = frequency) {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(Math.max(20, frequency), at);
    if (endFrequency !== frequency) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, peak), at + Math.min(0.006, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus ?? this.master);
    source.start(at, Math.random() * 1.5);
    source.stop(at + duration + 0.02);
  }

  _allowed(name, gap) {
    if (!this._ready()) return false;
    const now = this.ctx.currentTime;
    if ((this._last[name] ?? -1) + gap > now) return false;
    this._last[name] = now;
    return true;
  }

  sfx(name, opts = {}) {
    if (!this._ready() || !this.noise) return;
    try {
      const at = this.ctx.currentTime + 0.002;
      switch (name) {
        case 'pistol':
          this._burst(at, 0.11, 0.55, 2300, 'highpass', 0.7);
          this._tone(180, at, 0.1, 0.42, 'triangle', null, 58);
          break;
        case 'smg':
          if (!this._allowed('smg', 0.045)) break;
          this._burst(at, 0.07, 0.34, 2900, 'highpass', 0.7);
          this._tone(220, at, 0.06, 0.25, 'triangle', null, 90);
          break;
        case 'shotgun':
          this._burst(at, 0.29, 0.7, 4200, 'lowpass', 0.8, null, 700);
          this._tone(130, at, 0.24, 0.6, 'sawtooth', null, 42);
          break;
        case 'gunshot':
          if (!this._allowed('gunshot', 0.08)) break;
          this._burst(at, 0.1, 0.3, 2000, 'highpass', 0.8);
          this._tone(155, at, 0.09, 0.26, 'triangle', null, 62);
          break;
        case 'footstep':
          if (!this._allowed('footstep', 0.09)) break;
          this._burst(at, 0.055, 0.1 + Math.random() * 0.05, 620 + Math.random() * 260, 'lowpass', 1);
          break;
        case 'land':
          this._burst(at, 0.14, 0.17, 420, 'lowpass', 1);
          this._tone(90, at, 0.1, 0.12, 'sine', null, 45);
          break;
        case 'screech':
          if (!this._allowed('screech', 0.2)) break;
          this._burst(at, 0.34, 0.19, 1500, 'bandpass', 7, null, 2900);
          break;
        case 'horn':
          this._tone(392, at, 0.3, 0.2, 'sawtooth');
          this._tone(294, at, 0.3, 0.17, 'square');
          break;
        case 'siren':
          this.siren(true);
          break;
        case 'sirenOff':
          this.siren(false);
          break;
        case 'pickup':
          this._tone(660, at, 0.1, 0.16, 'triangle');
          this._tone(880, at + 0.08, 0.1, 0.15, 'triangle');
          this._tone(1320, at + 0.16, 0.18, 0.12, 'sine');
          break;
        case 'uiClick':
          if (!this._allowed('uiClick', 0.03)) break;
          this._tone(880, at, 0.035, 0.12, 'square', null, 540);
          break;
        case 'weaponSwitch':
          this._tone(420, at, 0.04, 0.11, 'square', null, 620);
          this._burst(at + 0.04, 0.045, 0.08, 1400, 'bandpass', 2);
          break;
        case 'reload':
          this._burst(at, 0.05, 0.16, 1800, 'bandpass', 3);
          this._burst(at + 0.14, 0.06, 0.14, 1100, 'bandpass', 3);
          this._tone(240, at + 0.26, 0.05, 0.1, 'square', null, 170);
          break;
        case 'hurt':
          if (!this._allowed('hurt', 0.18)) break;
          this._burst(at, 0.16, 0.22, 480, 'lowpass', 1);
          this._tone(180, at, 0.2, 0.16, 'sawtooth', null, 80);
          break;
        case 'death':
          this._tone(320, at, 0.9, 0.24, 'sawtooth', null, 55);
          this._burst(at, 0.6, 0.15, 600, 'lowpass', 1, null, 120);
          break;
        case 'respawn':
          [392, 494, 587, 784].forEach((hz, i) => this._tone(hz, at + i * 0.09, 0.3, 0.13, 'triangle'));
          break;
        case 'missionStart':
          [440, 554, 659].forEach((hz, i) => this._tone(hz, at + i * 0.12, 0.28, 0.15, 'triangle'));
          break;
        case 'missionComplete':
          [523, 659, 784, 1047].forEach((hz, i) => this._tone(hz, at + i * 0.11, 0.42, 0.16, 'triangle'));
          break;
        default:
          break;
      }
    } catch {}
  }

  engine(rpm01, throttle = null) {
    if (!Number.isFinite(rpm01)) return;
    this._engineSeen = true;
    const speed = clamp(rpm01, 0, 1);
    this._engineRpm = speed;
    let gas = throttle;
    if (!Number.isFinite(gas)) {
      gas = speed > this._engineTarget + 0.004 ? 1 : speed < this._engineTarget - 0.004 ? 0 : this._engineThrottle * 0.94;
    }
    this._engineThrottle = clamp(gas, 0, 1);
    this._engineTarget = speed;
  }

  siren(on) {
    this._sirenOn = Boolean(on);
  }

  music(mode, force = false) {
    if (!force && this.mode === mode) return;
    this.mode = mode;
    this._musicStep = 0;
    if (!this._ready()) return;
    try {
      const level = mode === 'menu' ? 0.55 : mode === 'drive' ? 0.5 : 0.0001;
      this.musicBus.gain.setTargetAtTime(level, this.ctx.currentTime, 0.25);
      this._musicNext = this.ctx.currentTime + 0.08;
    } catch {}
  }

  _sirenListener() {
    const game = typeof window === 'undefined' ? null : window.game;
    const player = game?.player;
    if (!player?.position) return null;
    const units = game?.police?.units ?? [];
    let best = null;
    let bestDistance = Infinity;
    for (const unit of units) {
      if (unit.kind !== 'cruiser' && unit.kind !== 'air') continue;
      const dx = unit.position.x - player.position.x;
      const dz = unit.position.z - player.position.z;
      const distance = dx * dx + dz * dz;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = unit;
      }
    }
    if (!best) return null;
    const yaw = Number.isFinite(player.cameraYaw) ? player.cameraYaw : player.yaw ?? 0;
    const dx = best.position.x - player.position.x;
    const dz = best.position.z - player.position.z;
    const lateral = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    return { pan: clamp(lateral / 24, -0.92, 0.92), gain: clamp(1 - Math.sqrt(bestDistance) / 130, 0.16, 1) };
  }

  _updateSiren(dt, now) {
    if (!this.sirenGain) return;
    this._sirenPhase += dt;
    const high = this._sirenPhase % 0.86 < 0.43;
    const level = this._sirenOn ? 0.11 : 0.0001;
    this.sirenHighGain.gain.setTargetAtTime(high ? level : 0.0001, now, 0.035);
    this.sirenLowGain.gain.setTargetAtTime(high ? 0.0001 : level, now, 0.035);
    const listener = this._sirenOn ? this._sirenListener() : null;
    const attenuation = listener ? listener.gain : 0.28;
    this.sirenGain.gain.setTargetAtTime(this._sirenOn ? 0.8 * attenuation : 0.0001, now, 0.12);
    if (this.sirenPanner && listener) this.sirenPanner.pan.setTargetAtTime(listener.pan, now, 0.1);
    this.sirenFilter.frequency.setTargetAtTime(high ? 1050 : 760, now, 0.04);
  }

  _updateEngine(dt, now) {
    if (!this.engineGain) return;
    const target = this._engineSeen ? this._engineRpm : 0;
    this._engineLevel = damp(this._engineLevel, target, 9, dt);
    const rpm = this._engineLevel;
    const hz = 52 + rpm * 185 + this._engineThrottle * 26;
    this.engineOsc.frequency.setTargetAtTime(hz, now, 0.045);
    this.engineSub.frequency.setTargetAtTime(hz * 0.5, now, 0.05);
    this.engineFilter.frequency.setTargetAtTime(320 + rpm * 1500 + this._engineThrottle * 700, now, 0.07);
    this.engineGain.gain.setTargetAtTime(rpm > 0.001 ? 0.055 + rpm * 0.06 : 0.0001, now, 0.06);
    this.engineAir.gain.setTargetAtTime(rpm > 0.01 ? 0.012 + this._engineThrottle * 0.02 : 0.0001, now, 0.08);
    this._engineSeen = false;
  }

  _updateAmbience(now) {
    if (!this._ambienceOn) return;
    const wind = 0.026 + Math.sin(this.time * 0.13) * 0.012 + Math.sin(this.time * 0.41) * 0.006;
    this.windGain.gain.setTargetAtTime(Math.max(0.004, wind), now, 0.4);
    const traffic = 0.013 + Math.max(0, Math.sin(this.time * 0.07 + 1.3)) * 0.013;
    this.cityGain.gain.setTargetAtTime(traffic, now, 0.6);
  }

  _scheduleMusic(now) {
    if (this.mode === 'off') return;
    const drive = this.mode === 'drive';
    const stepTime = drive ? 0.176 : 0.315;
    if (this._musicNext < now - 0.5) this._musicNext = now + 0.05;
    while (this._musicNext < now + 0.22) {
      const at = this._musicNext;
      const step = this._musicStep % 16;
      if (drive) {
        const index = step % 8;
        this._tone(midiToHz(DRIVE_BASS[index]), at, stepTime * 0.86, 0.2, 'triangle', this.musicBus);
        if (step % 2 === 0) {
          this._tone(midiToHz(DRIVE_LEAD[index]), at, stepTime * 0.7, 0.09, 'sawtooth', this.musicBus);
        }
        if (step % 4 === 0) this._tone(105, at, 0.14, 0.3, 'sine', this.musicBus, 45);
        if (step === 4 || step === 12) this._burst(at, 0.12, 0.13, 1700, 'bandpass', 0.8, this.musicBus);
        this._burst(at + stepTime * 0.5, 0.035, 0.05, 6500, 'highpass', 0.6, this.musicBus);
      } else {
        const chord = MENU_CHORDS[Math.floor(step / 4) % MENU_CHORDS.length];
        if (step % 4 === 0) {
          for (const note of chord) this._tone(midiToHz(note + 12), at, stepTime * 3.6, 0.035, 'triangle', this.musicBus);
          this._tone(midiToHz(chord[0] - 12), at, stepTime * 1.8, 0.15, 'sine', this.musicBus);
        }
        const arp = MENU_ARP[step % MENU_ARP.length];
        this._tone(midiToHz(chord[arp] + 12), at, stepTime * 0.8, 0.07, 'sine', this.musicBus);
      }
      this._musicStep += 1;
      this._musicNext += stepTime;
    }
  }

  update(dt) {
    if (!this._ready()) return;
    this.time += dt;
    try {
      const now = this.ctx.currentTime;
      const game = typeof window === 'undefined' ? null : window.game;
      const duck = game?.state === 'paused' || game?.state === 'menu' && this.mode === 'drive';
      if (this.musicBus) {
        const target = this.mode === 'off' ? 0.0001 : duck ? 0.16 : this.mode === 'menu' ? 0.55 : 0.5;
        this.musicBus.gain.setTargetAtTime(target, now, 0.2);
      }
      this._updateEngine(dt, now);
      this._updateSiren(dt, now);
      this._updateAmbience(now);
      this._scheduleMusic(now);
    } catch {}
  }
}

export default AudioEngine;
