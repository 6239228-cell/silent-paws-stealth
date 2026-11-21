// Silent Paws entry for make.fun (Node 22, standard library only).
// The game itself is the plain static game/ folder beside this file: index.html and
// ES modules, drawn with canvas and played offline with zero network requests. This
// program copies game/ and screenshots/ to the output directory and writes the
// dossier.json summary the judge reads, using the vendored make.fun helper.
//
//   node serve.ts                        # play locally on localhost:8080
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(output, { recursive: true });

// The game is copied whole: index.html, its modules and any assets it grows later.
const gameSource = join(root, 'game');
if (!existsSync(gameSource)) throw new Error('game/ is missing next to main.ts');
cpSync(gameSource, join(output, 'game'), { recursive: true });

// Screenshots: at most four, each under 256 KiB, as the scorer requires.
if (existsSync(join(root, 'screenshots'))) {
  mkdirSync(join(output, 'screenshots'), { recursive: true });
  cpSync(join(root, 'screenshots'), join(output, 'screenshots'), { recursive: true });
}

// Caps taken from the scorer's gate: text bytes shrink the dossier; the rest make this
// program refuse an entry the scorer would refuse anyway.
writeFileSync(
  join(output, 'dossier.json'),
  buildDossier(output, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
