declare module 'dxt-js' {
  enum DxtFlags {
    DXT1,
    DXT3,
    DXT5,
    ColourIterativeClusterFit,
    ColourClusterFit,
    ColourRangeFit,
    ColourMetricPerceptual,
    ColourMetricUniform,
    WeightColourByAlpha
  }

  const compress: (
    imageDate: Uint8Array,
    width: number,
    height: number,
    compression: DxtFlags
  ) => Uint8Array;

  const decompress: (
    imageDate: Uint8Array,
    width: number,
    height: number,
    compression: DxtFlags
  ) => Uint8Array;

  export default {
    flags: DxtFlags,
    compress,
    decompress
  };
}

declare module 'rgbquant' {
  export type ImageType = number[] | Uint8Array | ImageData;

  export default class RgbQuant {
    constructor(options: { palette: number[][] });

    sample(image: ImageType, width?: number): void;
    palette(tuples: boolean, noSort: boolean): number[][];
    reduce<T extends ImageType>(
      image: T,
      retType?: 1 | 2,
      dithKern?: string,
      dithSerp?: boolean
    ): Promise<T>;
  }
}
