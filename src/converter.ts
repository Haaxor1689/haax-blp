import { Blp } from './blp';
import sharp from 'sharp';

export const blpToPng = async (filePath: string) => {
  const buffer = await Bun.file(filePath).arrayBuffer();
  const blp = await Blp.fromBuffer(new Uint8Array(buffer));
  return sharp(blp.mips[0].buffer, {
    raw: { width: blp.mips[0].width, height: blp.mips[0].height, channels: 4 }
  })
    .png()
    .toBuffer();
};

export const pngToBlp = async (
  filePath: string,
  options: Pick<Blp, 'alphaSize' | 'compression' | 'format' | 'mipMaps'>
) => {
  const png = sharp(await Bun.file(filePath).arrayBuffer());
  const { width, height } = await png.metadata();
  const buffer = await png.raw().toBuffer();
  return Blp.toBuffer({
    signature: 'BLP2',
    version: 1,
    ...options,

    width,
    height,

    mips: [{ buffer, width, height }]
  });
};
