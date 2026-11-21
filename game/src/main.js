// Boot, screens and the one loop. The simulation advances in fixed 1/60 s steps,
// several in a slow frame and none in a fast one, and the renderer paints whatever is
// there. ?shot=1|2|3|4 stages a deterministic scene through shots.js and sets
// window.__ready once the frame has been drawn; ?seed=N changes only the dust.

import { BEST_KEY, STEP } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import {
  awardLevelClear,
  createWorld,
  enterLevel,
  restartLevel,
  startCampaign,
  stepAmbient,
  stepWorld,
} from './world.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '1', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);
const world = createWorld(seed);
const ui = { best: 0, muted: false };
let screen = SCREEN_TITLE;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private windows can refuse storage; the best then lasts for this visit only.
  }
}

function announce(message) {
  status.textContent = message;
}

function noteBest() {
  if (world.score > ui.best) {
    ui.best = world.score;
    saveBest(ui.best);
  }
}

function finishFloor() {
  const bonus = awardLevelClear(world);
  if (world.levelIndex === 2) {
    screen = SCREEN_WIN;
    noteBest();
    audio.win();
    announce(`You escaped. Score ${world.score}, ${world.fishCollected} of ${world.fishTotal} fish.`);
  } else {
    screen = SCREEN_CLEAR;
    audio.levelClear();
    announce(
      `Floor ${world.levelIndex + 1} clear. Bonus ${bonus.total}. Score ${world.score}. Press space for the next floor.`,
    );
  }
}

function beginCampaign() {
  startCampaign(world);
  screen = SCREEN_PLAY;
  announce('Level 1, the foyer. Reach the open window unseen.');
}

function retryFloor() {
  restartLevel(world);
  screen = SCREEN_PLAY;
  announce(`Trying floor ${world.levelIndex + 1} again.`);
}

function advanceFloor() {
  if (world.levelIndex >= 2) {
    screen = SCREEN_WIN;
    noteBest();
    return;
  }
  enterLevel(world, world.levelIndex + 1);
  screen = SCREEN_PLAY;
  announce(`Level ${world.levelIndex + 1}, ${world.level.name}. Reach the open window unseen.`);
}

function toggleMute() {
  audio.toggleMute();
  ui.muted = audio.isMuted();
  announce(ui.muted ? 'Sound off.' : 'Sound on.');
}

function runShot(name) {
  const scene = stageShot(name, world);
  screen = scene.screen;
  ui.best = Math.max(ui.best, world.score);
  let painted = 0;
  function paint() {
    renderer.draw(world, screen, ui);
    painted += 1;
    if (painted < 2) {
      requestAnimationFrame(paint);
    } else {
      window.__shotReady = true;
      window.__ready = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  ui.best = readBest();
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let queuedClicks = [];

  // The audio context may only be created inside a user gesture.
  window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
  window.addEventListener('keydown', () => audio.unlock(), { capture: true });

  // Walking the title-screen butlers before the first click makes the menu alive.
  for (let i = 0; i < Math.round(2.4 / STEP); i += 1) stepAmbient(world, STEP);
  announce('Silent Paws. Press space or click to begin.');

  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    accumulator = 0;
  });

  function handleClicks(clicks) {
    if (screen === SCREEN_PLAY) {
      queuedClicks.push(...clicks);
      return;
    }
    if (clicks.length === 0) return;
    if (screen === SCREEN_TITLE) beginCampaign();
    else if (screen === SCREEN_CAUGHT) retryFloor();
    else if (screen === SCREEN_CLEAR) advanceFloor();
    else if (screen === SCREEN_WIN) beginCampaign();
  }

  function handleActions(actions) {
    if (actions.mute) toggleMute();
    if (actions.restart && (screen === SCREEN_PLAY || screen === SCREEN_CAUGHT)) {
      retryFloor();
      return;
    }
    if (!actions.confirm) return;
    if (screen === SCREEN_TITLE) beginCampaign();
    else if (screen === SCREEN_CAUGHT) retryFloor();
    else if (screen === SCREEN_CLEAR) advanceFloor();
    else if (screen === SCREEN_WIN) beginCampaign();
  }

  function handleEvents(events) {
    for (const event of events) {
      if (event === 'throw') audio.throwCoin();
      else if (event === 'coin') audio.coin();
      else if (event === 'spotted') audio.spotted();
      else if (event === 'fish') audio.fish();
    }
    if (events.includes('caught')) {
      screen = SCREEN_CAUGHT;
      audio.caught();
      announce(`Caught on floor ${world.levelIndex + 1}. Press space to try again.`);
    } else if (events.includes('clear')) {
      finishFloor();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const delta = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const actions = input.takeActions();
    const clicks = input.takeClicks();
    handleActions(actions);
    handleClicks(clicks);

    accumulator += delta;
    let guard = 0;
    while (accumulator >= STEP && guard < 12) {
      accumulator -= STEP;
      guard += 1;
      if (screen === SCREEN_TITLE) {
        stepAmbient(world, STEP);
      } else if (screen === SCREEN_PLAY) {
        const spent = queuedClicks;
        queuedClicks = [];
        const events = stepWorld(world, STEP, { direction: input.direction(), clicks: spent });
        handleEvents(events);
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      } else {
        accumulator = 0;
        break;
      }
    }

    ui.muted = audio.isMuted();
    audio.update(delta, world);
    renderer.draw(world, screen, ui);
  }

  requestAnimationFrame(frame);
}

if (shotParam) runShot(shotParam);
else runGame();
