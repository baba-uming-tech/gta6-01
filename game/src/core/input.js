// Input is polled once per frame: keys holds held codes, pressed() is true only on the frame a
// code goes down, and the mouse deltas/wheel are cleared by endFrame() at the bottom of the loop.

const MOUSE_CODES = new Set(['Mouse0', 'Mouse1', 'Mouse2']);
const ALIASES = {
  ShiftLeft: ['ShiftLeft', 'ShiftRight'],
  ControlLeft: ['ControlLeft', 'ControlRight'],
  AltLeft: ['AltLeft', 'AltRight'],
};

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.canvas = null;
    this._pressed = new Set();
    this._onKeyDown = (event) => {
      if (event.code === 'F5' || event.code === 'F9' || event.code === 'Space') event.preventDefault();
      if (!this.keys.has(event.code)) this._pressed.add(event.code);
      this.keys.add(event.code);
    };
    this._onKeyUp = (event) => { this.keys.delete(event.code); };
    this._onMouseMove = (event) => {
      if (!this.locked) return;
      this.mouseDX += event.movementX || 0;
      this.mouseDY += event.movementY || 0;
    };
    this._onMouseDown = (event) => {
      const code = `Mouse${event.button}`;
      if (!this.keys.has(code)) this._pressed.add(code);
      this.keys.add(code);
    };
    this._onMouseUp = (event) => { this.keys.delete(`Mouse${event.button}`); };
    this._onWheel = (event) => { this.wheel += event.deltaY; };
    this._onLockChange = () => { this.locked = document.pointerLockElement === this.canvas; };
    this._onBlur = () => { this.keys.clear(); this._pressed.clear(); };
    this._onContext = (event) => { event.preventDefault(); };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  isDown(code) {
    const codes = ALIASES[code] ?? [code];
    for (const candidate of codes) if (this.keys.has(candidate)) return true;
    return false;
  }

  pressed(code) {
    const codes = ALIASES[code] ?? [code];
    for (const candidate of codes) if (this._pressed.has(candidate)) return true;
    return false;
  }

  lock(canvas) {
    this.canvas = canvas;
    if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
  }

  endFrame() {
    this._pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}

export { MOUSE_CODES };
