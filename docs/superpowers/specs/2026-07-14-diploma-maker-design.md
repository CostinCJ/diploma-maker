# Diploma Maker — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning

## Purpose

A Windows desktop application that generates printable participation diplomas for summer camp sessions (Tabere Apuseni). Camp guides currently hand-write each participant's name on pre-printed diplomas. This app replaces handwriting: it extracts kids' names from photos of participant lists via offline OCR, lets the guide correct them, and prints one diploma per person.

**Hard constraint — privacy:** Children's names must never leave the user's machine. No cloud APIs, no network requests of any kind. All OCR and processing runs locally. The app must work fully offline.

## Users & context

- Single user (camp guide) on Windows 11.
- Input: phone photos of printed participant lists (Romanian names, uppercase, with diacritics Ș Ț Ă Î Â; photos may be skewed, curved, glary).
- Typical batch: ~47 kids + a few teachers per session.
- Output: printed A4/landscape diplomas matching the existing design (faded group-photo background, two logos, centered text block).

## Platform & architecture

- **Electron** desktop app packaged as a Windows installer (`.exe`).
- **OCR:** Tesseract (tesseract.js or bundled native binary) with the Romanian language pack (tessdata_best, accuracy-optimized), bundled inside the app — no downloads at runtime. A photo-type selector (table/single-column vs. free-form) sets the page-segmentation mode.
- **Rendering:** diplomas laid out in HTML/CSS; print via Electron's print pipeline; PDF export via the same renderer, so preview = print output.
- **Persistence:** all session data (dates, images, templates, name lists) stored locally (app data directory, JSON + copied image files). Sessions can be reopened later.
- **Network:** the app makes zero network requests. This is verified by design (no fetch/HTTP code) and should be testable with networking disabled.

## Workflow (5 sections in the UI)

### 1. Session setup
- Two date pickers: session **start** and **end** date. Rendered on diplomas as `în perioada DD.MM.YYYY - DD.MM.YYYY`.
- Upload **background photo** (group photo, rendered faded/washed behind text).
- Upload **logo left** and **logo right** (rendered top corners).
- These assets are shared by all diplomas in the session.
- A **"new session"** button (with confirmation) clears dates, images, and both name lists so a fresh session can be set up; the templates keep their edited wording.

### 2. Kids (bulk import via OCR)
- Drag & drop or file-pick one or more photos of participant lists. Multiple photos append rows to the same list.
- Light image preprocessing before OCR (grayscale, contrast stretch, adaptive local thresholding; slight skew is tolerated by Tesseract's own line detection) to improve accuracy on phone photos.
- OCR extracts names into an editable numbered table.
- OCR heuristics: ignore header rows ("NR.", "Numele si prenumele elevilor", titles), strip row numbers, keep one name per row.
- The original photo is displayed alongside the table so the user can visually verify each row.
- Table operations: inline edit, add row, delete row, reorder.
- Names are stored and printed **exactly as listed** (surname first, uppercase as extracted, user-editable).

### 3. Teachers (manual entry)
- A separate, simple list: type each teacher's name; add/edit/delete rows.
- No OCR needed (few teachers per session).

### 4. Templates (two tabs: Kid / Teacher)
- **Fixed layout, editable content** — layout matches the existing diploma:
  - two logos top corners
  - title line (default: `Diplomă de participare`)
  - award line (Kid default: `SE ACORDĂ ELEVULUI/ELEVEI`; Teacher default: `SE ACORDĂ D-NEI ÎNSOȚITOARE`)
  - **name slot** (auto-filled per person)
  - participation line (default: `pentru participarea la TABERE APUSENI`)
  - date line (auto-filled from session dates: `în perioada {start} - {end}`)
- Every text line is editable per template; edits persist with the session. Gender-inclusive wording (e.g. ELEVULUI/ELEVEI) is handled purely in the editable text — no per-person gender data.
- Live preview pane shows the template with a sample name, the real session dates, and the uploaded background/logos.

### 5. Generate & print
- Preview all diplomas (kid batch uses Kid template, teacher batch uses Teacher template).
- Print: whole session, kids only, or teachers only.
- Export to PDF (same options) as an alternative to direct printing.
- One diploma per page, landscape.

## Error handling

- **OCR failures / garbage rows:** user fixes in the editable table; no row is ever auto-deleted silently.
- **Missing assets:** generation is blocked with a clear message if dates, background, or logos are missing (user can proceed intentionally without logos/background if desired via confirmation).
- **Empty lists:** printing a batch with zero names is blocked with a message.
- **Bad image files:** unsupported/corrupt uploads rejected with a friendly error.

## Testing

- Unit tests for OCR post-processing (header filtering, row-number stripping, diacritic preservation).
- Unit tests for template rendering (name/date substitution).
- Manual acceptance test: run the full flow on the real sample list photo (47 names) with networking disabled; verify accuracy, editability, and that printed output matches preview.

## Out of scope (YAGNI)

- Cloud sync, multi-user, accounts.
- Freeform/drag-and-drop template designer (fixed layout only).
- Per-person gender toggles.
- Handwriting recognition (lists are printed text).
- Auto-updates (would require network; installer is distributed manually).
