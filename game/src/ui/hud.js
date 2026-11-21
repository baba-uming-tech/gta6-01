import { clamp } from '../core/rng.js';

const TEMPLATE = `
  <div class="hud-vitals">
    <div class="hud-stars" data-stars></div>
    <div class="hud-cash"><span>$</span><b data-cash>500</b></div>
    <div class="hud-portrait" aria-label="Rafa Quintero"></div>
    <div class="hud-bars">
      <div class="hud-bar" data-health-panel>
        <span class="hud-bar-key">HP</span>
        <span class="hud-bar-track"><i data-health></i></span>
        <span class="hud-bar-value" data-health-value>100</span>
      </div>
      <div class="hud-bar">
        <span class="hud-bar-key">AR</span>
        <span class="hud-bar-track"><i data-armour></i></span>
        <span class="hud-bar-value" data-armour-value>50</span>
      </div>
    </div>
  </div>
  <div class="hud-map">
    <div class="hud-map-head">
      <b data-clock>17:12</b><span class="hud-map-sep">◆</span><span data-district>Costanera</span>
    </div>
    <div class="hud-map-frame"><canvas class="hud-map-canvas" width="168" height="168"></canvas></div>
  </div>
  <div class="hud-combat">
    <div class="hud-speed hidden" data-speed-panel>
      <b data-speed>0</b><small>KM/H</small>
      <span class="hud-gear" data-vehicle>Coupe · D</span>
    </div>
    <div class="hud-weapon" data-weapon-panel>
      <span class="hud-weapon-name" data-weapon-name>Pistol</span>
      <span class="hud-ammo"><b data-ammo>12</b><small>/ <span data-reserve>84</span></small></span>
    </div>
  </div>
  <div class="hud-objective hidden" data-objective-panel>
    <span class="hud-objective-mark">◆</span><span data-objective></span>
  </div>
  <div class="hud-dialogue hidden" data-dialogue-panel>
    <span class="hud-dialogue-name" data-speaker></span>
    <span class="hud-dialogue-line" data-line></span>
  </div>
  <div class="hud-prompt hidden" data-prompt-panel><kbd>E</kbd><span data-prompt></span></div>
  <div class="hud-toasts" data-toasts></div>
`;

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function setBar(element, value) {
  const width = `${Math.round(clamp(value, 0, 100))}%`;
  if (element.style.width !== width) element.style.width = width;
}

function twoDigits(value) {
  return value < 10 ? `0${value}` : String(value);
}

export class Hud {
  constructor(root) {
    this.root = root;
    root.insertAdjacentHTML('beforeend', TEMPLATE);
    const pick = (selector) => root.querySelector(selector);
    this.minimapCanvas = pick('.hud-map-canvas');
    this.cash = pick('[data-cash]');
    this.stars = pick('[data-stars]');
    this.stars.innerHTML = '<i></i>'.repeat(5);
    this.starEls = Array.from(this.stars.children);
    this.healthFill = pick('[data-health]');
    this.armourFill = pick('[data-armour]');
    this.healthValue = pick('[data-health-value]');
    this.armourValue = pick('[data-armour-value]');
    this.healthPanel = pick('[data-health-panel]');
    this.weaponPanel = pick('[data-weapon-panel]');
    this.weaponName = pick('[data-weapon-name]');
    this.ammo = pick('[data-ammo]');
    this.reserve = pick('[data-reserve]');
    this.clock = pick('[data-clock]');
    this.district = pick('[data-district]');
    this.speedPanel = pick('[data-speed-panel]');
    this.speed = pick('[data-speed]');
    this.vehicle = pick('[data-vehicle]');
    this.objectivePanel = pick('[data-objective-panel]');
    this.objective = pick('[data-objective]');
    this.dialoguePanel = pick('[data-dialogue-panel]');
    this.speaker = pick('[data-speaker]');
    this.line = pick('[data-line]');
    this.promptPanel = pick('[data-prompt-panel]');
    this.prompt = pick('[data-prompt]');
    this.toasts = pick('[data-toasts]');
    this._typing = 0;
    this._typedLine = '';
    this._typedCount = 0;
    this._prompt = '';
    this._objective = '';
  }

  setVisible(on) {
    this.root.classList.toggle('hud-off', !on);
  }

  setObjective(text) {
    const value = String(text ?? '');
    if (value === this._objective) return;
    this._objective = value;
    setText(this.objective, value);
    this.objectivePanel.classList.toggle('hidden', !value);
  }

  setPrompt(text) {
    const value = String(text ?? '');
    if (value === this._prompt) return;
    this._prompt = value;
    setText(this.prompt, value);
    this.promptPanel.classList.toggle('hidden', !value);
  }

  _stopTyping() {
    if (!this._typing) return;
    window.clearInterval(this._typing);
    this._typing = 0;
  }

  say(name, text, instant = false) {
    this._stopTyping();
    const speaker = String(name ?? '');
    const line = String(text ?? '');
    if (!speaker && !line) {
      this.dialoguePanel.classList.add('hidden');
      return;
    }
    setText(this.speaker, speaker);
    this.dialoguePanel.classList.remove('hidden');
    if (instant) {
      setText(this.line, line);
      return;
    }
    this._typedLine = line;
    this._typedCount = 0;
    setText(this.line, '');
    this._typing = window.setInterval(() => {
      this._typedCount += 2;
      setText(this.line, this._typedLine.slice(0, this._typedCount));
      if (this._typedCount >= this._typedLine.length) this._stopTyping();
    }, 24);
  }

  toast(text) {
    const item = document.createElement('div');
    item.className = 'hud-toast';
    item.textContent = String(text ?? '');
    this.toasts.appendChild(item);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild.remove();
    window.setTimeout(() => item.remove(), 4200);
  }

  update(state) {
    if (!state) return;
    const health = clamp(state.health ?? 0, 0, 100);
    const armour = clamp(state.armour ?? 0, 0, 100);
    setBar(this.healthFill, health);
    setBar(this.armourFill, armour);
    setText(this.healthValue, String(Math.round(health)));
    setText(this.armourValue, String(Math.round(armour)));
    this.healthPanel.classList.toggle('critical', health <= 30);

    setText(this.cash, Math.round(state.money ?? 0).toLocaleString('en-US'));
    const wanted = clamp(state.wanted ?? 0, 0, 5);
    for (let i = 0; i < this.starEls.length; i += 1) {
      this.starEls[i].classList.toggle('on', i < wanted);
    }
    this.stars.classList.toggle('hot', wanted > 0);

    setText(this.weaponName, state.weaponName ?? 'Pistol');
    setText(this.ammo, state.reloading ? '••' : String(state.ammo ?? 0));
    setText(this.reserve, String(state.reserve ?? 0));
    this.weaponPanel.classList.toggle('reloading', Boolean(state.reloading));

    const hour = ((state.hour ?? 0) % 24 + 24) % 24;
    const hh = Math.floor(hour);
    const mm = Math.floor((hour - hh) * 60);
    setText(this.clock, `${twoDigits(hh)}:${twoDigits(mm)}`);
    setText(this.district, state.district ?? 'Velamar');

    const driving = Boolean(state.inVehicle);
    this.speedPanel.classList.toggle('hidden', !driving);
    if (driving) {
      const kmh = clamp(Math.round((state.speed ?? 0) * 3.6), 0, 220);
      setText(this.speed, String(kmh));
      setText(this.vehicle, `${state.vehicleName ?? 'Vehicle'} · D`);
    }
  }
}
