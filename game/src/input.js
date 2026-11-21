// Keyboard and mouse state. Movement is polled every frame; clicks and the one-shot
// keys (confirm, restart, mute) are queued and drained by main.js so a quick tap is
// never lost between frames. Mouse positions are converted from the page to the
// 1280x800 stage, letterboxing included.

import { FIELD } from './config.js';

const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
]);

export function createInput(canvas) {
  const down = new Set();
  let clicks = [];
  let confirm = false;
  let restart = false;
  let mute = false;

  function toStage(clientX, clientY) {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    const offsetX = (window.innerWidth - FIELD.width * scale) / 2;
    const offsetY = (window.innerHeight - FIELD.height * scale) / 2;
    return { x: (clientX - offsetX) / scale, y: (clientY - offsetY) / scale };
  }

  function onPointerDown(event) {
    event.preventDefault();
    const point = toStage(event.clientX, event.clientY);
    if (event.button === 0) clicks.push(point);
  }

  function onKeyDown(event) {
    if (MOVE_KEYS.has(event.code)) {
      down.add(event.code);
      event.preventDefault();
    }
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter') {
      confirm = true;
      event.preventDefault();
    } else if (event.code === 'KeyR') {
      restart = true;
    } else if (event.code === 'KeyM') {
      mute = true;
    }
  }

  function onKeyUp(event) {
    down.delete(event.code);
  }

  function onBlur() {
    down.clear();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    direction() {
      let x = 0;
      let y = 0;
      if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
      if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
      if (down.has('KeyW') || down.has('ArrowUp')) y -= 1;
      if (down.has('KeyS') || down.has('ArrowDown')) y += 1;
      return { x, y };
    },
    takeClicks() {
      const drained = clicks;
      clicks = [];
      return drained;
    },
    takeActions() {
      const actions = { confirm, restart, mute };
      confirm = false;
      restart = false;
      mute = false;
      return actions;
    },
  };
}
