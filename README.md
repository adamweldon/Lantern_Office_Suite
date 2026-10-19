# Lantern Office Suite

Single-file, offline-first, zero-dependency office and education suite for
low-end hardware. Public domain (CC0).

## Layout

| Path | What it is |
|---|---|
| `Lantern_Office_Suite.html` | The runnable, shareable file (self-unpacking bundle). Copy this one file to a phone, USB stick or SD card. |
| `src/lantern.inner.html` | The decoded inner suite: every `// MODULE: NAME - START/END` block. Edit and diff here; Project Context Studio ingests this directly. |
| `tools/bundle.js` | Byte-faithful decode / encode between the two. |

## Working on it

```sh
node tools/bundle.js decode Lantern_Office_Suite.html src/lantern.inner.html   # unpack
# ...edit modules in src/lantern.inner.html...
node tools/bundle.js encode Lantern_Office_Suite.html src/lantern.inner.html Lantern_Office_Suite.html  # repack
node tools/bundle.js check  Lantern_Office_Suite.html src/lantern.inner.html   # must print OK before committing
```

The encoder is the exact inverse of the bundler (`JSON.stringify`, then every
`</` written as `</`); every byte outside the payload line is copied
verbatim.
