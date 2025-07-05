import n from '@haaxor1689/nil';
import dxtJs from 'dxt-js';
import RgbQuant from 'rgbquant';
import sharp from 'sharp';

import {
  BlpCompression,
  BlpFormat,
  BlpMipMap,
  FixedArray,
  BlpPaletteData
} from './utils';

const IMAGE_DATA_OFFSET = 148; // BLP header size

export const Blp = n
  .object({
    signature: n.string(4),

    version: n.int32(),
    format: BlpFormat,
    alphaSize: n.uint8(),
    compression: BlpCompression,
    mipMaps: BlpMipMap,

    width: n.int32(),
    height: n.int32(),

    mipOffsets: FixedArray(n.uint32(), 16, 0),
    mipSizes: FixedArray(n.uint32(), 16, 0),

    imageData: n.buffer('fill')
  })
  .transform(
    async ctx => {
      const { imageData, mipOffsets, mipSizes, ...v } = ctx.value;

      const palette =
        v.format === 'COLOR_PALETTE'
          ? await FixedArray(
              n.array(n.uint8(), 4),
              256,
              [0, 0, 0, 0],
              true
            ).fromBuffer(new Uint8Array(imageData.buffer, 0, 256 * 4))
          : [];

      const mips = await Promise.all(
        mipOffsets
          .slice(0, mipSizes.length)
          .map(v => v - IMAGE_DATA_OFFSET)
          .map(async (offset, i) => {
            const getDimension = (dimension: number) => {
              const size = Math.floor(dimension / Math.pow(2, i));
              if (v.compression.startsWith('PIXEL_DXT'))
                return Math.max(size, 4);
              return Math.max(size, 1);
            };

            const width = getDimension(v.width);
            const height = getDimension(v.height);
            const pixelCount = width * height;

            let buffer: Uint8Array;
            switch (v.format) {
              case 'COLOR_ARGB8888': {
                buffer = new Uint8Array(mipSizes[i]);
                for (let idx = 0; idx < mipSizes[i]; idx += 4) {
                  buffer[idx] = imageData[offset + idx + 2]; // R = B
                  buffer[idx + 1] = imageData[offset + idx + 1]; // G = G
                  buffer[idx + 2] = imageData[offset + idx]; // B = R
                  buffer[idx + 3] = imageData[offset + idx + 3]; // A = A
                }
                break;
              }
              case 'COLOR_DXT': {
                buffer = new Uint8Array(
                  dxtJs.decompress(
                    imageData.slice(offset, offset + mipSizes[i]),
                    width,
                    height,
                    v.compression === 'PIXEL_DXT1'
                      ? dxtJs.flags.DXT1
                      : v.compression === 'PIXEL_DXT3'
                      ? dxtJs.flags.DXT3
                      : dxtJs.flags.DXT5
                  )
                );
                break;
              }
              case 'COLOR_PALETTE': {
                const raw = await BlpPaletteData(
                  v.alphaSize,
                  pixelCount
                ).fromBuffer(
                  new Uint8Array(imageData.slice(offset, offset + mipSizes[i]))
                );

                buffer = new Uint8Array(
                  raw.img.flatMap((x, idx) => {
                    let alpha = raw.alpha?.[idx] ?? 255;
                    if (!palette[x]) return [0, 0, 0, 0];
                    switch (v.alphaSize) {
                      case 0:
                        alpha = 255;
                        break;
                      case 1:
                        alpha *= 255;
                        break;
                      case 2:
                        alpha = Math.round((alpha / 3) * 255);
                        break;
                      case 4:
                        alpha = Math.round((alpha / 15) * 255);
                        break;
                    }
                    const [b, g, r] = palette[x];
                    return [r, g, b, alpha];
                  })
                );
                break;
              }
              case 'COLOR_JPEG': {
                buffer = new Uint8Array(
                  await sharp(
                    new Uint8Array(imageData.buffer, offset, mipSizes[i])
                  )
                    .jpeg()
                    .raw()
                    .ensureAlpha()
                    .toBuffer()
                );
                break;
              }
              default:
                throw new Error(
                  `Unsupported BLP format "${v.format}" for compression "${v.compression}"`
                );
            }

            return { buffer, width, height };
          })
      );
      return { ...v, mips };
    },
    async ctx => {
      const { mips, ...v } = ctx.value;

      const getMips = async () => {
        switch (v.mipMaps) {
          case 'MIPS_NONE':
            return [mips[0]];
          case 'MIPS_HANDMADE':
            return mips;
          case 'MIPS_GENERATED': {
            const result = [mips[0]];

            // Load original mip
            let width = mips[0].width;
            let height = mips[0].height;
            let current = sharp(mips[0].buffer, {
              raw: { width, height, channels: 4 }
            });
            do {
              // Calculate half size
              width = Math.max(Math.floor(width / 2), 1);
              height = Math.max(Math.floor(height / 2), 1);

              // Resize
              current = current
                .resize(width, height, { kernel: 'nearest' })
                .clone();

              result.push({
                width,
                height,
                buffer: new Uint8Array([...(await current.raw().toBuffer())])
              });
            } while (width > 1 || height > 1);
            return result;
          }
        }
      };

      let palette: number[][] = [];
      const buffers: Uint8Array[] = [];
      for (const mip of await getMips()) {
        switch (v.format) {
          case 'COLOR_ARGB8888': {
            if (v.compression !== 'PIXEL_ARGB8888')
              throw new Error(
                `Unsupported BLP compression "${v.compression}" for format "${v.format}"`
              );

            const size = mip.width * mip.height * 4;
            const buffer = new Uint8Array(size);
            for (let idx = 0; idx < size; idx += 4) {
              buffer[idx] = mip.buffer[idx + 2]; // R = B
              buffer[idx + 1] = mip.buffer[idx + 1]; // G = G
              buffer[idx + 2] = mip.buffer[idx]; // B = R
              buffer[idx + 3] = mip.buffer[idx + 3]; // A = A
            }
            buffers.push(buffer);
            break;
          }
          case 'COLOR_DXT': {
            if (!v.compression.startsWith('PIXEL_DXT'))
              throw new Error(
                `Unsupported BLP compression "${v.compression}" for format "${v.format}"`
              );

            if (v.compression === 'PIXEL_DXT1' && v.alphaSize > 1)
              throw new Error(
                `Unsupported BLP alpha size "${v.alphaSize}" for compression "${v.compression}"`
              );

            const width = Math.max(
              mip.width,
              v.compression === 'PIXEL_DXT1' ? 2 : 4
            );
            const height = Math.max(
              mip.height,
              v.compression === 'PIXEL_DXT1' ? 2 : 4
            );

            buffers.push(
              dxtJs.compress(
                mip.buffer,
                width,
                height,
                v.compression === 'PIXEL_DXT1'
                  ? dxtJs.flags.DXT1
                  : v.compression === 'PIXEL_DXT3'
                  ? dxtJs.flags.DXT3
                  : dxtJs.flags.DXT5
              )
            );
            break;
          }
          case 'COLOR_PALETTE': {
            if (v.compression !== 'PIXEL_UNSPECIFIED')
              throw new Error(
                `Unsupported BLP compression "${v.compression}" for format "${v.format}"`
              );

            const rgbaData = await n
              .array(n.array(n.uint8(), 4), mip.width * mip.height)
              .fromBuffer(mip.buffer);
            const rgbData = rgbaData.flatMap(([r, g, b]) => [r, g, b, 1]);

            const quant = new RgbQuant({ palette });
            if (!palette.length) {
              quant.sample(rgbData);
              palette = quant.palette(true, true);
            }

            buffers.push(
              await BlpPaletteData(
                v.alphaSize,
                mip.width * mip.height
              ).toBuffer({
                img: await quant.reduce(rgbData, 2),
                alpha: rgbaData.map(x =>
                  v.alphaSize === 8
                    ? x[3]
                    : v.alphaSize === 4
                    ? Math.round((x[3] / 255) * 15)
                    : v.alphaSize === 2
                    ? Math.round((x[3] / 255) * 3)
                    : x[3] !== 0
                    ? 1
                    : 0
                )
              })
            );
            break;
          }
          case 'COLOR_JPEG': {
            if (v.compression !== 'PIXEL_UNSPECIFIED')
              throw new Error(
                `Unsupported BLP compression "${v.compression}" for format "${v.format}"`
              );

            buffers.push(
              await sharp(mip.buffer, {
                raw: { width: mip.width, height: mip.height, channels: 4 }
              })
                .jpeg()
                .toBuffer()
            );
            break;
          }
          default:
            throw new Error(
              `Unsupported BLP format "${v.format}" for compression "${v.compression}"`
            );
        }
      }

      const paletteData = palette.length
        ? Array.from({ length: 256 }).flatMap((_, i) => {
            const [r, g, b] = palette[i] ?? [0, 0, 0];
            return [b, g, r, 0];
          })
        : [];

      return {
        ...v,
        mipOffsets: buffers.reduce(
          (acc, val, i) => {
            if (i === buffers.length - 1) return acc;
            const prev = acc.at(-1) ?? 0;
            return [...acc, prev + val.length];
          },
          [IMAGE_DATA_OFFSET + paletteData.length]
        ),
        mipSizes: buffers.map(b => b.length),
        imageData: new Uint8Array(
          buffers.reduce((acc, val) => [...acc, ...val], paletteData)
        )
      };
    }
  );

export type Blp = n.output<typeof Blp>;
