# Diploma Maker

**Offline diploma generator for summer camp sessions.**

Camp guides used to hand-write every participant's name on pre-printed diplomas. Diploma Maker replaces that: photograph the participant list, let offline OCR read the names, correct anything it got wrong, and print one diploma per person.

Built as a Windows desktop app (Electron) with a **hard privacy constraint — children's names never leave the machine.** No cloud APIs, no telemetry, no network requests of any kind. The app works fully offline, by design.

> The user interface is in Romanian, matching its users. The codebase and docs are in English.

---

## Features

- **Session setup** — start/end dates, a group background photo, and two corner logos, shared by every diploma in the session.
- **Bulk import via OCR** — drop in phone photos of printed participant lists; names land in an editable, numbered table next to the original photo so every row can be verified by eye.
- **Image preprocessing** — grayscale, full-range contrast stretch, and adaptive local thresholding (summed-area table for O(1) window means) so creased, curved, and unevenly lit phone photos still read cleanly.
- **Romanian-aware parsing** — diacritics (Ș Ț Ă Î Â) preserved; header rows, row numbers, and OCR junk stripped heuristically. No row is ever silently deleted.
- **Manual teacher list** — a separate, simple list for the handful of accompanying teachers.
- **Editable templates** — fixed diploma layout, fully editable wording, with two variants (kid / teacher) and a live preview using real session assets.
- **Print & export** — print the whole session, kids only, or teachers only; or export the same render to PDF. One landscape A4 diploma per page — preview is the print output.
- **Persistent sessions** — everything is stored locally in the app data directory and can be reopened later.

## Privacy by design

This app handles minors' names, so privacy is a functional requirement, not a nice-to-have:

- The Romanian Tesseract model (`ron.traineddata`, tessdata_best) is **bundled in the installer**. Nothing is ever downloaded at runtime — if the model file is missing, OCR fails loudly rather than silently falling back to a CDN.
- No `fetch`/HTTP code exists anywhere in the app. It runs correctly with networking disabled.
- The renderer runs behind a `contextBridge` preload with a strict Content-Security-Policy (`default-src 'self'`); the print window is sandboxed.
- The temporary print document containing the names is deleted immediately after printing or PDF export.

## Getting started

**Requirements:** Node.js 18+ and Windows (for packaging; development works anywhere Electron runs).

```bash
git clone https://github.com/CostinCJ/diploma-maker.git
cd diploma-maker
npm install
```

The OCR model is not checked into the repository. Download the Romanian **tessdata_best** model and place it at `ocr-data/ron.traineddata`:

```bash
curl -L -o ocr-data/ron.traineddata https://github.com/tesseract-ocr/tessdata_best/raw/main/ron.traineddata
```

Then run the app:

```bash
npm start
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Launch the app in development |
| `npm test` | Run the unit test suite (Vitest) |
| `npm run dist` | Build the Windows NSIS installer via electron-builder |

To verify a packaged build loads the bundled OCR model, run the app with `DIPLOME_OCR_SELFTEST=1`; it runs the real OCR code path and prints `OCR_SELFTEST_OK` or `OCR_SELFTEST_FAIL`, then exits.

## Project structure

```
electron/
  main.js            Main process: session storage, asset copying, OCR worker, print/PDF
  preload.js         contextBridge API surface exposed to the renderer
src/
  index.html         Five-step shell (session → kids → teachers → templates → generate)
  renderer.js        Step routing and session bootstrap
  ocr/preprocess.js  Grayscale, contrast stretch, adaptive thresholding
  shared/            Pure logic: name parsing, templates, validation, diploma HTML/CSS
  ui/                One module per step
tests/               Vitest unit tests for the pure shared logic
ocr-data/            Bundled Tesseract model (gitignored — see Getting started)
docs/                Design spec and implementation plan
```

The `shared/` modules are deliberately free of DOM and Electron dependencies, so the parsing, templating, validation, and diploma-rendering logic is unit-tested directly.

## Tech stack

Electron 33 · tesseract.js 5 · Vitest 2 · electron-builder 25 · vanilla ES modules (no framework, no bundler)

## Testing

```bash
npm test
```

Unit tests cover OCR post-processing (header filtering, row-number stripping, diacritic preservation), template substitution, session persistence, validation rules, and diploma HTML rendering.

## License

[MIT](LICENSE)
