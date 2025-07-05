import { n } from '@haaxor1689/nil';
import { isEqual } from '../utils';

export const BlpFormat = n.enum(n.uint8(), [
  'COLOR_JPEG',
  'COLOR_PALETTE',
  'COLOR_DXT',
  'COLOR_ARGB8888'
]);
export type BlpFormat = n.output<typeof BlpFormat>;

export const BlpCompression = n.enum(n.uint8(), [
  'PIXEL_DXT1',
  'PIXEL_DXT3',
  'PIXEL_ARGB8888',
  'PIXEL_ARGB1555',
  'PIXEL_ARGB4444',
  'PIXEL_RGB565',
  'PIXEL_A8',
  'PIXEL_DXT5',
  'PIXEL_UNSPECIFIED',
  'PIXEL_ARGB2565',
  'PIXEL_BC5'
]);
export type BlpCompression = n.output<typeof BlpCompression>;

export const BlpMipMap = n.enum(n.uint8(), [
  'MIPS_NONE',
  'MIPS_GENERATED',
  'MIPS_HANDMADE'
]);
export type BlpMipMap = n.output<typeof BlpMipMap>;

/**
 * Creates a schema for BLP palette data, which includes an image array and
 * an optional alpha array. The alpha array is only included if `alphaSize` is
 * greater than 0. The `pixelCount` parameter defines the number of pixels in
 * the image array.
 * @param alphaSize - The size of the alpha array, if applicable.
 * @param pixelCount - The number of pixels in the image array.
 * @returns A schema that describes the BLP palette data structure.
 */
export const BlpPaletteData = (alphaSize: number, pixelCount: number) =>
  n.object({
    img: n.array(n.uint8(), pixelCount),
    alpha: alphaSize ? PackedArray(alphaSize, pixelCount) : n.undefined()
  });

/**
 * Creates a fixed-length array schema that transforms the input array
 * by removing elements after the first occurrence of a specified fill value.
 * If `fillCanAppearOnce` is true, it will only remove elements after the
 * first occurrence of the fill value, allowing it to appear once in the output.
 * @param schema - The schema for the array elements.
 * @param length - The fixed length of the array.
 * @param fill - The value to look for in the array.
 * @param fillCanAppearOnce - If true, the fill value can appear once in the output.
 * @returns A schema that transforms the input array.
 */
export const FixedArray = <T extends n.NilTypeAny>(
  schema: T,
  length: number,
  fill: T['_input'],
  fillCanAppearOnce?: boolean
) =>
  n.array(schema, length).transform(
    ctx => {
      let idx = ctx.value.findIndex(val => isEqual(val, fill));
      if (fillCanAppearOnce)
        idx = ctx.value.findIndex((val, i) => isEqual(val, fill) && i > idx);

      return idx === -1 ? ctx.value : ctx.value.slice(0, idx);
    },
    ctx => [...Array(length).keys()].map((_, i) => ctx.value[i] ?? fill)
  );

/**
 * Creates a packed array schema that allows for efficient storage of
 * multiple values in a single byte. The `bits` parameter defines how many bits
 * each value will occupy, and the `length` parameter defines how many values
 * will be stored in the packed array.
 * @param bits - The number of bits each value will occupy.
 * @param length - The number of values to be stored in the packed array.
 * @returns A schema that transforms the input buffer into an array of values
 * and vice versa.
 */
export const PackedArray = (bits: number, length: number) =>
  n.buffer((bits * length) / 8).transform(
    ctx => {
      const arr: number[] = [];

      let i = 0;
      while (i < ctx.value.length * 8) {
        const bit = i % 8;
        const byte = Math.floor(i / 8);

        const b = ctx.value[byte] ?? 0;
        const val = (b >> bit) & (0xff >> (8 - bits));

        arr.push(val);
        i += bits;
      }
      return arr;
    },
    ctx => {
      const buffer = Buffer.alloc((ctx.value.length * bits) / 8, 0);
      let i = 0;
      while (i < buffer.length * 8) {
        const bit = i % 8;
        const byte = Math.floor(i / 8);

        if (ctx.value[i / bits] > 2 ** bits - 1)
          throw new Error(
            `BitsArray value "${ctx.value[i / bits]}" out of range`
          );

        buffer[byte] |= (ctx.value[i / bits] ?? 0) << bit;

        i += bits;
      }
      return buffer;
    }
  );
