#!/usr/bin/env bun

import { join, normalize } from 'path';
import { program } from 'commander';
import { readdir } from 'node:fs/promises';

import { pngToBlp, blpToPng } from './converter';

import pkg from '../package.json';

// Set up command-line interface with commander
program
  .name('haax-blp')
  .description('Convert between BLP and PNG files for World of Warcraft')
  .version(pkg.version)
  .argument('[files...]', 'BLP or PNG files to convert')
  .addHelpText(
    'after',
    `
You can pass multiple files or directories to convert them all at once.
Examples:
  $ haax-blp path/to/Texture1.blp path/to/Texture2.blp
  $ haax-blp path/to/folder
  `
  )
  .parse();

const files = program.args;

if (files.length === 0) program.help();

const run = async (filePaths: string[]) =>
  Promise.all(
    filePaths.map(async filePath => {
      try {
        const f = Bun.file(filePath);

        if ((await f.stat()).isDirectory()) {
          console.info(`Finding png in directory "${filePath}"...`);
          const dirContents = await readdir(filePath);
          await run(
            dirContents
              .filter(p => p.toLocaleLowerCase().endsWith('.png'))
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
          const blp = await pngToBlp(filePath);
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

run(files.map(p => normalize(p)));
