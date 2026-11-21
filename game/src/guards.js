// Butlers, their torches and their ears.
// A guard walks its waypoint loop, pauses and sweeps the cone at every corner,
// and leaves the loop when a coin clinks nearby. Vision is a real test: inside the
// cone's angle, inside its range, and an unobstructed line to the cat. Walls and
// furniture block that line; bushes only hide the cat that is standing in them.

import { GUARD, VISION } from './config.js';
import { blockersOf } from './levels.js';

const TAU = Math.PI * 2;

export function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= TAU;
  while (value < -Math.PI) value += TAU;
  return value;
}

export function distanceBetween(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

/** Circle against axis-aligned rectangle, the one collision test everything uses. */
export function circleHitsRect(cx, cy, radius, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < radius * radius;
}

/** Slide a circle through the level, one axis at a time, so walls feel like walls. */
export function moveCircle(entity, dx, dy, radius, blockers) {
  let moved = 0;
  if (dx !== 0) {
    const nx = entity.x + dx;
    if (!blockers.some((rect) => circleHitsRect(nx, entity.y, radius, rect))) {
      entity.x = nx;
      moved += Math.abs(dx);
    }
  }
  if (dy !== 0) {
    const ny = entity.y + dy;
    if (!blockers.some((rect) => circleHitsRect(entity.x, ny, radius, rect))) {
      entity.y = ny;
      moved += Math.abs(dy);
    }
  }
  return moved;
}

/**
 * How far a ray travels before it meets a wall or a piece of furniture.
 * Returns the distance to the first blocker, capped at maxDistance.
 */
export function castRay(level, x, y, angle, maxDistance) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let nearest = maxDistance;
  const blockers = blockersOf(level);
  for (let i = 0; i < blockers.length; i += 1) {
    const t = rayRect(x, y, dx, dy, blockers[i]);
    if (t !== null && t < nearest) nearest = t;
  }
  return nearest;
}

/** Parametric hit of a ray against one rectangle (slab method); null when it misses. */
function rayRect(px, py, dx, dy, rect) {
  let tMin = 0;
  let tMax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (px < rect.x || px > rect.x + rect.w) return null;
  } else {
    let t1 = (rect.x - px) / dx;
    let t2 = (rect.x + rect.w - px) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
  }
  if (Math.abs(dy) < 1e-9) {
    if (py < rect.y || py > rect.y + rect.h) return null;
  } else {
    let t1 = (rect.y - py) / dy;
    let t2 = (rect.y + rect.h - py) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
  }
  if (tMax < tMin || tMax < 0) return null;
  return tMin > 0 ? tMin : 0;
}

/** True when the straight line from guard to cat is cut by solid geometry. */
export function lineBlocked(level, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return false;
  const ux = dx / length;
  const uy = dy / length;
  const blockers = blockersOf(level);
  for (let i = 0; i < blockers.length; i += 1) {
    const t = rayRect(ax, ay, ux, uy, blockers[i]);
    if (t !== null && t > 0.5 && t < length - 0.5) return true;
  }
  return false;
}

/**
 * The fan of floor a guard's torch lights up, already clipped by the furniture.
 * Returned as stage points so render.js only has to fill the path.
 */
export function visionPolygon(level, guard) {
  const points = [{ x: guard.x, y: guard.y }];
  const rays = VISION.rays;
  for (let i = 0; i <= rays; i += 1) {
    const angle = guard.angle - VISION.halfAngle + (VISION.halfAngle * 2 * i) / rays;
    const distance = Math.max(4, castRay(level, guard.x, guard.y, angle, VISION.range) - 2);
    points.push({ x: guard.x + Math.cos(angle) * distance, y: guard.y + Math.sin(angle) * distance });
  }
  return points;
}

export function createGuard(definition, index) {
  const start = definition.path[0];
  const next = definition.path[1 % definition.path.length];
  const face = Math.atan2(next.y - start.y, next.x - start.x);
  return {
    id: `guard-${index}`,
    name: definition.name,
    path: definition.path,
    targetIndex: 1 % definition.path.length,
    x: start.x,
    y: start.y,
    angle: face,
    baseAngle: face,
    state: 'patrol',
    pause: 0.5 + index * 0.3,
    pauseAtStart: true,
    scanT: index * 0.7,
    searchTimer: 0,
    investigateX: start.x,
    investigateY: start.y,
    stuck: 0,
    stepPhase: index * 17,
    moving: false,
    seen: false,
    closeness: 0,
  };
}

function turnToward(guard, targetAngle, dt) {
  const delta = normalizeAngle(targetAngle - guard.angle);
  const step = GUARD.turn * dt;
  guard.angle = normalizeAngle(guard.angle + Math.max(-step, Math.min(step, delta)));
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

/** Walk toward a point at a given speed; returns the distance actually covered. */
function walkToward(guard, toX, toY, speed, dt, blockers) {
  const dx = toX - guard.x;
  const dy = toY - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.01) return 0;
  turnToward(guard, Math.atan2(dy, dx), dt);
  const step = Math.min(speed * dt, distance);
  const moved = moveCircle(guard, (dx / distance) * step, (dy / distance) * step, GUARD.radius, blockers);
  guard.moving = moved > 0.05;
  guard.stepPhase += moved;
  return moved;
}

function nearestWaypoint(guard) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < guard.path.length; i += 1) {
    const distance = distanceBetween(guard.x, guard.y, guard.path[i].x, guard.path[i].y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

function backToPatrol(guard) {
  guard.state = 'patrol';
  guard.targetIndex = nearestWaypoint(guard);
  guard.pause = 0;
  guard.pauseAtStart = false;
  guard.scanT = 0;
  const target = guard.path[guard.targetIndex];
  guard.baseAngle = angleTo(guard.x, guard.y, target.x, target.y);
}

/** Called by world.js when a thrown coin lands: every butler near enough comes to look. */
export function hearCoin(world, x, y) {
  for (const guard of world.guards) {
    const distance = distanceBetween(guard.x, guard.y, x, y);
    if (distance > GUARD.hearing) continue;
    const alreadyCloser =
      guard.state === 'investigate' && distanceBetween(guard.x, guard.y, guard.investigateX, guard.investigateY) <= distance;
    if (alreadyCloser) continue;
    guard.state = 'investigate';
    guard.investigateX = x;
    guard.investigateY = y;
    guard.searchTimer = 0;
    guard.stuck = 0;
    guard.pause = 0;
    guard.baseAngle = angleTo(guard.x, guard.y, x, y);
  }
}

export function updateGuard(world, guard, dt) {
  const blockers = blockersOf(world.level);
  const dtSafe = Math.min(dt, 1 / 30);
  if (guard.state === 'investigate') {
    const distance = distanceBetween(guard.x, guard.y, guard.investigateX, guard.investigateY);
    if (distance < 18) {
      guard.state = 'search';
      guard.searchTimer = GUARD.searchTime;
      guard.scanT = 0;
      guard.baseAngle = guard.angle;
      guard.moving = false;
      return;
    }
    const moved = walkToward(guard, guard.investigateX, guard.investigateY, GUARD.investigateSpeed, dtSafe, blockers);
    const expected = GUARD.investigateSpeed * dtSafe;
    if (moved < expected * 0.3) guard.stuck += dtSafe;
    else guard.stuck = 0;
    if (guard.stuck > 1.1) backToPatrol(guard);
    return;
  }
  if (guard.state === 'search') {
    guard.searchTimer -= dtSafe;
    guard.scanT += dtSafe;
    guard.angle = normalizeAngle(guard.baseAngle + Math.sin(guard.scanT * 1.9) * GUARD.searchArc);
    guard.moving = false;
    if (guard.searchTimer <= 0) backToPatrol(guard);
    return;
  }

  // Patrol: sweep at a corner, otherwise stride toward the next waypoint.
  if (guard.pause > 0) {
    guard.pause -= dtSafe;
    guard.scanT += dtSafe;
    guard.angle = normalizeAngle(guard.baseAngle + Math.sin(guard.scanT * 1.35) * GUARD.scanArc);
    guard.moving = false;
    if (guard.pause <= 0) {
      if (guard.pauseAtStart) guard.pauseAtStart = false;
      else guard.targetIndex = (guard.targetIndex + 1) % guard.path.length;
      const next = guard.path[guard.targetIndex];
      guard.baseAngle = angleTo(guard.x, guard.y, next.x, next.y);
      guard.scanT = 0;
    }
    return;
  }

  const target = guard.path[guard.targetIndex];
  const distance = distanceBetween(guard.x, guard.y, target.x, target.y);
  if (distance < 3) {
    guard.x = target.x;
    guard.y = target.y;
    guard.pause = GUARD.pause;
    guard.scanT = 0;
    const next = guard.path[(guard.targetIndex + 1) % guard.path.length];
    guard.baseAngle = angleTo(guard.x, guard.y, next.x, next.y);
    guard.moving = false;
    return;
  }
  walkToward(guard, target.x, target.y, GUARD.speed, dtSafe, blockers);
}

export function updateGuards(world, dt) {
  for (const guard of world.guards) updateGuard(world, guard, dt);
}

/**
 * Who can see the cat right now. Returns the seeing guards with a 0..1 closeness
 * score (1 = right under the torch), and marks guard.seen for the renderer.
 */
export function computeVisibility(world) {
  const cat = world.cat;
  const level = world.level;
  const seen = [];
  for (const guard of world.guards) {
    guard.seen = false;
    guard.closeness = 0;
    const distance = distanceBetween(guard.x, guard.y, cat.x, cat.y);
    if (distance < GUARD.closeSense) {
      guard.seen = true;
      guard.closeness = 1;
      seen.push(guard);
      continue;
    }
    if (cat.hidden) continue;
    if (distance > VISION.range + cat.radius) continue;
    const angleToCat = Math.atan2(cat.y - guard.y, cat.x - guard.x);
    const spread = Math.abs(normalizeAngle(angleToCat - guard.angle));
    const padding = Math.asin(Math.min(1, cat.radius / Math.max(distance, 1)));
    if (spread > VISION.halfAngle + padding) continue;
    if (lineBlocked(level, guard.x, guard.y, cat.x, cat.y)) continue;
    guard.seen = true;
    guard.closeness = Math.max(0, 1 - distance / VISION.range);
    seen.push(guard);
  }
  return seen;
}
