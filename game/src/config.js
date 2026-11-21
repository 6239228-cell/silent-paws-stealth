// Silent Paws — every tuning number and colour lives here.
// The world is a fixed 1280x800 stage; the renderer scales it to the window, so no
// rule below ever depends on the size of the screen.

export const FIELD = { width: 1280, height: 800 };

/** The HUD band painted over the top of the stage; the mansion's north wall sits just under it. */
export const HUD_HEIGHT = 80;

/** The simulation runs at a fixed 60 updates a second. */
export const STEP = 1 / 60;

export const CAT = {
  radius: 13,
  speed: 236,
  bushSpeed: 0.68,
  turn: 16,
  startAlert: 0,
};

export const GUARD = {
  radius: 12,
  speed: 64,
  pause: 1.6,
  turn: 3.4,
  investigateSpeed: 104,
  searchTime: 2.4,
  hearing: 300,
  closeSense: 26,
  scanArc: 0.42,
  searchArc: 1.0,
  /** Distance a butler's shoes travel between two audible steps (also used for the walk bob). */
  stride: 46,
};

export const VISION = {
  /** How far a cone reaches, in pixels. Full map, no scrolling camera. */
  range: 252,
  /** Half the cone's opening angle, in radians. */
  halfAngle: 0.44,
  /** Rays used to clip the drawn cone against the furniture. */
  rays: 26,
};

export const ALERT = {
  max: 100,
  /** Alert per second while a butler has a clear view, before distance and light are applied. */
  riseBase: 40,
  /** Extra alert per second at point-blank range. */
  riseProximity: 88,
  /** How fast the meter cools once the cat is out of sight. */
  fall: 30,
  spotCooldown: 2.6,
};

export const COIN = {
  radius: 8,
  speed: 660,
  flightMin: 0.34,
  flightMax: 0.82,
  /** A landing coin is heard by every butler inside this radius. */
  noise: 300,
};

export const LIGHT = {
  /** Moonlit ground is safer: the cat's pale coat blends into the wash of light. */
  moonMultiplier: 0.62,
  /** Deep shadow is dangerous: the cat stands out against the dark floor. */
  shadowMultiplier: 1.35,
};

export const SCORE = {
  fish: 150,
  clearBase: 200,
  clearTimeMax: 420,
  clearTimeRate: 4,
  stealthClear: 180,
  stealthPartial: 90,
  win: 500,
};

export const COLORS = {
  backdrop: '#05080f',
  floor: '#101b31',
  floorAlt: '#14213c',
  floorLine: 'rgba(64, 92, 138, 0.40)',
  floorSpec: 'rgba(150, 190, 255, 0.12)',
  wall: '#2a3552',
  wallTop: '#46577f',
  wallDark: '#151e33',
  wallTrim: '#5b6f9e',
  shadow: 'rgba(8, 5, 16, 0.55)',
  bushDark: '#164a35',
  bush: '#1e6b4a',
  bushLight: '#2f9163',
  bushRim: '#0f3a29',
  catFur: '#e2dccc',
  catFurDark: '#b9b2a2',
  catStripe: '#4a4a5c',
  catEye: '#9dffb0',
  guardCoat: '#1b2338',
  guardCoatLight: '#2b3654',
  guardShirt: '#e8e5d8',
  guardSkin: '#d7a77c',
  guardHair: '#211a1c',
  guardGold: '#c9a957',
  cone: '#ffd45e',
  coneHot: '#ff8146',
  exit: '#ffe9a3',
  moon: 'rgba(150, 198, 255, 0.16)',
  danger: 'rgba(150, 42, 74, 0.20)',
  hud: 'rgba(6, 11, 22, 0.90)',
  hudLine: 'rgba(90, 118, 165, 0.45)',
  text: '#eef3ff',
  muted: '#8fa2c4',
  gold: '#f2c94c',
  red: '#f2544b',
  amber: '#f6a94a',
  green: '#68d391',
  panel: 'rgba(7, 13, 26, 0.94)',
  panelEdge: 'rgba(148, 178, 232, 0.28)',
  overlay: 'rgba(3, 6, 13, 0.60)',
};

export const FONT = {
  ui: '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif',
  title: 'Georgia, "Times New Roman", serif',
};

/** Best score is remembered in this browser only. */
export const BEST_KEY = 'silent-paws.best';
