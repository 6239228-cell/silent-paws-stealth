// All drawing. The renderer takes the current world and screen and paints one frame:
// parquet floors, moonbeams, clipped torch cones, butlers, a cat, and the HUD and
// overlay panels. Art is pure canvas shapes — no images, no fonts, no network.

import { ALERT, COLORS, FIELD, FONT, GUARD, HUD_HEIGHT, VISION } from './config.js';
import { visionPolygon } from './guards.js';
import { formatTime } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

function roundRectPath(context, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16));
  const mixed = pa.map((value, i) => Math.round(value + (pb[i] - value) * t));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function alertColour(value) {
  if (value < 50) return mixHex(COLORS.green, COLORS.amber, value / 50);
  return mixHex(COLORS.amber, COLORS.red, (value - 50) / 50);
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const bushCache = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.dpr = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, colour, options = {}) {
    context.save();
    context.font = `${options.weight ?? 'normal'} ${size}px ${options.font ?? FONT.ui}`;
    context.fillStyle = colour;
    context.textAlign = options.align ?? 'left';
    context.textBaseline = options.baseline ?? 'alphabetic';
    context.globalAlpha = options.alpha ?? 1;
    if (options.shadow) {
      context.shadowColor = options.shadow;
      context.shadowBlur = options.shadowBlur ?? 18;
    }
    if (options.letterSpacing) {
      const chars = [...String(value)];
      const widths = chars.map((char) => context.measureText(char).width);
      const total = widths.reduce((sum, width) => sum + width, 0) + options.letterSpacing * Math.max(0, chars.length - 1);
      let cursor = options.align === 'center' ? x - total / 2 : options.align === 'right' ? x - total : x;
      for (let i = 0; i < chars.length; i += 1) {
        context.fillText(chars[i], cursor, y);
        cursor += widths[i] + options.letterSpacing;
      }
    } else {
      context.fillText(String(value), x, y);
    }
    context.restore();
  }

  function panel(x, y, w, h, accent = COLORS.gold) {
    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.65)';
    context.shadowBlur = 30;
    context.shadowOffsetY = 12;
    roundRectPath(context, x, y, w, h, 14);
    context.fillStyle = COLORS.panel;
    context.fill();
    context.restore();

    roundRectPath(context, x, y, w, h, 14);
    context.strokeStyle = COLORS.panelEdge;
    context.lineWidth = 1.5;
    context.stroke();

    context.save();
    context.strokeStyle = accent;
    context.globalAlpha = 0.55;
    context.lineWidth = 2;
    const inset = 8;
    const corner = 26;
    const corners = [
      [x + inset, y + inset, 1, 1],
      [x + w - inset, y + inset, -1, 1],
      [x + inset, y + h - inset, 1, -1],
      [x + w - inset, y + h - inset, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      context.beginPath();
      context.moveTo(cx + sx * corner, cy);
      context.lineTo(cx, cy);
      context.lineTo(cx, cy + sy * corner);
      context.stroke();
    }
    context.restore();
  }

  function ellipse(x, y, rx, ry, colour, rotation = 0) {
    context.beginPath();
    context.ellipse(x, y, rx, ry, rotation, 0, TAU);
    context.fillStyle = colour;
    context.fill();
  }

  // ---------------------------------------------------------------- floor

  function drawFloor(world) {
    const level = world.level;
    const top = HUD_HEIGHT;
    context.fillStyle = COLORS.floor;
    context.fillRect(0, top, FIELD.width, FIELD.height - top);

    if (level.style === 'parquet') {
      const rowHeight = 46;
      for (let row = 0; row < 16; row += 1) {
        const y = top + row * rowHeight;
        if (row % 2 === 0) {
          context.fillStyle = 'rgba(255, 255, 255, 0.014)';
          context.fillRect(0, y, FIELD.width, rowHeight);
        }
        context.strokeStyle = COLORS.floorLine;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(FIELD.width, y);
        context.stroke();
        const offset = row % 3 === 0 ? 0 : 160;
        for (let x = offset; x < FIELD.width; x += 320) {
          context.strokeStyle = 'rgba(38, 60, 96, 0.28)';
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x, y + rowHeight);
          context.stroke();
        }
      }
    } else if (level.style === 'marble') {
      const tile = 156;
      for (let row = 0; row * tile < FIELD.height - top; row += 1) {
        for (let col = 0; col * tile < FIELD.width; col += 1) {
          const x = col * tile;
          const y = top + row * tile;
          if ((row + col) % 2 === 0) {
            context.fillStyle = 'rgba(210, 228, 255, 0.018)';
            context.fillRect(x, y, tile, tile);
          }
          context.strokeStyle = 'rgba(52, 76, 116, 0.26)';
          context.lineWidth = 1;
          context.strokeRect(x + 0.5, y + 0.5, tile, tile);
          const seed = (row * 31 + col * 17 + level.id * 7) % 11;
          if (seed < 3) {
            context.strokeStyle = 'rgba(160, 190, 235, 0.05)';
            context.beginPath();
            context.moveTo(x + 18 + seed * 12, y + 8);
            context.quadraticCurveTo(x + 70, y + 50 + seed * 6, x + 130, y + 92);
            context.stroke();
          }
        }
      }
    } else {
      const tile = 120;
      for (let row = 0; row * tile < FIELD.height - top; row += 1) {
        for (let col = 0; col * tile < FIELD.width; col += 1) {
          const x = col * tile;
          const y = top + row * tile;
          context.fillStyle = (row + col) % 2 === 0 ? 'rgba(214, 230, 255, 0.022)' : 'rgba(4, 10, 22, 0.10)';
          context.fillRect(x, y, tile, tile);
          context.strokeStyle = 'rgba(56, 78, 118, 0.22)';
          context.strokeRect(x + 0.5, y + 0.5, tile, tile);
        }
      }
      // A big faded dance medallion in the middle of the ballroom.
      context.save();
      context.translate(640, 430);
      context.strokeStyle = 'rgba(190, 160, 92, 0.16)';
      context.lineWidth = 2;
      for (let ring = 1; ring <= 4; ring += 1) {
        context.beginPath();
        context.ellipse(0, 0, ring * 62, ring * 40, 0, 0, TAU);
        context.stroke();
      }
      context.rotate(Math.PI / 8);
      for (let spoke = 0; spoke < 8; spoke += 1) {
        context.rotate(TAU / 8);
        context.beginPath();
        context.moveTo(58, 0);
        context.lineTo(250, 0);
        context.stroke();
      }
      context.restore();
    }

    // A worn rug, drawn only where the layout wants one.
    if (level.style === 'parquet') {
      context.save();
      roundRectPath(context, 468, 512, 336, 148, 10);
      context.fillStyle = 'rgba(78, 30, 42, 0.55)';
      context.fill();
      context.strokeStyle = 'rgba(190, 145, 88, 0.35)';
      context.lineWidth = 3;
      context.stroke();
      roundRectPath(context, 482, 524, 308, 124, 6);
      context.strokeStyle = 'rgba(190, 145, 88, 0.22)';
      context.lineWidth = 1.5;
      context.stroke();
      context.restore();
    } else if (level.style === 'marble') {
      context.save();
      roundRectPath(context, 500, 330, 470, 110, 8);
      context.fillStyle = 'rgba(60, 34, 48, 0.45)';
      context.fill();
      context.strokeStyle = 'rgba(200, 164, 100, 0.28)';
      context.lineWidth = 2;
      context.stroke();
      context.restore();
    }

    // Dust that always sits in the same place for a seed.
    for (const speck of world.decor.specks) {
      const twinkle = 0.55 + 0.45 * Math.sin(world.levelTime * 0.7 + speck.phase);
      context.globalAlpha = speck.alpha * twinkle;
      context.fillStyle = COLORS.floorSpec;
      context.beginPath();
      context.arc(speck.x, speck.y, speck.radius, 0, TAU);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- light

  function drawShadowPatches(world) {
    for (const patch of world.level.shadows) {
      context.save();
      context.translate(patch.x, patch.y);
      const gradient = context.createRadialGradient(0, 0, 4, 0, 0, patch.rx);
      gradient.addColorStop(0, 'rgba(92, 16, 44, 0.30)');
      gradient.addColorStop(0.62, 'rgba(78, 14, 40, 0.18)');
      gradient.addColorStop(1, 'rgba(78, 14, 40, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(0, 0, patch.rx, patch.ry, 0, 0, TAU);
      context.fill();
      context.strokeStyle = 'rgba(220, 96, 130, 0.10)';
      context.lineWidth = 1.5;
      context.setLineDash([10, 9]);
      context.beginPath();
      context.ellipse(0, 0, patch.rx * 0.92, patch.ry * 0.92, 0, 0, TAU);
      context.stroke();
      context.setLineDash([]);
      context.restore();
    }
  }

  function drawMoonlight(world) {
    for (const patch of world.level.moonlight) {
      context.save();
      const gradient = context.createRadialGradient(patch.x, patch.y, 6, patch.x, patch.y, patch.rx);
      gradient.addColorStop(0, 'rgba(168, 208, 255, 0.20)');
      gradient.addColorStop(0.55, 'rgba(134, 182, 245, 0.12)');
      gradient.addColorStop(1, 'rgba(120, 170, 240, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(patch.x, patch.y, patch.rx, patch.ry, 0, 0, TAU);
      context.fill();
      context.strokeStyle = 'rgba(186, 220, 255, 0.14)';
      context.lineWidth = 1.2;
      context.beginPath();
      context.ellipse(patch.x, patch.y, patch.rx * 0.9, patch.ry * 0.9, 0, 0, TAU);
      context.stroke();
      // Slow drifting motes inside the beam.
      for (let mote = 0; mote < 5; mote += 1) {
        const angle = world.levelTime * 0.22 + mote * 1.6;
        const mx = patch.x + Math.cos(angle) * patch.rx * 0.45;
        const my = patch.y + Math.sin(angle * 0.8) * patch.ry * 0.5;
        context.globalAlpha = 0.18 + 0.12 * Math.sin(world.levelTime * 1.3 + mote);
        context.fillStyle = '#dbeaff';
        context.beginPath();
        context.arc(mx, my, 1.5, 0, TAU);
        context.fill();
      }
      context.restore();
    }
  }

  function drawExit(world) {
    const exit = world.level.exit;
    const wy = exit.windowY;
    const wh = exit.windowH;
    const cy = wy + wh / 2;
    const pulse = 0.75 + 0.25 * Math.sin(world.levelTime * 2.2);

    // Light spilling from the open window across the floor.
    const beam = context.createLinearGradient(1240, cy, 900, cy);
    beam.addColorStop(0, `rgba(255, 234, 166, ${0.30 * pulse})`);
    beam.addColorStop(0.5, `rgba(214, 228, 255, ${0.10 * pulse})`);
    beam.addColorStop(1, 'rgba(190, 210, 255, 0)');
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(1244, wy + 4);
    context.lineTo(900, wy - 84);
    context.lineTo(900, wy + wh + 84);
    context.lineTo(1244, wy + wh - 4);
    context.closePath();
    context.fill();

    const glow = context.createRadialGradient(1248, cy, 8, 1248, cy, 185);
    glow.addColorStop(0, `rgba(255, 240, 180, ${0.42 * pulse})`);
    glow.addColorStop(0.5, 'rgba(214, 230, 255, 0.13)');
    glow.addColorStop(1, 'rgba(190, 210, 255, 0)');
    context.fillStyle = glow;
    context.fillRect(1040, wy - 190, 240, wh + 380);

    // Curtain draped on the left side of the opening.
    context.fillStyle = 'rgba(96, 30, 46, 0.94)';
    context.beginPath();
    context.moveTo(1222, wy + 2);
    context.quadraticCurveTo(1206, wy + wh * 0.3, 1218, wy + wh * 0.52);
    context.quadraticCurveTo(1204, wy + wh * 0.78, 1226, wy + wh - 2);
    context.lineTo(1238, wy + wh - 6);
    context.lineTo(1236, wy + 4);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(206, 158, 96, 0.35)';
    context.lineWidth = 1.5;
    context.stroke();

    // The opened casement, swung into the room.
    context.beginPath();
    context.moveTo(1244, wy + 4);
    context.lineTo(1207, wy - 6);
    context.lineTo(1207, wy + wh + 6);
    context.lineTo(1244, wy + wh - 4);
    context.closePath();
    context.fillStyle = 'rgba(205, 226, 255, 0.18)';
    context.fill();
    context.strokeStyle = 'rgba(224, 196, 132, 0.8)';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = 'rgba(205, 226, 255, 0.42)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(1212, wy + 2);
    context.lineTo(1212, wy + wh - 2);
    context.stroke();

    // Window frame and glass, set into the wall gap.
    roundRectPath(context, 1238, wy - 4, 44, wh + 8, 3);
    context.fillStyle = '#3c2d26';
    context.fill();
    context.strokeStyle = 'rgba(222, 188, 120, 0.8)';
    context.lineWidth = 2;
    context.stroke();

    const glass = context.createLinearGradient(1246, wy, 1278, wy + wh);
    glass.addColorStop(0, '#f2f8ff');
    glass.addColorStop(0.5, '#c5ddff');
    glass.addColorStop(1, '#fbe9ae');
    context.fillStyle = glass;
    context.fillRect(1246, wy + 2, 30, wh - 4);
    context.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let pane = 0; pane < 3; pane += 1) {
      const py = wy + 8 + pane * ((wh - 16) / 3);
      context.fillRect(1248, py, 26, 1.5);
    }
    context.fillStyle = 'rgba(90, 62, 44, 0.9)';
    context.fillRect(1260, wy + 2, 2, wh - 4);

    // Sill and a gold handle for the open leaf.
    context.fillStyle = '#4a372b';
    context.fillRect(1202, wy + wh - 10, 46, 8);
    context.fillStyle = 'rgba(226, 194, 126, 0.85)';
    context.fillRect(1202, wy + wh - 10, 46, 2);
    context.beginPath();
    context.arc(1216, cy, 3, 0, TAU);
    context.fillStyle = COLORS.guardGold;
    context.fill();

    // A shimmer sliding down the glass.
    const shimmer = wy + ((world.levelTime * 34) % (wh + 30));
    context.fillStyle = 'rgba(255, 255, 255, 0.30)';
    context.fillRect(1248, shimmer, 26, 2);

    text('EXIT', 1240, wy - 15, 11, 'rgba(255, 234, 170, 0.95)', {
      align: 'right',
      letterSpacing: 1.4,
      weight: 'bold',
    });
  }

  // ---------------------------------------------------------------- cones

  function drawCones(world) {
    const level = world.level;
    for (const guard of world.guards) {
      const points = visionPolygon(level, guard);
      const hot = guard.seen;
      context.save();
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
      context.closePath();
      context.clip();
      const gradient = context.createRadialGradient(guard.x, guard.y, 8, guard.x, guard.y, VISION.range);
      if (hot) {
        gradient.addColorStop(0, 'rgba(255, 146, 72, 0.58)');
        gradient.addColorStop(0.45, 'rgba(255, 122, 60, 0.30)');
        gradient.addColorStop(1, 'rgba(255, 96, 40, 0.03)');
      } else {
        gradient.addColorStop(0, 'rgba(255, 226, 120, 0.54)');
        gradient.addColorStop(0.45, 'rgba(255, 214, 96, 0.27)');
        gradient.addColorStop(1, 'rgba(255, 200, 80, 0.035)');
      }
      context.fillStyle = gradient;
      context.fillRect(guard.x - VISION.range, guard.y - VISION.range, VISION.range * 2, VISION.range * 2);
      context.restore();

      context.save();
      context.strokeStyle = hot ? 'rgba(255, 150, 90, 0.42)' : 'rgba(255, 222, 120, 0.34)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) context.lineTo(points[i].x, points[i].y);
      context.closePath();
      context.stroke();
      context.restore();
    }
  }

  // ---------------------------------------------------------------- masonry

  function drawWall(wall) {
    context.fillStyle = 'rgba(0, 0, 0, 0.42)';
    context.fillRect(wall.x + 4, wall.y + 6, wall.w, wall.h);
    context.fillStyle = COLORS.wall;
    context.fillRect(wall.x, wall.y, wall.w, wall.h);
    context.fillStyle = COLORS.wallTop;
    context.fillRect(wall.x, wall.y, wall.w, 3);
    context.fillRect(wall.x, wall.y, 3, wall.h);
    context.fillStyle = COLORS.wallDark;
    context.fillRect(wall.x, wall.y + wall.h - 3, wall.w, 3);
    context.fillRect(wall.x + wall.w - 3, wall.y, 3, wall.h);

    if (wall.w > 30) {
      context.strokeStyle = 'rgba(84, 104, 148, 0.20)';
      context.lineWidth = 1;
      for (let x = wall.x + 20; x < wall.x + wall.w - 6; x += 26) {
        context.beginPath();
        context.moveTo(x, wall.y + 4);
        context.lineTo(x, wall.y + wall.h - 4);
        context.stroke();
      }
    }
    context.strokeStyle = 'rgba(120, 146, 200, 0.22)';
    context.lineWidth = 1;
    context.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
  }

  function drawWalls(world) {
    for (const wall of world.level.walls) drawWall(wall);
  }

  // ---------------------------------------------------------------- furniture

  function drawFurniture(item) {
    const { x, y, w, h, kind } = item;
    context.save();
    context.fillStyle = 'rgba(0, 0, 0, 0.42)';
    roundRectPath(context, x + 4, y + 6, w, h, 6);
    context.fill();
    context.restore();

    if (kind === 'piano') {
      roundRectPath(context, x, y, w, h, 7);
      context.fillStyle = '#151720';
      context.fill();
      context.strokeStyle = 'rgba(210, 180, 120, 0.28)';
      context.lineWidth = 1.5;
      context.stroke();
      context.fillStyle = '#e8e2d2';
      context.fillRect(x + 10, y + h - 18, w - 20, 9);
      context.strokeStyle = 'rgba(30, 30, 40, 0.9)';
      context.lineWidth = 1;
      for (let key = 0; key < 12; key += 1) {
        const kx = x + 12 + (key * (w - 24)) / 12;
        context.beginPath();
        context.moveTo(kx, y + h - 18);
        context.lineTo(kx, y + h - 9);
        context.stroke();
      }
      context.fillStyle = 'rgba(240, 240, 255, 0.10)';
      roundRectPath(context, x + 8, y + 7, w - 16, h * 0.42, 4);
      context.fill();
      context.fillStyle = COLORS.guardGold;
      context.fillRect(x + w / 2 - 22, y + h - 26, 44, 3);
    } else if (kind === 'table') {
      roundRectPath(context, x, y, w, h, 8);
      context.fillStyle = '#5a3d2d';
      context.fill();
      roundRectPath(context, x + 6, y + 6, w - 12, h - 12, 5);
      context.fillStyle = '#6d4b37';
      context.fill();
      context.strokeStyle = 'rgba(38, 24, 16, 0.55)';
      context.lineWidth = 1;
      for (let line = 1; line < 4; line += 1) {
        const ly = y + 10 + (line * (h - 20)) / 4;
        context.beginPath();
        context.moveTo(x + 12, ly);
        context.lineTo(x + w - 12, ly + 2);
        context.stroke();
      }
      const cx = x + w / 2;
      const cy = y + h / 2;
      context.fillStyle = 'rgba(226, 220, 205, 0.9)';
      context.beginPath();
      context.ellipse(cx, cy, 15, 9, 0, 0, TAU);
      context.fill();
      context.strokeStyle = '#3d7a4f';
      context.lineWidth = 2;
      for (let stem = 0; stem < 4; stem += 1) {
        const angle = -Math.PI / 2 + (stem - 1.5) * 0.35;
        context.beginPath();
        context.moveTo(cx, cy);
        context.lineTo(cx + Math.cos(angle) * 18, cy + Math.sin(angle) * 18);
        context.stroke();
        context.fillStyle = stem % 2 === 0 ? '#c95a63' : '#e0b45c';
        context.beginPath();
        context.arc(cx + Math.cos(angle) * 19, cy + Math.sin(angle) * 19, 4, 0, TAU);
        context.fill();
      }
    } else if (kind === 'sofa') {
      roundRectPath(context, x, y, w, h, 10);
      context.fillStyle = '#24434d';
      context.fill();
      roundRectPath(context, x + 4, y + 4, w - 8, h - 14, 7);
      context.fillStyle = '#2f5d66';
      context.fill();
      roundRectPath(context, x + 10, y + 8, w / 2 - 14, h - 22, 5);
      context.fillStyle = '#3b707a';
      context.fill();
      roundRectPath(context, x + w / 2 + 4, y + 8, w / 2 - 14, h - 22, 5);
      context.fillStyle = '#386a74';
      context.fill();
      context.fillStyle = 'rgba(255, 255, 255, 0.08)';
      context.fillRect(x + 10, y + 8, w - 20, 2);
    } else if (kind === 'cabinet') {
      roundRectPath(context, x, y, w, h, 5);
      context.fillStyle = '#4a3328';
      context.fill();
      roundRectPath(context, x + 5, y + 5, w - 10, h - 10, 3);
      context.fillStyle = '#5b4032';
      context.fill();
      context.strokeStyle = 'rgba(30, 20, 14, 0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + w / 2, y + 5);
      context.lineTo(x + w / 2, y + h - 5);
      context.stroke();
      context.fillStyle = COLORS.guardGold;
      for (const side of [-1, 1]) {
        context.beginPath();
        context.arc(x + w / 2 + side * 12, y + h / 2, 3, 0, TAU);
        context.fill();
      }
    } else if (kind === 'bookshelf') {
      roundRectPath(context, x, y, w, h, 4);
      context.fillStyle = '#3a2a21';
      context.fill();
      const colours = ['#8d3b43', '#3f6d6a', '#86643a', '#4a4d7c', '#7d5a88'];
      for (let shelf = 0; shelf < 3; shelf += 1) {
        const sy = y + 8 + shelf * ((h - 14) / 3);
        context.fillStyle = 'rgba(20, 14, 10, 0.55)';
        context.fillRect(x + 6, sy, w - 12, 2);
        for (let book = 0; book < 4; book += 1) {
          const bx = x + 8 + book * ((w - 16) / 4);
          context.fillStyle = colours[(shelf * 3 + book) % colours.length];
          context.fillRect(bx, sy - 16, 7, 15);
        }
      }
    } else if (kind === 'statue') {
      roundRectPath(context, x, y, w, h, 5);
      context.fillStyle = '#4b5064';
      context.fill();
      roundRectPath(context, x + 8, y + 8, w - 16, h - 16, 4);
      context.fillStyle = '#5b6178';
      context.fill();
      context.fillStyle = 'rgba(226, 224, 214, 0.85)';
      context.beginPath();
      context.ellipse(x + w / 2, y + h / 2 + 4, 14, 18, 0, 0, TAU);
      context.fill();
      context.beginPath();
      context.arc(x + w / 2, y + h / 2 - 12, 9, 0, TAU);
      context.fill();
      context.fillStyle = COLORS.guardGold;
      context.fillRect(x + w / 2 - 13, y + h - 10, 26, 2);
    } else if (kind === 'bench') {
      roundRectPath(context, x, y, w, h, 5);
      context.fillStyle = '#6a4a33';
      context.fill();
      context.strokeStyle = 'rgba(40, 26, 18, 0.6)';
      context.lineWidth = 1;
      for (let slat = 1; slat < 3; slat += 1) {
        const sy = y + (slat * h) / 3;
        context.beginPath();
        context.moveTo(x + 6, sy);
        context.lineTo(x + w - 6, sy);
        context.stroke();
      }
    } else {
      roundRectPath(context, x, y, w, h, 6);
      context.fillStyle = '#4c3a2e';
      context.fill();
    }
  }

  function drawFurnitureList(world) {
    for (const item of world.level.furniture) drawFurniture(item);
  }

  // ---------------------------------------------------------------- flora

  function bushBlobs(level, bush, index) {
    const key = `${level.id}-${index}`;
    if (bushCache.has(key)) return bushCache.get(key);
    let state = (bush.x * 73856093) ^ (bush.y * 19349663) ^ (index * 83492791) ^ 0x9e3779b9;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const blobs = [];
    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const angle = random() * TAU;
      const spread = Math.sqrt(random()) * 0.46;
      blobs.push({
        x: bush.w / 2 + Math.cos(angle) * bush.w * spread,
        y: bush.h / 2 + Math.sin(angle) * bush.h * spread,
        r: 8 + random() * Math.min(bush.w, bush.h) * 0.17,
        shade: random(),
        flower: random() > 0.86,
      });
    }
    blobs.sort((a, b) => a.y - b.y);
    bushCache.set(key, blobs);
    return blobs;
  }

  function drawBushes(world) {
    const level = world.level;
    for (let index = 0; index < level.bushes.length; index += 1) {
      const bush = level.bushes[index];
      const blobs = bushBlobs(level, bush, index);
      context.save();
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.beginPath();
      context.ellipse(bush.x + bush.w / 2 + 3, bush.y + bush.h / 2 + 6, bush.w * 0.52, bush.h * 0.5, 0, 0, TAU);
      context.fill();
      context.beginPath();
      context.ellipse(bush.x + bush.w / 2, bush.y + bush.h / 2, bush.w * 0.5, bush.h * 0.48, 0, 0, TAU);
      context.fillStyle = COLORS.bushRim;
      context.fill();
      for (const blob of blobs) {
        context.beginPath();
        context.arc(bush.x + blob.x, bush.y + blob.y, blob.r, 0, TAU);
        context.fillStyle = blob.shade > 0.62 ? COLORS.bushLight : blob.shade > 0.28 ? COLORS.bush : COLORS.bushDark;
        context.fill();
      }
      for (const blob of blobs) {
        if (!blob.flower) continue;
        context.fillStyle = 'rgba(245, 233, 200, 0.65)';
        context.beginPath();
        context.arc(bush.x + blob.x - blob.r * 0.25, bush.y + blob.y - blob.r * 0.3, 1.6, 0, TAU);
        context.fill();
      }
      context.strokeStyle = 'rgba(126, 220, 168, 0.16)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.ellipse(bush.x + bush.w / 2, bush.y + bush.h / 2, bush.w * 0.5, bush.h * 0.48, 0, 0, TAU);
      context.stroke();
      context.restore();
    }
  }

  // ---------------------------------------------------------------- actors

  function drawFishShape(x, y, scale, colour) {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = colour;
    context.beginPath();
    context.ellipse(0, 0, 11, 6.5, 0, 0, TAU);
    context.fill();
    context.beginPath();
    context.moveTo(-9, 0);
    context.lineTo(-18, -7);
    context.lineTo(-18, 7);
    context.closePath();
    context.fill();
    context.fillStyle = 'rgba(20, 30, 50, 0.8)';
    context.beginPath();
    context.arc(6, -1.6, 1.4, 0, TAU);
    context.fill();
    context.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(-2, -4);
    context.lineTo(5, -4);
    context.stroke();
    context.restore();
  }

  function drawFish(world) {
    for (const fish of world.fish) {
      if (fish.taken) continue;
      const bob = Math.sin(world.levelTime * 2.1 + fish.bob) * 3;
      context.save();
      const glow = context.createRadialGradient(fish.x, fish.y + bob, 1, fish.x, fish.y + bob, 26);
      glow.addColorStop(0, 'rgba(255, 210, 120, 0.30)');
      glow.addColorStop(1, 'rgba(255, 200, 100, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(fish.x, fish.y + bob, 26, 0, TAU);
      context.fill();
      context.restore();
      drawFishShape(fish.x, fish.y + bob, 0.85, '#f2b57a');
    }
  }

  function drawCoins(world) {
    for (const coin of world.coins) {
      if (!coin.landed) continue;
      context.save();
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.beginPath();
      context.ellipse(coin.x + 1.5, coin.y + 2.5, 8, 5, 0, 0, TAU);
      context.fill();
      const glint = 0.7 + 0.3 * Math.sin(world.levelTime * 5 + coin.spin);
      context.fillStyle = COLORS.gold;
      context.beginPath();
      context.arc(coin.x, coin.y, 7, 0, TAU);
      context.fill();
      context.strokeStyle = `rgba(255, 250, 220, ${glint})`;
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(coin.x, coin.y, 5, 0, TAU);
      context.stroke();
      context.restore();
    }

    for (const coin of world.coins) {
      if (coin.landed) continue;
      const lift = Math.sin(coin.t * Math.PI) * 26;
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.beginPath();
      context.ellipse(coin.x + 3, coin.y + 4, 6, 3, 0, 0, TAU);
      context.fill();
      context.strokeStyle = 'rgba(255, 214, 110, 0.35)';
      context.setLineDash([5, 6]);
      context.beginPath();
      context.arc(coin.tx, coin.ty, 12 + Math.sin(world.levelTime * 4) * 2, 0, TAU);
      context.stroke();
      context.setLineDash([]);
      context.save();
      context.translate(coin.x, coin.y - lift);
      context.rotate(coin.spin);
      context.fillStyle = COLORS.gold;
      context.beginPath();
      context.ellipse(0, 0, 7.5, 9, 0, 0, TAU);
      context.fill();
      context.strokeStyle = 'rgba(255, 252, 220, 0.85)';
      context.lineWidth = 1.4;
      context.beginPath();
      context.arc(0, 0, 4.5, 0, TAU);
      context.stroke();
      context.restore();
    }
  }

  function drawEffects(world) {
    for (const effect of world.effects) {
      const progress = effect.t / effect.duration;
      if (effect.type === 'ring') {
        context.strokeStyle = `rgba(255, 216, 120, ${0.55 * (1 - progress)})`;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(effect.x, effect.y, 12 + progress * 54, 0, TAU);
        context.stroke();
      } else if (effect.type === 'sparkle') {
        context.save();
        context.translate(effect.x, effect.y);
        context.strokeStyle = `rgba(255, 232, 160, ${0.8 * (1 - progress)})`;
        context.lineWidth = 2;
        for (let ray = 0; ray < 8; ray += 1) {
          const angle = (ray / 8) * TAU + progress;
          const inner = 5 + progress * 8;
          const outer = 14 + progress * 26;
          context.beginPath();
          context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
          context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          context.stroke();
        }
        context.restore();
      }
    }
  }

  function drawCat(world) {
    const cat = world.cat;
    const hidden = cat.hidden;
    const sway = Math.sin(world.levelTime * (cat.moving ? 9 : 3.2)) * (cat.moving ? 1 : 0.5);
    context.save();
    context.globalAlpha = hidden ? 0.62 : 1;
    context.fillStyle = 'rgba(0, 0, 0, 0.4)';
    context.beginPath();
    context.ellipse(cat.x + 2, cat.y + 4, 16, 10, 0, 0, TAU);
    context.fill();

    context.translate(cat.x, cat.y);
    context.rotate(cat.facing);
    context.scale(1.15, 1.15);

    // Paws peeping out from under the body.
    context.fillStyle = 'rgba(44, 44, 60, 0.9)';
    for (const [px, py] of [[-7, -10.5], [-7, 10.5], [5, -10.5], [5, 10.5]]) {
      context.beginPath();
      context.ellipse(px, py, 4.6, 3, 0, 0, TAU);
      context.fill();
    }
    context.fillStyle = COLORS.catFur;
    for (const [px, py] of [[-7, -10.5], [-7, 10.5], [5, -10.5], [5, 10.5]]) {
      context.beginPath();
      context.ellipse(px, py, 3.6, 2.2, 0, 0, TAU);
      context.fill();
    }

    // Tail.
    context.strokeStyle = 'rgba(44, 44, 60, 0.9)';
    context.lineWidth = 6.4;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(-11, 0);
    context.quadraticCurveTo(-23, -5 + sway * 5, -32, -10 + sway * 11);
    context.stroke();
    context.strokeStyle = COLORS.catFur;
    context.lineWidth = 4.4;
    context.beginPath();
    context.moveTo(-11, 0);
    context.quadraticCurveTo(-23, -5 + sway * 5, -31, -9 + sway * 11);
    context.stroke();
    context.strokeStyle = COLORS.catStripe;
    context.lineWidth = 3.2;
    context.beginPath();
    context.moveTo(-30, -8 + sway * 11);
    context.lineTo(-33, -10 + sway * 12);
    context.stroke();

    // Body, with a dark rim so the pale cat stays readable on any floor.
    context.fillStyle = 'rgba(44, 44, 60, 0.9)';
    context.beginPath();
    context.ellipse(-1, 0, 16.2, 10.6, 0, 0, TAU);
    context.fill();
    context.fillStyle = COLORS.catFur;
    context.beginPath();
    context.ellipse(-1, 0, 15, 9.5, 0, 0, TAU);
    context.fill();
    context.fillStyle = 'rgba(255, 255, 255, 0.12)';
    context.beginPath();
    context.ellipse(0, 0, 11, 6.4, 0, 0, TAU);
    context.fill();

    // Stripes.
    context.strokeStyle = COLORS.catStripe;
    context.lineWidth = 2;
    context.globalAlpha = hidden ? 0.35 : 0.6;
    for (let stripe = 0; stripe < 3; stripe += 1) {
      const sx = -8 + stripe * 6;
      context.beginPath();
      context.moveTo(sx, -7);
      context.lineTo(sx + 2, 7);
      context.stroke();
    }
    context.globalAlpha = hidden ? 0.62 : 1;

    // Head and ears.
    context.fillStyle = 'rgba(44, 44, 60, 0.9)';
    context.beginPath();
    context.arc(11, 0, 8.3, 0, TAU);
    context.fill();
    context.fillStyle = COLORS.catFur;
    context.beginPath();
    context.arc(11, 0, 7.4, 0, TAU);
    context.fill();
    context.fillStyle = 'rgba(44, 44, 60, 0.9)';
    context.beginPath();
    context.moveTo(7, -6);
    context.lineTo(5, -15);
    context.lineTo(16, -8);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(7, 6);
    context.lineTo(5, 15);
    context.lineTo(16, 8);
    context.closePath();
    context.fill();
    context.fillStyle = COLORS.catFur;
    context.beginPath();
    context.moveTo(8, -7);
    context.lineTo(7, -13);
    context.lineTo(14, -8);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(8, 7);
    context.lineTo(7, 13);
    context.lineTo(14, 8);
    context.closePath();
    context.fill();
    context.fillStyle = 'rgba(224, 143, 154, 0.85)';
    context.beginPath();
    context.moveTo(9, -8);
    context.lineTo(8.5, -11.5);
    context.lineTo(12, -8.5);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(9, 8);
    context.lineTo(8.5, 11.5);
    context.lineTo(12, 8.5);
    context.closePath();
    context.fill();

    // Eyes and nose.
    context.fillStyle = COLORS.catEye;
    context.beginPath();
    context.arc(15, -3, 1.9, 0, TAU);
    context.fill();
    context.beginPath();
    context.arc(15, 3, 1.9, 0, TAU);
    context.fill();
    context.fillStyle = 'rgba(20, 34, 26, 0.9)';
    context.beginPath();
    context.ellipse(15.6, -3, 0.7, 1.5, 0, 0, TAU);
    context.fill();
    context.beginPath();
    context.ellipse(15.6, 3, 0.7, 1.5, 0, 0, TAU);
    context.fill();
    context.fillStyle = '#e08f9a';
    context.beginPath();
    context.arc(18.4, 0, 1.4, 0, TAU);
    context.fill();

    // Whiskers.
    context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    context.lineWidth = 0.8;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(16, side * 4);
      context.lineTo(24, side * 7);
      context.stroke();
      context.beginPath();
      context.moveTo(16, side * 4.6);
      context.lineTo(23, side * 10);
      context.stroke();
    }
    context.restore();

    if (hidden) {
      // Leaves resting on the hidden cat, plus a quiet marker.
      context.save();
      for (let leaf = 0; leaf < 6; leaf += 1) {
        const angle = (leaf / 6) * TAU + 0.4;
        const lx = cat.x + Math.cos(angle) * 12;
        const ly = cat.y + Math.sin(angle) * 8;
        context.fillStyle = leaf % 2 === 0 ? 'rgba(38, 116, 80, 0.82)' : 'rgba(52, 145, 99, 0.78)';
        context.beginPath();
        context.ellipse(lx, ly, 5.5, 3, angle, 0, TAU);
        context.fill();
      }
      context.strokeStyle = 'rgba(126, 220, 168, 0.55)';
      context.lineWidth = 1;
      context.setLineDash([4, 5]);
      context.beginPath();
      context.arc(cat.x, cat.y, 21, 0, TAU);
      context.stroke();
      context.setLineDash([]);
      text('HIDDEN', cat.x, cat.y - 30, 9, 'rgba(150, 235, 180, 0.9)', {
        align: 'center',
        letterSpacing: 1.5,
      });
      context.restore();
    }
  }

  function drawGuard(guard, world) {
    const bob = guard.moving ? Math.sin((guard.stepPhase / GUARD.stride) * Math.PI) * 1.4 : 0;
    context.save();
    context.fillStyle = 'rgba(0, 0, 0, 0.45)';
    context.beginPath();
    context.ellipse(guard.x + 3, guard.y + 5, 15, 10, 0, 0, TAU);
    context.fill();

    context.translate(guard.x, guard.y + bob);
    context.rotate(guard.angle);
    context.scale(1.16, 1.16);

    // Coat tails and shoulders.
    context.fillStyle = 'rgba(150, 170, 218, 0.30)';
    context.beginPath();
    context.ellipse(-3, 0, 15.2, 11.7, 0, 0, TAU);
    context.fill();
    context.fillStyle = COLORS.guardCoat;
    context.beginPath();
    context.ellipse(-3, 0, 14, 10.5, 0, 0, TAU);
    context.fill();
    context.fillStyle = COLORS.guardCoatLight;
    context.beginPath();
    context.ellipse(-1, 0, 10, 8, 0, 0, TAU);
    context.fill();

    // Shirt front.
    context.fillStyle = COLORS.guardShirt;
    context.beginPath();
    context.ellipse(5, 0, 5, 4.5, 0, 0, TAU);
    context.fill();
    context.fillStyle = '#11151f';
    context.beginPath();
    context.arc(7, 0, 1.6, 0, TAU);
    context.fill();

    // Head, hair and cap brim.
    context.fillStyle = 'rgba(160, 182, 228, 0.45)';
    context.beginPath();
    context.arc(10, 0, 7.1, 0, TAU);
    context.fill();
    context.fillStyle = COLORS.guardSkin;
    context.beginPath();
    context.arc(10, 0, 6.2, 0, TAU);
    context.fill();
    context.fillStyle = COLORS.guardHair;
    context.beginPath();
    context.arc(9.4, 0, 5.6, Math.PI * 0.55, Math.PI * 1.45);
    context.fill();
    context.fillStyle = 'rgba(20, 22, 32, 0.95)';
    context.beginPath();
    context.ellipse(12, 0, 3, 4.4, 0, 0, TAU);
    context.fill();
    context.fillStyle = COLORS.guardGold;
    context.beginPath();
    context.arc(9, 0, 1.1, 0, TAU);
    context.fill();

    // Gloved hand and lantern.
    context.strokeStyle = COLORS.guardCoat;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(4, 7);
    context.lineTo(12, 10);
    context.stroke();
    context.fillStyle = '#ffe7a0';
    context.beginPath();
    context.arc(14, 10, 3.2, 0, TAU);
    context.fill();
    context.strokeStyle = 'rgba(255, 220, 120, 0.75)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(14, 10, 6, 0, TAU);
    context.stroke();

    // Gold buttons down the back.
    context.fillStyle = COLORS.guardGold;
    for (let button = 0; button < 2; button += 1) {
      context.beginPath();
      context.arc(-6, -3 + button * 6, 1.1, 0, TAU);
      context.fill();
    }
    context.restore();

    if (guard.seen) {
      const pulse = 0.65 + 0.35 * Math.sin(world.levelTime * 12);
      context.save();
      context.globalAlpha = pulse;
      context.fillStyle = COLORS.red;
      context.beginPath();
      context.arc(guard.x, guard.y - 26, 9, 0, TAU);
      context.fill();
      text('!', guard.x, guard.y - 22, 14, '#1a0b0e', { align: 'center', weight: 'bold' });
      context.restore();
    }
  }

  function drawActors(world) {
    drawFish(world);
    drawCoins(world);
    drawEffects(world);
    drawCat(world);
    for (const guard of world.guards) drawGuard(guard, world);
  }

  // ---------------------------------------------------------------- HUD

  function drawCoinIcon(x, y, radius) {
    context.fillStyle = COLORS.gold;
    context.beginPath();
    context.arc(x, y, radius, 0, TAU);
    context.fill();
    context.strokeStyle = 'rgba(255, 250, 220, 0.8)';
    context.lineWidth = 1.4;
    context.beginPath();
    context.arc(x, y, radius * 0.62, 0, TAU);
    context.stroke();
  }

  function drawFishIcon(x, y, scale) {
    drawFishShape(x, y, scale, COLORS.gold);
  }

  function drawSpeaker(x, y, muted) {
    context.save();
    context.fillStyle = muted ? 'rgba(180, 190, 210, 0.55)' : COLORS.text;
    context.beginPath();
    context.moveTo(x - 9, y - 3);
    context.lineTo(x - 3, y - 3);
    context.lineTo(x + 2, y - 8);
    context.lineTo(x + 2, y + 8);
    context.lineTo(x - 3, y + 3);
    context.lineTo(x - 9, y + 3);
    context.closePath();
    context.fill();
    context.strokeStyle = muted ? 'rgba(180, 190, 210, 0.45)' : 'rgba(238, 243, 255, 0.8)';
    context.lineWidth = 1.6;
    if (muted) {
      context.strokeStyle = COLORS.red;
      context.beginPath();
      context.moveTo(x + 6, y - 5);
      context.lineTo(x + 14, y + 5);
      context.moveTo(x + 14, y - 5);
      context.lineTo(x + 6, y + 5);
      context.stroke();
    } else {
      context.beginPath();
      context.arc(x + 3, y, 7, -0.9, 0.9);
      context.stroke();
      context.beginPath();
      context.arc(x + 3, y, 11, -0.9, 0.9);
      context.stroke();
    }
    context.restore();
  }

  function drawHud(world, ui) {
    const height = HUD_HEIGHT;
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(9, 15, 28, 0.97)');
    gradient.addColorStop(1, 'rgba(6, 11, 22, 0.82)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, height);
    context.strokeStyle = COLORS.hudLine;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, height - 0.5);
    context.lineTo(FIELD.width, height - 0.5);
    context.stroke();
    context.fillStyle = 'rgba(242, 201, 76, 0.35)';
    context.fillRect(0, height - 2, 230, 1);

    // Level and objective.
    text(`LEVEL ${world.level.id} / 3  ·  ${world.level.nameCN}`, 24, 17, 10.5, COLORS.gold, {
      letterSpacing: 2.2,
    });
    text(world.level.name.toUpperCase(), 24, 41, 21, COLORS.text, { font: FONT.title, weight: 'bold' });
    text('Reach the open window', 24, 64, 13.5, world.level.exit.x - world.cat.x < 260 ? COLORS.gold : COLORS.muted);

    // Alert meter.
    const meterX = 452;
    const meterY = 28;
    const meterW = 250;
    const meterH = 14;
    text('ALERT', meterX, 18, 10, COLORS.muted, { letterSpacing: 2.2 });
    roundRectPath(context, meterX, meterY, meterW, meterH, 7);
    context.fillStyle = '#121a2a';
    context.fill();
    context.strokeStyle = 'rgba(120, 146, 194, 0.30)';
    context.lineWidth = 1;
    context.stroke();
    const fraction = Math.max(0, Math.min(1, world.alert / ALERT.max));
    if (fraction > 0.002) {
      context.save();
      roundRectPath(context, meterX, meterY, meterW, meterH, 7);
      context.clip();
      const colour = alertColour(world.alert);
      context.fillStyle = colour;
      if (world.alert > 72) {
        context.shadowColor = colour;
        context.shadowBlur = 14;
      }
      context.fillRect(meterX, meterY, meterW * fraction, meterH);
      context.restore();
    }
    context.strokeStyle = 'rgba(4, 8, 16, 0.45)';
    context.lineWidth = 1;
    for (let tick = 1; tick < 20; tick += 1) {
      const tx = meterX + (meterW * tick) / 20;
      context.beginPath();
      context.moveTo(tx, meterY + 1);
      context.lineTo(tx, meterY + meterH - 1);
      context.stroke();
    }
    text(Math.round(world.alert), meterX + meterW + 12, 37, 20, alertColour(world.alert), {
      weight: 'bold',
    });
    const status = world.visible
      ? 'Spotted by a butler'
      : world.cat.hidden
        ? 'Hidden in bush · unseen'
        : world.exposure === 'moon'
          ? 'Moonlit · harder to see'
          : world.exposure === 'shadow'
            ? 'In shadow · easy to see'
            : 'Unseen';
    const statusColour = world.visible
      ? COLORS.red
      : world.cat.hidden
        ? COLORS.green
        : world.exposure === 'shadow'
          ? COLORS.amber
          : COLORS.muted;
    text(status, meterX, 63, 11.5, statusColour);

    // Coins.
    drawCoinIcon(800, 36, 9);
    text(`× ${world.coinsLeft}`, 816, 42, 19, COLORS.text, { weight: 'bold' });
    text('COINS', 794, 66, 9, COLORS.muted, { letterSpacing: 1.6 });

    // Fish and score.
    drawFishIcon(904, 36, 0.95);
    text(`${world.fishCollected} / ${world.fishTotal}`, 926, 42, 19, COLORS.text, { weight: 'bold' });
    text('FISH', 902, 66, 9, COLORS.muted, { letterSpacing: 1.6 });

    text('SCORE', 1022, 24, 9, COLORS.muted, { letterSpacing: 1.8 });
    text(world.score, 1022, 52, 25, COLORS.gold, { weight: 'bold' });

    drawSpeaker(1208, 38, ui.muted);
    text('M', 1244, 42, 10, COLORS.muted, { align: 'center', weight: 'bold' });
    text(ui.muted ? 'SOUND OFF' : 'SOUND ON', 1206, 66, 9, ui.muted ? COLORS.red : COLORS.muted, {
      letterSpacing: 0.8,
    });

    if (ui.best > 0) {
      text(`BEST ${ui.best}`, 1022, 68, 9.5, 'rgba(143, 162, 196, 0.75)', { letterSpacing: 1 });
    }
  }

  // ---------------------------------------------------------------- overlays

  function drawTitle(world, ui) {
    context.fillStyle = 'rgba(3, 7, 15, 0.68)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const vignette = context.createRadialGradient(640, 340, 120, 640, 400, 760);
    vignette.addColorStop(0, 'rgba(22, 38, 64, 0.18)');
    vignette.addColorStop(1, 'rgba(2, 4, 10, 0.72)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Two cat eyes watching from the dark, behind the title.
    const blink = Math.sin(world.levelTime * 0.9) > 0.97 ? 0.15 : 1;
    for (const side of [-1, 1]) {
      const ex = 640 + side * 34;
      const glow = context.createRadialGradient(ex, 190, 2, ex, 190, 46);
      glow.addColorStop(0, `rgba(157, 255, 176, ${0.22 * blink})`);
      glow.addColorStop(1, 'rgba(157, 255, 176, 0)');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(ex, 190, 46, 0, TAU);
      context.fill();
      context.fillStyle = `rgba(157, 255, 176, ${0.75 * blink})`;
      context.beginPath();
      context.ellipse(ex, 190, 8, 3.2 * blink, 0, 0, TAU);
      context.fill();
    }

    text('A STEALTH TALE IN THREE FLOORS', 640, 122, 11, COLORS.gold, {
      align: 'center',
      letterSpacing: 4,
    });
    text('SILENT PAWS', 640, 268, 92, '#f7eed6', {
      align: 'center',
      font: FONT.title,
      weight: 'bold',
      shadow: 'rgba(255, 206, 92, 0.28)',
      shadowBlur: 34,
    });
    text('夜 爪 潜 行', 640, 314, 25, COLORS.gold, { align: 'center', letterSpacing: 7 });
    text('A moonlit mansion. Four butlers. One very small cat.', 640, 354, 17, COLORS.muted, {
      align: 'center',
    });

    panel(220, 392, 840, 224, COLORS.gold);
    const columns = [
      { x: 390, title: 'MOVE', lines: ['WASD or arrow keys', 'Stay low, keep to cover'] },
      { x: 640, title: 'TOSS A COIN', lines: ['Click anywhere to throw', 'Butlers come to investigate'] },
      { x: 890, title: 'HIDE & SLIP', lines: ['Bushes break line of sight', 'Reach the open window'] },
    ];
    for (const column of columns) {
      text(column.title, column.x, 436, 12, COLORS.gold, { align: 'center', letterSpacing: 2.4 });
      context.strokeStyle = 'rgba(242, 201, 76, 0.3)';
      context.beginPath();
      context.moveTo(column.x - 54, 448);
      context.lineTo(column.x + 54, 448);
      context.stroke();
      text(column.lines[0], column.x, 480, 14, COLORS.text, { align: 'center' });
      text(column.lines[1], column.x, 506, 13, COLORS.muted, { align: 'center' });
    }
    text('Moonlight hides you. Deep shadow gives you away.', 640, 560, 13, 'rgba(180, 200, 232, 0.85)', {
      align: 'center',
    });
    text('Torch cones raise the alert meter. A full meter means caught.', 640, 584, 13, 'rgba(180, 200, 232, 0.85)', {
      align: 'center',
    });

    // Floor chips.
    const chips = [
      ['I', 'THE FOYER', 1],
      ['II', 'THE GALLERY', 2],
      ['III', 'THE BALLROOM', 3],
    ];
    chips.forEach(([numeral, name, difficulty], index) => {
      const cx = 400 + index * 240;
      text(numeral, cx, 648, 12, COLORS.gold, { align: 'center', letterSpacing: 2 });
      text(name, cx, 668, 12.5, COLORS.text, { align: 'center', letterSpacing: 1.6 });
      for (let dot = 0; dot < 3; dot += 1) {
        context.fillStyle = dot < difficulty ? COLORS.gold : 'rgba(120, 138, 170, 0.3)';
        context.beginPath();
        context.arc(cx - 14 + dot * 14, 684, 2.4, 0, TAU);
        context.fill();
      }
    });

    const pulse = 0.65 + 0.35 * Math.sin(world.levelTime * 3.2);
    text('CLICK OR PRESS SPACE TO BEGIN', 640, 740, 19, COLORS.gold, {
      align: 'center',
      letterSpacing: 3,
      alpha: pulse,
      weight: 'bold',
    });
    text(`Best score ${ui.best}  ·  R restart  ·  M mute`, 640, 772, 12, COLORS.muted, {
      align: 'center',
    });
  }

  function statRow(label, value, x, y, colour = COLORS.text) {
    text(label, x, y, 11, COLORS.muted, { letterSpacing: 1.8 });
    text(value, x + 380, y, 16, colour, { align: 'right', weight: 'bold' });
  }

  function drawCaught(world) {
    context.fillStyle = 'rgba(30, 4, 10, 0.30)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const vignette = context.createRadialGradient(640, 420, 100, 640, 420, 760);
    vignette.addColorStop(0, 'rgba(80, 10, 24, 0)');
    vignette.addColorStop(1, 'rgba(90, 8, 22, 0.68)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    panel(310, 168, 660, 336, COLORS.red);
    text('CAUGHT', 640, 258, 66, COLORS.red, {
      align: 'center',
      font: FONT.title,
      weight: 'bold',
      shadow: 'rgba(242, 84, 75, 0.35)',
      shadowBlur: 26,
    });
    text("A butler's torch fixed on the cat.", 640, 302, 17, COLORS.text, { align: 'center' });
    text('ALERT 100  ·  BACK TO THE START OF THE FLOOR', 640, 344, 12, COLORS.amber, {
      align: 'center',
      letterSpacing: 1.6,
    });
    context.strokeStyle = 'rgba(242, 84, 75, 0.35)';
    context.beginPath();
    context.moveTo(420, 370);
    context.lineTo(860, 370);
    context.stroke();
    text('The fish you found on this floor will be waiting again.', 640, 404, 13, COLORS.muted, {
      align: 'center',
    });
    text('CLICK OR PRESS SPACE TO TRY AGAIN', 640, 458, 17, COLORS.gold, {
      align: 'center',
      letterSpacing: 2.4,
      weight: 'bold',
    });
    text('R also restarts this floor  ·  M mute', 640, 486, 10.5, COLORS.muted, {
      align: 'center',
    });
  }

  function drawClear(world) {
    context.fillStyle = 'rgba(3, 7, 15, 0.58)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const bonus = world.lastBonus ?? { base: 0, time: 0, stealth: 0, win: 0, total: 0, seconds: 0 };
    panel(300, 186, 680, 428, COLORS.gold);
    text('FLOOR CLEAR', 640, 250, 13, COLORS.gold, { align: 'center', letterSpacing: 4 });
    text(`LEVEL ${world.level.id} · ${world.level.name.toUpperCase()}`, 640, 294, 32, COLORS.text, {
      align: 'center',
      font: FONT.title,
      weight: 'bold',
    });
    context.strokeStyle = 'rgba(242, 201, 76, 0.35)';
    context.beginPath();
    context.moveTo(380, 318);
    context.lineTo(900, 318);
    context.stroke();

    const fishHere = world.fish.filter((fish) => fish.taken).length;
    statRow('FISH ON THIS FLOOR', `${fishHere} / ${world.fish.length}`, 380, 358);
    statRow('TIME', formatTime(bonus.seconds), 380, 390);
    statRow('FLOOR BONUS', `+${bonus.base + bonus.time}`, 380, 422, COLORS.gold);
    statRow('STEALTH BONUS', `+${bonus.stealth}`, 380, 454, bonus.stealth > 0 ? COLORS.green : COLORS.muted);
    statRow('SCORE', String(world.score), 380, 492, COLORS.gold);

    const nextName =
      world.levelIndex < 2 ? `NEXT: ${world.level.name === 'The Foyer' ? 'THE GALLERY' : 'THE BALLROOM'}` : 'FINAL FLOOR';
    text(`CLICK / SPACE  ·  ${nextName}`, 640, 564, 16, COLORS.gold, {
      align: 'center',
      letterSpacing: 2,
      weight: 'bold',
    });
    text('M mute  ·  your score carries to the next floor', 640, 592, 11, COLORS.muted, {
      align: 'center',
    });
  }

  function drawWin(world, ui) {
    context.fillStyle = 'rgba(3, 7, 15, 0.62)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const glow = context.createRadialGradient(640, 360, 60, 640, 360, 620);
    glow.addColorStop(0, 'rgba(255, 218, 130, 0.20)');
    glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Gold dust drifting up from the floor.
    for (let i = 0; i < 46; i += 1) {
      const speck = world.decor.specks[i % world.decor.specks.length];
      const drift = (world.levelTime * 12 + speck.y * 3) % 620;
      const alpha = 0.10 + 0.28 * (1 - drift / 620);
      context.fillStyle = `rgba(255, 222, 140, ${alpha})`;
      context.beginPath();
      context.arc(speck.x, 700 - drift, 1 + speck.radius * 0.7, 0, TAU);
      context.fill();
    }

    panel(252, 118, 776, 566, COLORS.gold);
    text('THE MANSION IS QUIET', 640, 176, 12, COLORS.gold, { align: 'center', letterSpacing: 4.5 });
    text('SILENT PAWS', 640, 246, 64, '#f7eed6', {
      align: 'center',
      font: FONT.title,
      weight: 'bold',
      shadow: 'rgba(255, 206, 92, 0.3)',
      shadowBlur: 28,
    });
    text('You slipped out of the open window and into the garden.', 640, 286, 16, COLORS.muted, {
      align: 'center',
    });

    text('FINAL SCORE', 640, 336, 11, COLORS.muted, { align: 'center', letterSpacing: 3 });
    text(world.score, 640, 404, 70, COLORS.gold, {
      align: 'center',
      font: FONT.title,
      weight: 'bold',
      shadow: 'rgba(255, 206, 92, 0.35)',
      shadowBlur: 28,
    });

    const stats = [
      ['FISH', `${world.fishCollected} / ${world.fishTotal}`],
      ['TIME', formatTime(world.completedTime)],
      ['BEST', String(Math.max(ui.best, world.score))],
    ];
    stats.forEach(([label, value], index) => {
      const x = 430 + index * 210;
      text(label, x, 456, 10, COLORS.muted, { align: 'center', letterSpacing: 2.2 });
      text(value, x, 482, 20, COLORS.text, { align: 'center', weight: 'bold' });
    });

    const rank = world.score >= 3000 ? 'MASTER OF SHADOWS' : world.score >= 2200 ? 'QUIET PAWS' : 'A CLEAN ESCAPE';
    text(rank, 640, 530, 13, COLORS.green, { align: 'center', letterSpacing: 3 });

    const pulse = 0.7 + 0.3 * Math.sin(world.levelTime * 3);
    text('CLICK OR PRESS SPACE TO PLAY AGAIN', 640, 598, 17, COLORS.gold, {
      align: 'center',
      letterSpacing: 2.3,
      alpha: pulse,
      weight: 'bold',
    });
    text('Three floors, one small cat, and nobody ever saw a thing.', 640, 632, 12, COLORS.muted, {
      align: 'center',
    });
    text('M mute  ·  R restart floor while playing', 640, 660, 10.5, 'rgba(143, 162, 196, 0.75)', {
      align: 'center',
    });
  }

  // ---------------------------------------------------------------- frame

  function drawWorld(world) {
    drawFloor(world);
    drawShadowPatches(world);
    drawMoonlight(world);
    drawExit(world);
    drawCones(world);
    drawWalls(world);
    drawFurnitureList(world);
    drawBushes(world);
    drawActors(world);

    // Soft dark edges pull the eye toward the middle of the floor.
    const vignette = context.createRadialGradient(640, 430, 260, 640, 430, 780);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
    context.fillStyle = vignette;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function draw(world, screen, ui = {}) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = COLORS.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.imageSmoothingEnabled = true;

    if (screen === SCREEN_TITLE) {
      drawWorld(world);
      drawTitle(world, { best: ui.best ?? 0 });
      return;
    }

    drawWorld(world);
    if (screen === SCREEN_CAUGHT) {
      drawCaught(world);
      drawHud(world, ui);
    } else if (screen === SCREEN_CLEAR) {
      drawHud(world, ui);
      drawClear(world);
    } else if (screen === SCREEN_WIN) {
      drawHud(world, ui);
      drawWin(world, ui);
    } else {
      drawHud(world, ui);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
