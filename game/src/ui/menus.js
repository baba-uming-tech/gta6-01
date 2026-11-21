import { hasSave } from '../core/save.js';

const CONTROLS = [
  ['WASD', 'move / drive'],
  ['SHIFT', 'sprint / handbrake'],
  ['SPACE', 'jump / handbrake'],
  ['MOUSE', 'look around'],
  ['E', 'enter or exit vehicle'],
  ['F / RMB', 'fire / aim'],
  ['R', 'reload'],
  ['1 2 3', 'weapons'],
  ['C', 'camera distance'],
  ['M', 'map'],
  ['ESC', 'pause'],
  ['F5 / F9', 'save / load'],
];

const TEMPLATE = `
  <div class="menu-card menu-start" data-screen="start">
    <div class="menu-eyebrow">A COASTAL CRIME STORY</div>
    <h1 class="menu-title">VELAMAR</h1>
    <div class="menu-subtitle">SUN, SALT AND FAST MONEY ON THE COAST</div>
    <div class="menu-rule"></div>
    <div class="menu-buttons">
      <button type="button" class="menu-button primary" data-action="new">NEW GAME</button>
      <button type="button" class="menu-button" data-action="continue" data-save-button>CONTINUE</button>
      <button type="button" class="menu-button" data-action="settings">SETTINGS</button>
    </div>
    <div class="menu-controls">
      <div class="menu-controls-title">CONTROLS</div>
      <div class="menu-controls-grid">${CONTROLS.map(([key, label]) =>
        `<div class="menu-control"><kbd>${key}</kbd><span>${label}</span></div>`).join('')}</div>
    </div>
    <div class="menu-foot">RAFA QUINTERO · VELAMAR POLICÍA DE VELAMAR</div>
  </div>

  <div class="menu-card menu-compact hidden" data-screen="pause">
    <div class="menu-eyebrow">THE CITY CAN WAIT</div>
    <h2 class="menu-title small">PAUSED</h2>
    <div class="menu-rule"></div>
    <div class="menu-buttons">
      <button type="button" class="menu-button primary" data-action="resume">RESUME</button>
      <button type="button" class="menu-button" data-action="settings">SETTINGS</button>
      <button type="button" class="menu-button" data-action="save">SAVE GAME</button>
      <button type="button" class="menu-button" data-action="load" data-save-button>LOAD GAME</button>
      <button type="button" class="menu-button subtle" data-action="quit">QUIT TO TITLE</button>
    </div>
    <div class="menu-hint">F5 SAVE · F9 LOAD · ESC RESUME</div>
  </div>

  <div class="menu-card menu-compact hidden" data-screen="settings">
    <div class="menu-eyebrow">MAKE IT YOURS</div>
    <h2 class="menu-title small">SETTINGS</h2>
    <div class="menu-rule"></div>
    <div class="menu-settings">
      <label class="menu-setting">
        <span>MOUSE SENSITIVITY <b data-value="sensitivity">1.0</b></span>
        <input type="range" min="0.2" max="3" step="0.1" value="1" data-setting="sensitivity">
      </label>
      <label class="menu-setting">
        <span>VOLUME <b data-value="volume">80%</b></span>
        <input type="range" min="0" max="1" step="0.05" value="0.8" data-setting="volume">
      </label>
      <label class="menu-setting">
        <span>QUALITY</span>
        <select data-setting="quality">
          <option value="low">LOW</option><option value="mid">MID</option><option value="high">HIGH</option>
        </select>
      </label>
      <label class="menu-setting inline">
        <span>INVERT Y AXIS</span>
        <input type="checkbox" data-setting="invertY">
      </label>
    </div>
    <div class="menu-buttons">
      <button type="button" class="menu-button primary" data-action="back">BACK</button>
    </div>
  </div>

  <div class="menu-card menu-compact hidden" data-screen="gameover">
    <div class="menu-eyebrow danger">RAFA IS DOWN</div>
    <h2 class="menu-title small danger-text">GAME OVER</h2>
    <div class="menu-rule"></div>
    <p class="menu-gameover-note" data-gameover-note>CLINICA SOLARIS WILL PICK UP THE TAB.</p>
    <div class="menu-buttons">
      <button type="button" class="menu-button primary" data-action="restart">RESTART</button>
      <button type="button" class="menu-button" data-action="load" data-save-button>LOAD GAME</button>
      <button type="button" class="menu-button subtle" data-action="quit">QUIT TO TITLE</button>
    </div>
  </div>
`;

const SCREENS = new Set(['start', 'pause', 'settings', 'gameover']);
const ALIASES = { title: 'start', dead: 'gameover', 'game-over': 'gameover', paused: 'pause' };

function formatSetting(key, value) {
  if (key === 'sensitivity') return Number(value).toFixed(1);
  if (key === 'volume') return `${Math.round(Number(value) * 100)}%`;
  return String(value);
}

export class Menus {
  constructor(root, cb = {}) {
    this.root = root;
    this.cb = cb;
    this.settings = cb.settings ?? { sensitivity: 1, volume: 0.8, quality: 'mid', invertY: false };
    this.screen = null;
    this._settingsBack = 'pause';
    this._message = '';
    root.innerHTML = TEMPLATE;
    this.screens = {};
    for (const element of root.querySelectorAll('[data-screen]')) {
      this.screens[element.dataset.screen] = element;
    }
    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;
      this._activate(button.dataset.action);
    });
    root.addEventListener('input', (event) => {
      const input = event.target.closest('[data-setting]');
      if (!input) return;
      const key = input.dataset.setting;
      const value = key === 'invertY' ? input.checked
        : key === 'quality' ? input.value : Number(input.value);
      this.settings[key] = value;
      const label = root.querySelector(`[data-value="${key}"]`);
      if (label) label.textContent = formatSetting(key, value);
      this.cb.onSettingChange?.(key, value);
    });
    this.show('start');
  }

  get isOpen() {
    return this.screen !== null;
  }

  show(title = 'start') {
    const name = ALIASES[title] ?? (SCREENS.has(title) ? title : 'start');
    if (name === 'settings' && SCREENS.has(this.screen) && this.screen !== 'settings') {
      this._settingsBack = this.screen;
    }
    this.screen = name;
    this.root.classList.remove('hidden');
    for (const [key, element] of Object.entries(this.screens)) {
      element.classList.toggle('hidden', key !== name);
    }
    const save = hasSave();
    for (const button of this.root.querySelectorAll('[data-save-button]')) button.disabled = !save;
    const sensitivity = this.root.querySelector('[data-setting="sensitivity"]');
    const volume = this.root.querySelector('[data-setting="volume"]');
    const quality = this.root.querySelector('[data-setting="quality"]');
    const invertY = this.root.querySelector('[data-setting="invertY"]');
    sensitivity.value = String(this.settings.sensitivity);
    volume.value = String(this.settings.volume);
    quality.value = this.settings.quality;
    invertY.checked = Boolean(this.settings.invertY);
    this.root.querySelector('[data-value="sensitivity"]').textContent = formatSetting('sensitivity', this.settings.sensitivity);
    this.root.querySelector('[data-value="volume"]').textContent = formatSetting('volume', this.settings.volume);
    this.root.querySelector('[data-gameover-note]').textContent = this._message
      || 'CLINICA SOLARIS WILL PICK UP THE TAB.';
  }

  hide() {
    this.screen = null;
    this.root.classList.add('hidden');
  }

  setMessage(text) {
    this._message = String(text ?? '');
    const note = this.root.querySelector('[data-gameover-note]');
    if (note) note.textContent = this._message;
  }

  _activate(action) {
    const handler = this.cb[`on${action[0].toUpperCase()}${action.slice(1)}`];
    if (handler) handler();
    else if (action === 'back') this.show(this._settingsBack);
  }
}
