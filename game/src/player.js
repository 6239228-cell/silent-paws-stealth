// The cat itself: walking and sliding along walls, tucking into bushes, reading the
// moonlight and the shadows, tossing coins, and the alert meter that decides whether
// the butlers have noticed. Every value the HUD shows about the cat comes from here.

import { ALERT, CAT, COIN, FIELD, HUD_HEIGHT, LIGHT } from './config.js';
import { blockersOf } from './levels.js';
import { circleHitsRect, distanceBetween, hearCoin, moveCircle } from './guards.js';

export function createCat(start) {
  return {
    x: start.x,
    y: start.y,
    radius: CAT.radius,
    facing: -Math.PI / 2,
    moving: false,
    hidden: false,
    stepPhase: 0,
    spawnX: start.x,
    spawnY: start.y,
  };
}

/** A bush conceals the cat whose centre is under its leaves. */
export function isHiding(level, cat) {
  for (const bush of level.bushes) {
    if (
      cat.x > bush.x + 2 &&
      cat.x < bush.x + bush.w - 2 &&
      cat.y > bush.y + 2 &&
      cat.y < bush.y + bush.h - 2
    ) {
      return true;
    }
  }
  return false;
}

/** Moonlight, shadow or plain floor at a point. Shadow wins where patches overlap. */
export function exposureAt(world, x = world.cat.x, y = world.cat.y) {
  for (const patch of world.level.shadows) {
    const dx = (x - patch.x) / patch.rx;
    const dy = (y - patch.y) / patch.ry;
    if (dx * dx + dy * dy <= 1) return 'shadow';
  }
  for (const patch of world.level.moonlight) {
    const dx = (x - patch.x) / patch.rx;
    const dy = (y - patch.y) / patch.ry;
    if (dx * dx + dy * dy <= 1) return 'moon';
  }
  return 'normal';
}

export function moveCat(world, direction, dt) {
  const cat = world.cat;
  cat.hidden = isHiding(world.level, cat);
  const speed = CAT.speed * (cat.hidden ? CAT.bushSpeed : 1);
  let dx = direction.x;
  let dy = direction.y;
  const length = Math.hypot(dx, dy);
  cat.moving = length > 0.01;
  if (!cat.moving) return;
  dx /= length;
  dy /= length;

  const beforeX = cat.x;
  const beforeY = cat.y;
  const blockers = blockersOf(world.level);
  moveCircle(cat, dx * speed * dt, 0, cat.radius, blockers);
  moveCircle(cat, 0, dy * speed * dt, cat.radius, blockers);
  const moved = Math.hypot(cat.x - beforeX, cat.y - beforeY);
  cat.stepPhase += moved;

  const wanted = Math.atan2(dy, dx);
  let delta = wanted - cat.facing;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const turn = CAT.turn * dt;
  cat.facing += Math.max(-turn, Math.min(turn, delta));

  // The open window sits in a gap in the outer wall; let the cat step into it.
  cat.x = Math.max(12, Math.min(FIELD.width - 12, cat.x));
  cat.y = Math.max(92, Math.min(FIELD.height - 8, cat.y));
}

/** Keep a tossed coin out of solid furniture: slide it back along the throw until it is free. */
function clearLanding(level, fromX, fromY, toX, toY) {
  const blockers = blockersOf(level);
  const target = { x: toX, y: toY };
  const blocked = (x, y) => blockers.some((rect) => circleHitsRect(x, y, 10, rect));
  if (!blocked(target.x, target.y)) return target;
  for (let t = 0.95; t >= 0.15; t -= 0.05) {
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;
    if (!blocked(x, y)) return { x, y };
  }
  return { x: fromX, y: fromY };
}

/** Spend a coin and send it arcing toward a stage point. Returns true when it was thrown. */
export function throwCoin(world, target) {
  if (world.coinsLeft <= 0) return false;
  if (target.y < HUD_HEIGHT + 4 || target.x < 8 || target.x > FIELD.width - 8) return false;
  const landing = clearLanding(world.level, world.cat.x, world.cat.y, target.x, target.y);
  const distance = distanceBetween(world.cat.x, world.cat.y, landing.x, landing.y);
  const duration = Math.max(COIN.flightMin, Math.min(COIN.flightMax, distance / COIN.speed));
  world.coins.push({
    fromX: world.cat.x,
    fromY: world.cat.y,
    x: world.cat.x,
    y: world.cat.y,
    tx: landing.x,
    ty: landing.y,
    t: 0,
    duration,
    landed: false,
    spin: world.rng() * Math.PI * 2,
  });
  world.coinsLeft -= 1;
  world.events.push('throw');
  return true;
}

export function updateCoins(world, dt) {
  for (const coin of world.coins) {
    if (coin.landed) continue;
    coin.t = Math.min(1, coin.t + dt / coin.duration);
    const eased = coin.t * coin.t * (3 - 2 * coin.t);
    coin.x = coin.fromX + (coin.tx - coin.fromX) * eased;
    coin.y = coin.fromY + (coin.ty - coin.fromY) * eased;
    coin.spin += dt * 14;
    if (coin.t >= 1) {
      coin.landed = true;
      coin.x = coin.tx;
      coin.y = coin.ty;
      world.effects.push({ type: 'ring', x: coin.tx, y: coin.ty, t: 0, duration: 0.85 });
      world.events.push('coin');
      hearCoin(world, coin.tx, coin.ty);
    }
  }
}

/**
 * Raise the meter while at least one butler has a clean look at the cat, and cool it
 * when nobody does. Moonlight softens the rise; deep shadow sharpens it.
 */
export function updateAlert(world, seen, dt) {
  const wasVisible = world.visible;
  world.visible = seen.length > 0;
  world.exposure = exposureAt(world);
  if (world.visible) {
    let closeness = 0;
    for (const guard of seen) closeness = Math.max(closeness, guard.closeness);
    const light =
      world.exposure === 'moon'
        ? LIGHT.moonMultiplier
        : world.exposure === 'shadow'
          ? LIGHT.shadowMultiplier
          : 1;
    const crowd = 1 + 0.15 * Math.max(0, seen.length - 1);
    const rate = (ALERT.riseBase + ALERT.riseProximity * closeness) * light * crowd;
    world.alert = Math.min(ALERT.max, world.alert + rate * dt);
    if (world.alert > world.peakAlert) world.peakAlert = world.alert;
    if (!wasVisible && world.spotCooldown <= 0) {
      world.events.push('spotted');
      world.spotCooldown = ALERT.spotCooldown;
    }
  } else {
    world.alert = Math.max(0, world.alert - ALERT.fall * dt);
  }
  if (world.spotCooldown > 0) world.spotCooldown = Math.max(0, world.spotCooldown - dt);
}
