import { cp, mkdir, readdir } from 'fs/promises';

await mkdir('haax-blp/node_modules/@img', { recursive: true });

const libs = await readdir('node_modules/@img');

for (const lib of libs) {
  if (!lib.startsWith('sharp-')) continue;
  await cp(`node_modules/@img/${lib}`, `haax-blp/node_modules/@img/${lib}`, {
    recursive: true
  });
}
