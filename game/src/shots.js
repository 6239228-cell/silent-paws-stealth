// The four staged screenshots. Each scene starts from a fresh world, arranges the
// scripted mid-level state described below, and then advances the SAME stepWorld /
// stepAmbient rules the player runs. Nothing is painted that the rules did not produce:
// the alert values, caught state, bonuses and score are all earned by simulation.
//
// ?seed= reaches the world's decorative dust and never changes the choreography.

import { STEP } from './config.js';
import {
  awardLevelClear,
  enterLevel,
  startCampaign,
  stepAmbient,
  stepWorld,
} from './world.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_WIN } from './render.js';

function idleAmbient(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepAmbient(world, STEP);
}

/** Park a guard on a held pose so a screenshot can frame a deliberate moment. */
function poseGuard(guard, x, y, angle, sweepPause = 30) {
  guard.x = x;
  guard.y = y;
  guard.angle = angle;
  guard.baseAngle = angle;
  guard.scanT = 0;
  guard.state = 'pause';
  guard.pause = sweepPause;
  guard.moving = false;
  guard.stuck = 0;
}

/** 1 — cover: level 1, cat beside the central bush, both butlers' cones in frame. */
function stageCover(world) {
  startCampaign(world);
  poseGuard(world.guards[0], 470, 440, 0, 40);
  poseGuard(world.guards[1], 1120, 250, Math.PI / 2, 40);
  // Left of the bush and below the nearest cone's sweep, so the HUD's "Unseen" is
  // earned by the same visibility test the player faces.
  world.cat.x = 518;
  world.cat.y = 560;
  world.cat.facing = 0.2;
  world.alert = 0;
  world.visible = false;
  for (let i = 0; i < Math.round(0.6 / STEP); i += 1) {
    stepWorld(world, STEP, { direction: { x: 0, y: 0 } });
  }
  return { screen: SCREEN_PLAY };
}

/** 2 — play: level 2, a butler above the cat, alert near 55, cone edge a hair away. */
function stagePlay(world) {
  startCampaign(world);
  enterLevel(world, 1);
  const butler = world.guards[1];
  poseGuard(butler, 740, 310, Math.PI / 2, 40);
  butler.targetIndex = 2;
  world.cat.x = 740;
  world.cat.y = 440;
  world.cat.facing = -Math.PI / 2;

  let guard = 0;
  while (world.alert < 55 && guard < Math.round(4 / STEP)) {
    stepWorld(world, STEP, { direction: { x: 0, y: 0 } });
    guard += 1;
  }
  // The cat slips sideways, just clear of the cone's edge: a real near miss.
  world.cat.x -= 84;
  world.cat.facing = Math.PI;
  butler.scanT = 0;
  butler.angle = Math.PI / 2;
  stepWorld(world, STEP, { direction: { x: 0, y: 0 } });
  return { screen: SCREEN_PLAY };
}

/** 3 — caught: the cat stands in a cone until the meter fills. */
function stageCaught(world) {
  startCampaign(world);
  world.cat.x = 330;
  world.cat.y = 660;
  world.cat.facing = Math.PI;
  poseGuard(world.guards[0], 200, 660, 0, 40);
  let guard = 0;
  while (!world.caught && guard < Math.round(4 / STEP)) {
    stepWorld(world, STEP, { direction: { x: 0, y: 0 } });
    guard += 1;
  }
  poseGuard(world.guards[0], 200, 660, 0, 40);
  return { screen: SCREEN_CAUGHT };
}

/**
 * 4 — win: stage the whole campaign through its real scoring. Each floor is given a
 * plausible amount of patrol time, its fish are picked up by the real pickup rule, then
 * the cat steps into the window. Level bonuses and the final score come from the game.
 */
function stageWin(world) {
  startCampaign(world);
  const floorSeconds = [62, 78, 95];
  for (let floor = 0; floor < 3; floor += 1) {
    idleAmbient(world, floorSeconds[floor]);
    for (const fish of world.fish) {
      world.cat.x = fish.x;
      world.cat.y = fish.y;
      stepWorld(world, STEP, { direction: { x: 0, y: 0 } });
      stepWorld(world, STEP, { direction: { x: 0, y: 0 } });
    }
    const exit = world.level.exit;
    world.cat.x = exit.x + 4;
    world.cat.y = exit.y + exit.h / 2;
    world.cat.facing = 0;
    for (let i = 0; i < 6 && !world.cleared; i += 1) {
      stepWorld(world, STEP, { direction: { x: 0, y: 0 } });
    }
    awardLevelClear(world);
    if (floor < 2) {
      enterLevel(world, floor + 1);
    }
  }
  const exit = world.level.exit;
  world.cat.x = exit.x - 8;
  world.cat.y = exit.y + exit.h / 2;
  world.cat.facing = 0;
  return { screen: SCREEN_WIN };
}

/**
 * Stage shot `name` ("1".."4") in place and return the screen to draw over it.
 * The passed world is reused so the renderer keeps its canvas and seed.
 */
export function stageShot(name, world) {
  switch (name) {
    case '1':
      return stageCover(world);
    case '2':
      return stagePlay(world);
    case '3':
      return stageCaught(world);
    case '4':
      return stageWin(world);
    default:
      return stageCover(world);
  }
}
