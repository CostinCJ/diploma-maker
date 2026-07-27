// src/ui/importSources.js
// Every way a list of names can arrive: photos read by OCR, list files (Word,
// Excel, CSV, text), and pasted text. This module only reads them — it hands
// the names to the caller, which decides what to do with them. Photos are
// handed over with their file, because the caller keeps the photo too.
import { prepareImageFile } from '../ocr/preprocess.js';
import { readNamesFromImage } from '../ocr/readNames.js';
import { parseTextList } from '../shared/importList.js';
import { namesFromFile, SUPPORTED_EXTENSIONS } from '../shared/importFile.js';

const DOC_ACCEPT = SUPPORTED_EXTENSIONS.map((e) => '.' + e).join(',');
const isImage = (file) => file.type.startsWith('image/');

// The kids step re-initialises whenever the session is replaced, so the one
// document-level listener is swapped instead of stacking up.
let pasteHandler = null;

/**
 * @param container element to build the controls in
 * @param onNames   async ({ names, label, kind, file }) => void — awaited, so
 *                  the queue does not run ahead of the guide answering.
 * @param isActive  () => whether this step is on screen (for the paste key)
 * @param dropZone  element that accepts dropped files (defaults to container)
 */
export function createImportSources(container, { onNames, isActive, dropZone = container }) {
  container.innerHTML = `
    <input type="file" class="photo-input" accept="image/*" multiple hidden>
    <input type="file" class="doc-input" accept="${DOC_ACCEPT}" multiple hidden>
    <div class="toolbar">
      <button class="primary photo-btn">Importă poze cu liste…</button>
      <button class="primary doc-btn">Importă fișier…</button>
      <button class="small paste-btn">Lipește o listă</button>
      <span class="muted status"></span>
    </div>
    <p class="muted">
      Trage aici pozele sau fișierele (Word, Excel, CSV, text), lipește lista cu Ctrl+V,
      ori scrie numele unul câte unul. Numele apar mai jos — verifică-le cu poza alăturată
      și corectează unde e nevoie. Dacă ai importat ceva greșit, șterge importul din dreapta.
    </p>
    <div class="paste-panel" hidden>
      <textarea class="paste-box" rows="8"
        placeholder="Un nume pe rând — copiat din Word, Excel, WhatsApp sau e-mail."></textarea>
      <div class="toolbar">
        <button class="primary paste-add">Adaugă numele</button>
        <button class="small paste-cancel">Închide</button>
      </div>
    </div>`;

  const statusEl = container.querySelector('.status');
  const photoInput = container.querySelector('.photo-input');
  const docInput = container.querySelector('.doc-input');
  const pastePanel = container.querySelector('.paste-panel');
  const pasteBox = container.querySelector('.paste-box');

  // Files are queued rather than refused while one is being read: OCR runs one
  // page at a time (the worker is shared and each run sets the segmentation
  // mode), and dropping a second batch on the floor looked like the app had
  // simply ignored it.
  const queue = [];
  let working = false;

  const waiting = () => (queue.length ? ` (încă ${queue.length} în așteptare)` : '');

  async function readPhoto(file) {
    statusEl.textContent = `Se procesează ${file.name}…${waiting()}`;
    const prepared = await prepareImageFile(file);
    const { names } = await readNamesFromImage(
      prepared,
      async (dataUrl) => {
        const res = await window.api.ocrRecognize(dataUrl);
        if (!res.ok) throw new Error(res.error);
        return res.text;
      },
      // Several segmentation attempts may run; report which one is in flight
      // so a slow import does not look frozen.
      (label, n) => { statusEl.textContent = `${file.name}: încercarea ${n} (${label})…${waiting()}`; },
    );
    statusEl.textContent = '';
    if (!names.length) {
      alert(`Nicio linie recunoscută în ${file.name} — verifică poza și încearcă din nou.`);
    }
    await onNames({ names, label: file.name, kind: 'photo', file });
  }

  async function readDocument(file) {
    statusEl.textContent = `Se citește ${file.name}…${waiting()}`;
    const names = await namesFromFile(file.name, await file.arrayBuffer());
    statusEl.textContent = '';
    await onNames({ names, label: file.name, kind: 'file' });
  }

  async function work() {
    if (working) return;
    working = true;
    container.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      while (queue.length) {
        const file = queue.shift();
        try {
          await (isImage(file) ? readPhoto(file) : readDocument(file));
        } catch (err) {
          alert(err.message);
        }
      }
    } finally {
      statusEl.textContent = '';
      container.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      working = false;
    }
  }

  function enqueue(files) {
    const list = [...files];
    if (!list.length) return;
    queue.push(...list);
    if (!working) work();
  }

  container.querySelector('.photo-btn').addEventListener('click', () => photoInput.click());
  container.querySelector('.doc-btn').addEventListener('click', () => {
    docInput.click();
  });
  photoInput.addEventListener('change', () => { enqueue(photoInput.files); photoInput.value = ''; });
  docInput.addEventListener('change', () => { enqueue(docInput.files); docInput.value = ''; });

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    enqueue(e.dataTransfer.files);
  });

  function openPastePanel(text = '') {
    pastePanel.hidden = false;
    if (text) pasteBox.value = pasteBox.value ? `${pasteBox.value}\n${text}` : text;
    pasteBox.focus();
  }

  container.querySelector('.paste-btn').addEventListener('click', () => {
    if (pastePanel.hidden) openPastePanel(); else pastePanel.hidden = true;
  });
  container.querySelector('.paste-cancel').addEventListener('click', () => { pastePanel.hidden = true; });
  container.querySelector('.paste-add').addEventListener('click', async () => {
    const names = parseTextList(pasteBox.value);
    pasteBox.value = '';
    pastePanel.hidden = true;
    await onNames({ names, label: 'lista lipită', kind: 'paste' });
  });

  // Ctrl+V anywhere on this step: a screenshot of a list goes to OCR, text goes
  // to the paste box. Typing into a field is left alone.
  if (pasteHandler) document.removeEventListener('paste', pasteHandler);
  pasteHandler = (e) => {
    if (!isActive() || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const image = [...(e.clipboardData?.files ?? [])].find(isImage);
    if (image) {
      e.preventDefault();
      enqueue([image]);
      return;
    }
    const text = e.clipboardData?.getData('text') ?? '';
    if (text.trim()) {
      e.preventDefault();
      openPastePanel(text.trim());
    }
  };
  document.addEventListener('paste', pasteHandler);
}
