#!/usr/bin/env bun

import { join } from 'path';
import { program } from 'commander';
import { readdir } from 'node:fs/promises';

import { pngToBlp, blpToPng } from './converter';

import pkg from '../package.json';
import { type Blp } from './blp';

const pad = (v: number, p = 2) => v.toString().padStart(p, '0');
const getTimeElapsed = (startDate: Date, endDate = new Date()) => {
  let ms = endDate.getTime() - startDate.getTime();
  const m = Math.floor(ms / (1000 * 60));
  ms %= 1000 * 60;
  const s = Math.floor(ms / 1000);
  ms %= 1000;
  return `${m ? `${pad(m)}:` : ''}${pad(s)}.${pad(ms, 3)}`;
};

const pressAnyKeyToExit = async () => {
  process.stdout.write('Press any key to exit...');
  for await (const _ of process.stdin) {
    // We only care that something was entered, not what it was.
    // The loop will break after the first chunk (line) is received.
    break;
  }
};

// Set up command-line interface with commander
program
  .name('haax-blp')
  .description('Utility to convert BLP textures to and from PNG images.')
  .version(pkg.version)
  .argument(
    '<files...>',
    'Space-separated list of full paths to blp or png files. If a directory path is provided, it will be searched for all png files that will be converted to blp.'
  )
  .option(
    '-c --compression <DXT1|DXT3|DXT5|Palette|Raw>',
    `Compression type`,
    'DXT5'
  )
  .option(
    '-a --alpha <0|1|4|8>',
    'Alpha size, 0 means no alpha, higher value means smoother edges but some compression formats may not support it.',
    v => parseInt(v),
    8
  )
  .option('-m --mips', 'Generate mipmaps', false)
  .option('--profile', 'Enable profiling mode', false)
  .addHelpText(
    'after',
    `
You can pass multiple files or directories to convert them all at once.
Examples:
  Converts Texture1.blp and Texture2.blp to PNG.
  $ haax-blp path/to/Texture1.blp path/to/Texture2.blp

  Converts all BLP and PNG files in a folder (and subfolders).
  $ haax-blp path/to/folder

  Converts Texture1.png to BLP using palette compression, 1-bit alpha and generated mipmaps.
  $ haax-blp path/to/Texture1.png -c palette -a 1 -m
  `
  )
  .parse();

const files = program.args;
const { compression, alpha, mips, profile } = program.opts();

if (files.length === 0) program.help();

if (![0, 1, 4, 8].includes(alpha)) {
  console.error('Alpha size must be one of: 0, 1, 4, 8');
  process.exit(1);
}

const options = ((): Pick<
  Blp,
  'alphaSize' | 'compression' | 'format' | 'mipMaps'
> => {
  switch (compression.toUpperCase()) {
    case 'DXT1':
      if (alpha > 1) {
        console.error('DXT1 compression only supports 1-bit alpha');
        process.exit(1);
      }
      return {
        compression: 'PIXEL_DXT1',
        format: 'COLOR_DXT',
        alphaSize: alpha,
        mipMaps: mips ? 'MIPS_GENERATED' : 'MIPS_NONE'
      };
    case 'DXT3':
      if (alpha > 4) {
        console.error('DXT3 compression only supports 4-bit alpha');
        process.exit(1);
      }
      return {
        compression: 'PIXEL_DXT3',
        format: 'COLOR_DXT',
        alphaSize: alpha,
        mipMaps: mips ? 'MIPS_GENERATED' : 'MIPS_NONE'
      };
    case 'DXT5':
      return {
        compression: 'PIXEL_DXT5',
        format: 'COLOR_DXT',
        alphaSize: alpha,
        mipMaps: mips ? 'MIPS_GENERATED' : 'MIPS_NONE'
      };
    case 'PALETTE':
      return {
        compression: 'PIXEL_UNSPECIFIED',
        format: 'COLOR_PALETTE',
        alphaSize: alpha,
        mipMaps: mips ? 'MIPS_GENERATED' : 'MIPS_NONE'
      };
    case 'RAW':
      return {
        compression: 'PIXEL_ARGB8888',
        format: 'COLOR_ARGB8888',
        alphaSize: alpha,
        mipMaps: mips ? 'MIPS_GENERATED' : 'MIPS_NONE'
      };
    default:
      console.error(`Unknown compression type: ${compression}`);
      process.exit(1);
  }
})();

const run = async (filePaths: string[]) =>
  Promise.all(
    filePaths.map(async filePath => {
      try {
        const f = Bun.file(filePath);

        if ((await f.stat()).isDirectory()) {
          console.info(`Finding textures in directory "${filePath}"...`);
          const dirContents = await readdir(filePath);
          await run(
            dirContents
              .filter(
                p =>
                  p.toLocaleLowerCase().endsWith('.png') ||
                  p.toLocaleLowerCase().endsWith('.blp')
              )
              .map(p => join(filePath, p))
          );
          return;
        }

        if (!(await f.exists())) {
          console.warn(`File "${filePath}" not found...`);
          return;
        }

        if (filePath.toLocaleLowerCase().endsWith('.png')) {
          console.info(`Converting "${filePath}" to blp...`);
          const blp = await pngToBlp(filePath, options);
          blp && (await Bun.write(filePath.slice(0, -4) + '.blp', blp));
          return;
        }

        if (filePath.toLocaleLowerCase().endsWith('.blp')) {
          console.info(`Converting "${filePath}" to png...`);
          const png = await blpToPng(filePath);
          png && (await Bun.write(filePath.slice(0, -4) + '.png', png));
          return;
        }

        console.info(`Skipping "${filePath}"...`);
      } catch (err) {
        console.error(
          `Error processing "${filePath}": ${(err as Error).message}`
        );
      }
    })
  );

const start = new Date();
await run(files);
console.log(`Done in ${getTimeElapsed(start)}`);
await pressAnyKeyToExit();

// Memory allocation profiling
if (!profile) process.exit(0);
const { heapStats } = await import('bun:jsc');
const current = heapStats();

const nestedCompare = <
  T extends Record<string, number | Record<string, number>>
>(
  a: T,
  b: T
): T =>
  Object.fromEntries(
    Object.entries(a)
      .map(([k, v]) => {
        if (typeof v === 'object') {
          const r = nestedCompare(v, b[k] as never);
          if (Object.keys(r).length === 0) return undefined;
          return [k, r];
        }
        if (v === b[k]) return undefined;
        const diff = Math.floor((1 - (b[k] as never) / v) * 100);
        if (diff === 0) return undefined;
        return [k, `${v} (${diff}%)`];
      })
      .filter(v => v !== undefined)
  );
const previous = await Bun.file('heap-stats.json')
  .json()
  .catch(() => undefined);
if (previous) console.log(nestedCompare(current, previous));
await Bun.write('heap-stats.json', JSON.stringify(current));
