# haax-blp

Utility to convert BLP textures to and from PNG images.

## Usage

```
haax-blp [options] <files...>
```

### Arguments:

- `<...files>`: Space-separated list of full paths to blp or png files. If a directory path is provided, it will be searched for all png files that will be converted to blp.

### Options:

| Option                                              | Description                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `-c --compression <DXT1\|DXT3\|DXT5\|Palette\|Raw>` | Compression type (default: DXT5)                                                                                             |
| `-a --alpha <0\|1\|4\|8>`                           | Alpha size, 0 means no alpha, higher value means smoother edges but some compression formats may not support it (default: 8) |
| `-m --mips`                                         | Generate mipmaps (default: false)                                                                                            |

### Examples:

Converts Texture1.blp and Texture2.blp to PNG.

```
$ haax-blp path/to/Texture1.blp path/to/Texture2.blp
```

Converts all BLP and PNG files in a folder (and subfolders).

```
$ haax-blp path/to/folder
```

Converts Texture1.png to BLP using palette compression, 1-bit alpha and generated mipmaps.

```
$ haax-blp path/to/Texture1.png -c palette -a 1 -m
```

## Executable

You can also use this CLI as a standalone executable. Download `haax-blp.exe` for Windows or `haax-blp` for Linux. You can then drag & drop any files you want converted onto the executable.
