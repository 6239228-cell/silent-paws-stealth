// The campaign state and the fixed-step rules.
// One place assembles a level from levels.js, advances the cat, the coins, the butlers
// and the alert meter, and decides when the window is reached or the cat is caught.
// main.js and shots.js both drive this same step, so a staged screenshot and a played
// level can never disagree.

import { ALERT, FIELD, HUD_HEIGHT, SCORE, STEP } from './config.js';
import { FISH_TOTAL, LEVELS } from './levels.js';
import { createCat, moveCat, throwCoin, updateAlert, updateCoins } from './player.js';
import { computeVisibility, createGuard, distanceBetween, updateGuards } from './guards.js';

/** mulberry32: small, fast and repeatable, so ?seed= changes only the decorative dust. */
export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createDecor(rng) {
  const specks = [];
  for (let i = 0; i < 130; i += 1) {
    specks.push({
      x: 20 + rng() * (FIELD.width - 40),
      y: HUD_HEIGHT + 20 + rng() * (FIELD.height - HUD_HEIGHT - 40),
      radius: 0.6 + rng() * 1.7,
      alpha: 0.04 + rng() * 0.12,
      phase: rng() * Math.PI * 2,
    });
  }
  return { specks };
}

export function createWorld(seed = 1) {
  const world = {
    seed,
    rng: createRandom(seed),
    levelIndex: 0,
    level: LEVELS[0],
    score: 0,
    fishCollected: 0,
    completedTime: 0,
    fishTotal: FISH_TOTAL,
    levelTime: 0,
    events: [],
    decor: createDecor(createRandom(seed)),
  };
  startCampaign(world);
  return world;
}

/** Put the cat at the beginning of level `index`, keeping the campaign score. */
export function enterLevel(world, index) {
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, index))];
  world.levelIndex = index;
  world.level = level;
  world.cat = createCat(level.playerStart);
  world.guards = level.guards.map((definition, guardIndex) => createGuard(definition, guardIndex));
  world.fish = level.fish.map((fish, fishIndex) => ({
    x: fish.x,
    y: fish.y,
    taken: false,
    bob: fishIndex * 1.7 + 0.4,
  }));
  world.coins = [];
  world.coinsLeft = level.coins;
  world.effects = [];
  world.alert = 0;
  world.peakAlert = 0;
  world.visible = false;
  world.seenBy = [];
  world.exposure = 'normal';
  world.caught = false;
  world.cleared = false;
  world.bonusAwarded = false;
  world.lastBonus = null;
  world.spotCooldown = 0;
  world.levelTime = 0;
  world.events = [];
  world.scoreAtLevelStart = world.score;
  world.fishAtLevelStart = world.fishCollected;
}

export function startCampaign(world) {
  world.score = 0;
  world.fishCollected = 0;
  world.completedTime = 0;
  enterLevel(world, 0);
}

/** Retry the current floor: score and fish collected here are rolled back, earlier floors kept. */
export function restartLevel(world) {
  const score = world.scoreAtLevelStart;
  const fish = world.fishAtLevelStart;
  enterLevel(world, world.levelIndex);
  world.score = score;
  world.fishCollected = fish;
  world.scoreAtLevelStart = score;
  world.fishAtLevelStart = fish;
}

export function nextLevel(world) {
  if (world.levelIndex >= LEVELS.length - 1) return false;
  enterLevel(world, world.levelIndex + 1);
  return true;
}

/** Add the end-of-floor reward once. Returns the itemised bonus for the clear panel. */
export function awardLevelClear(world) {
  if (world.bonusAwarded) return world.lastBonus;
  world.bonusAwarded = true;
  const timeBonus = Math.max(
    0,
    SCORE.clearTimeMax - Math.floor(world.levelTime) * SCORE.clearTimeRate,
  );
  const stealthBonus =
    world.peakAlert < 50 ? SCORE.stealthClear : world.peakAlert < 80 ? SCORE.stealthPartial : 0;
  const winBonus = world.levelIndex === LEVELS.length - 1 ? SCORE.win : 0;
  const total = SCORE.clearBase + timeBonus + stealthBonus + winBonus;
  world.score += total;
  world.completedTime += world.levelTime;
  world.lastBonus = {
    base: SCORE.clearBase,
    time: timeBonus,
    stealth: stealthBonus,
    win: winBonus,
    total,
    seconds: world.levelTime,
    peakAlert: world.peakAlert,
  };
  return world.lastBonus;
}

function updateEffects(world, dt) {
  for (const effect of world.effects) effect.t += dt;
  world.effects = world.effects.filter((effect) => effect.t < effect.duration);
}

function collectFish(world) {
  const cat = world.cat;
  for (const fish of world.fish) {
    if (fish.taken) continue;
    if (distanceBetween(cat.x, cat.y, fish.x, fish.y) < cat.radius + 12) {
      fish.taken = true;
      world.fishCollected += 1;
      world.score += SCORE.fish;
      world.events.push('fish');
      world.effects.push({ type: 'sparkle', x: fish.x, y: fish.y, t: 0, duration: 0.7 });
    }
  }
}

function reachedWindow(world) {
  const exit = world.level.exit;
  const cat = world.cat;
  return cat.x >= exit.x && cat.y >= exit.y && cat.y <= exit.y + exit.h;
}

/**
 * Advance the real rules one fixed step. `controls` is { direction: {x,y}, clicks: [{x,y}] };
 * clicks are spent as coin throws. Returns the list of events that happened this step.
 */
export function stepWorld(world, dt, controls = {}) {
  world.events = [];
  if (world.caught || world.cleared) return world.events;
  world.levelTime += dt;

  const direction = controls.direction ?? { x: 0, y: 0 };
  if (controls.clicks) {
    for (const click of controls.clicks) throwCoin(world, click);
  }

  moveCat(world, direction, dt);
  collectFish(world);
  updateCoins(world, dt);
  updateGuards(world, dt);

  const seen = computeVisibility(world);
  world.seenBy = seen.map((guard) => guard.id);
  updateAlert(world, seen, dt);

  if (reachedWindow(world)) {
    world.cleared = true;
    world.events.push('clear');
  }
  if (world.alert >= ALERT.max && !world.cleared) {
    world.alert = ALERT.max;
    world.caught = true;
    world.events.push('caught');
  }
  updateEffects(world, dt);
  return world.events;
}

/** Title-screen background: butlers keep walking, nothing else happens. */
export function stepAmbient(world, dt) {
  world.levelTime += dt;
  updateGuards(world, dt);
  updateEffects(world, dt);
}

/** Seconds of a floor shown on the clear and win panels. */
export function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export { STEP };
