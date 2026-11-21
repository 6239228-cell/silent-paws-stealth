// The three floors of the mansion. Each layout is plain data: solid walls, furniture,
// hiding bushes, two kinds of light patch, the cat's start, the open window, the fish,
// and the waypoint loops each butler walks. Nothing here moves; world.js brings it alive.
//
// Coordinates are stage pixels on the fixed 1280x800 canvas. The HUD covers y 0..80 and
// the north wall starts at y=80, so the whole floor is always in frame.

import { FIELD, HUD_HEIGHT } from './config.js';

/** Outer walls with a gap for the open window on the right-hand wall. */
function outerWalls(windowY, windowH) {
  return [
    { x: 0, y: HUD_HEIGHT, w: FIELD.width, h: 24 },
    { x: 0, y: FIELD.height - 24, w: FIELD.width, h: 24 },
    { x: 0, y: HUD_HEIGHT, w: 24, h: FIELD.height - HUD_HEIGHT },
    { x: FIELD.width - 24, y: HUD_HEIGHT, w: 24, h: windowY - HUD_HEIGHT },
    { x: FIELD.width - 24, y: windowY + windowH, w: 24, h: FIELD.height - windowY - windowH },
  ];
}

function exitOnRight(windowY, windowH) {
  return {
    windowY,
    windowH,
    /** The patch of floor just inside the window: stepping into it ends the level. */
    x: FIELD.width - 62,
    y: windowY + 10,
    w: 62,
    h: windowH - 20,
  };
}

const LEVEL_ONE = {
  id: 1,
  name: 'The Foyer',
  nameCN: '门厅',
  style: 'parquet',
  difficulty: 1,
  intro: 'Two butlers pace the entrance hall. The window above the garden is open.',
  windowY: 600,
  windowH: 100,
  walls: [
    ...outerWalls(600, 100),
    { x: 360, y: 104, w: 24, h: 216 },
    { x: 360, y: 320, w: 240, h: 24 },
    { x: 680, y: 380, w: 240, h: 24 },
    { x: 936, y: 420, w: 24, h: 200 },
    { x: 760, y: 104, w: 24, h: 120 },
  ],
  furniture: [
    { x: 120, y: 180, w: 160, h: 84, kind: 'piano' },
    { x: 520, y: 150, w: 190, h: 96, kind: 'table' },
    { x: 540, y: 560, w: 200, h: 64, kind: 'sofa' },
    { x: 100, y: 470, w: 84, h: 150, kind: 'cabinet' },
    { x: 1180, y: 420, w: 56, h: 120, kind: 'bookshelf' },
  ],
  bushes: [
    { x: 560, y: 460, w: 130, h: 90 },
    { x: 250, y: 688, w: 150, h: 82 },
    { x: 1040, y: 640, w: 130, h: 100 },
  ],
  moonlight: [
    { x: 560, y: 700, rx: 190, ry: 78 },
    { x: 980, y: 250, rx: 150, ry: 88 },
    { x: 240, y: 380, rx: 120, ry: 78 },
  ],
  shadows: [
    { x: 880, y: 520, rx: 155, ry: 88 },
    { x: 432, y: 226, rx: 128, ry: 78 },
    { x: 1120, y: 592, rx: 112, ry: 72 },
  ],
  playerStart: { x: 110, y: 700 },
  exit: exitOnRight(600, 100),
  coins: 4,
  fish: [
    { x: 640, y: 292 },
    { x: 1108, y: 690 },
  ],
  guards: [
    {
      name: 'Bates',
      path: [
        { x: 200, y: 660 },
        { x: 200, y: 440 },
        { x: 900, y: 440 },
        { x: 900, y: 660 },
      ],
    },
    {
      name: 'Wickham',
      path: [
        { x: 880, y: 220 },
        { x: 1200, y: 220 },
        { x: 1200, y: 360 },
        { x: 880, y: 360 },
      ],
    },
  ],
};

const LEVEL_TWO = {
  id: 2,
  name: 'The Gallery',
  nameCN: '画廊',
  style: 'marble',
  difficulty: 2,
  intro: 'Portraits watch from the walls. Three butlers now, and fewer places to hide.',
  windowY: 560,
  windowH: 100,
  walls: [
    ...outerWalls(560, 100),
    { x: 300, y: 104, w: 24, h: 180 },
    { x: 300, y: 284, w: 260, h: 24 },
    { x: 560, y: 180, w: 24, h: 128 },
    { x: 800, y: 360, w: 240, h: 24 },
    { x: 800, y: 180, w: 24, h: 204 },
    { x: 1040, y: 384, w: 24, h: 250 },
    { x: 620, y: 600, w: 24, h: 176 },
  ],
  furniture: [
    { x: 90, y: 150, w: 150, h: 70, kind: 'piano' },
    { x: 390, y: 385, w: 160, h: 80, kind: 'table' },
    { x: 720, y: 560, w: 180, h: 60, kind: 'sofa' },
    { x: 1100, y: 200, w: 90, h: 100, kind: 'cabinet' },
    { x: 940, y: 180, w: 60, h: 60, kind: 'statue' },
    { x: 430, y: 650, w: 160, h: 44, kind: 'bench' },
  ],
  bushes: [
    { x: 200, y: 620, w: 130, h: 100 },
    { x: 640, y: 240, w: 120, h: 80 },
    { x: 880, y: 520, w: 130, h: 90 },
    { x: 1090, y: 640, w: 110, h: 80 },
  ],
  moonlight: [
    { x: 360, y: 560, rx: 160, ry: 90 },
    { x: 980, y: 300, rx: 150, ry: 100 },
    { x: 1120, y: 700, rx: 120, ry: 70 },
  ],
  shadows: [
    { x: 520, y: 230, rx: 140, ry: 80 },
    { x: 720, y: 620, rx: 150, ry: 90 },
    { x: 250, y: 120, rx: 120, ry: 70 },
  ],
  playerStart: { x: 120, y: 710 },
  exit: exitOnRight(560, 100),
  coins: 3,
  fish: [
    { x: 500, y: 355 },
    { x: 1150, y: 600 },
  ],
  guards: [
    {
      name: 'Bates',
      path: [
        { x: 110, y: 580 },
        { x: 110, y: 380 },
        { x: 260, y: 380 },
        { x: 260, y: 580 },
      ],
    },
    {
      name: 'Wickham',
      path: [
        { x: 360, y: 340 },
        { x: 740, y: 340 },
        { x: 740, y: 480 },
        { x: 360, y: 480 },
      ],
    },
    {
      name: 'Pryce',
      path: [
        { x: 900, y: 700 },
        { x: 1200, y: 700 },
        { x: 1200, y: 650 },
        { x: 900, y: 650 },
      ],
    },
  ],
};

const LEVEL_THREE = {
  id: 3,
  name: 'The Ballroom',
  nameCN: '舞厅',
  style: 'ballroom',
  difficulty: 3,
  intro: 'Four butlers sweep the ballroom floor. Cross it without a single glance.',
  windowY: 620,
  windowH: 100,
  walls: [
    ...outerWalls(620, 100),
    { x: 240, y: 400, w: 24, h: 376 },
    { x: 240, y: 400, w: 320, h: 24 },
    { x: 600, y: 104, w: 24, h: 240 },
    { x: 600, y: 320, w: 300, h: 24 },
    { x: 900, y: 344, w: 24, h: 220 },
    { x: 980, y: 600, w: 200, h: 24 },
  ],
  furniture: [
    { x: 340, y: 180, w: 80, h: 80, kind: 'statue' },
    { x: 720, y: 180, w: 80, h: 80, kind: 'statue' },
    { x: 340, y: 500, w: 80, h: 80, kind: 'statue' },
    { x: 760, y: 480, w: 80, h: 80, kind: 'statue' },
    { x: 1050, y: 180, w: 150, h: 64, kind: 'sofa' },
    { x: 1000, y: 380, w: 160, h: 100, kind: 'table' },
    { x: 80, y: 500, w: 140, h: 90, kind: 'piano' },
    { x: 1100, y: 500, w: 100, h: 80, kind: 'cabinet' },
  ],
  bushes: [
    { x: 200, y: 620, w: 130, h: 90 },
    { x: 560, y: 460, w: 120, h: 80 },
    { x: 880, y: 660, w: 120, h: 80 },
    { x: 1120, y: 700, w: 110, h: 60 },
  ],
  moonlight: [
    { x: 400, y: 360, rx: 180, ry: 90 },
    { x: 760, y: 650, rx: 160, ry: 90 },
    { x: 1180, y: 300, rx: 110, ry: 80 },
    { x: 150, y: 590, rx: 110, ry: 70 },
  ],
  shadows: [
    { x: 520, y: 120, rx: 150, ry: 80 },
    { x: 900, y: 480, rx: 150, ry: 90 },
    { x: 1230, y: 650, rx: 100, ry: 100 },
  ],
  playerStart: { x: 150, y: 430 },
  exit: exitOnRight(620, 100),
  coins: 3,
  fish: [
    { x: 840, y: 590 },
    { x: 1100, y: 725 },
  ],
  guards: [
    {
      name: 'Bates',
      path: [
        { x: 100, y: 140 },
        { x: 520, y: 140 },
        { x: 520, y: 280 },
        { x: 100, y: 280 },
      ],
    },
    {
      name: 'Wickham',
      path: [
        { x: 300, y: 460 },
        { x: 540, y: 460 },
        { x: 540, y: 600 },
        { x: 300, y: 600 },
      ],
    },
    {
      name: 'Pryce',
      path: [
        { x: 660, y: 120 },
        { x: 880, y: 120 },
        { x: 880, y: 280 },
        { x: 660, y: 280 },
      ],
    },
    {
      name: 'Hollis',
      path: [
        { x: 980, y: 660 },
        { x: 1230, y: 660 },
        { x: 1230, y: 760 },
        { x: 980, y: 760 },
      ],
    },
  ],
};

export const LEVELS = [LEVEL_ONE, LEVEL_TWO, LEVEL_THREE];

/** Total fish hidden across the whole campaign, for the HUD counter. */
export const FISH_TOTAL = LEVELS.reduce((sum, level) => sum + level.fish.length, 0);

/** Everything solid to the cat: outer walls, inner walls and furniture. Bushes are walk-through. */
export function blockersOf(level) {
  if (!level.blockers) level.blockers = level.walls.concat(level.furniture);
  return level.blockers;
}
