# Lantern Office Suite

Single-file, offline-first, zero-dependency office and education suite for
low-end hardware. Public domain (CC0).

Since v1.7 it includes **Compose**, a complete offline writing suite: guided
letters, CVs, essays and reports; a writing checker and live reading level in
Writer; a thesaurus; read-aloud proofreading; writing practice; mail merge;
and 18 writing lessons. See `docs/Lantern_Compose_Guide.pdf`.

## Layout

| Path | What it is |
|---|---|
| `Lantern_Office_Suite.html` | The runnable, shareable file (self-unpacking bundle). Copy this one file to a phone, USB stick or SD card. |
| `src/lantern.inner.html` | The decoded inner suite: every `// MODULE: NAME - START/END` block. Edit and diff here; Project Context Studio ingests this directly. |
| `tools/bundle.js` | Byte-faithful decode / encode between the two. |
| `tests/` | Every check the suite must pass before a commit (`npm test`). |
| `docs/Lantern_Compose_Guide.pdf` | What the Compose writing suite does, how to use it, and how it is built. |
| `docs/Lantern_v1_6_Review.pdf` | How v1.6 was rebuilt from session history, what was fixed, what is still missing. |
| `CHANGELOG.md` | Version history. |

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

## Testing

```sh
npm install   # dev tooling only (jsdom, acorn); the suite itself has no dependencies
npm test
```

`npm test` runs, against `src/lantern.inner.html`:

- **bundle check**: the shareable file decodes exactly to the source
- **structure**: START/END marker balance, size gate, no code outside modules, no 4+ blank lines, ES5-ES2017 only, `node --check`
- **regex quotes**: no quote characters inside regex literals (they desync string-blind lexers such as Project Context Studio's gate)
- **boot tour**: boots the inner script the way the self-unpacking bundle does (after DOMContentLoaded), requires every app on the first home paint, then opens every app and fails on any exception
- **recovered session suites**: the July 13 page-size smoke + pagination geometry tests and the July 20 Deckplate, Assist/Astro and Forge/Chat suites, regenerated from those chats
- **compose engine**: the checker against correct and incorrect sentences (including clean text that must raise no alarms), readability maths, spelling and thesaurus data
- **compose app**: Compose and Writer driven end to end (tasks, Preview, Open in Writer, Check, Fix all safe, Words, Read aloud, Practice, Mail merge, lessons, self-tests)
- **compose isolation**: removes each of the 32 Compose modules in turn and requires the rest of the suite to boot and run without errors (rule 11)
