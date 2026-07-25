// src/ui/setup.js
import { fileUrl, initSections } from '../renderer.js';
import { defaultSession } from '../shared/session.js';

const ASSETS = [
  { key: 'background', label: 'Fotografie de fundal (poza de grup)' },
  { key: 'logoLeft', label: 'Logo stânga' },
  { key: 'logoRight', label: 'Logo dreapta' },
];

export function init(state, save) {
  const el = document.getElementById('step-setup');
  el.innerHTML = `
    <h2>Sesiune</h2>
    <p><button class="small" id="clearSession">Sesiune nouă — șterge tot</button>
       <span class="muted">Șterge datele, pozele și listele de nume; șabloanele modificate rămân.</span></p>
    <div class="row">
      <label>Data început <input type="date" id="startDate"></label>
      <label>Data sfârșit <input type="date" id="endDate"></label>
    </div>
    <div class="row" style="margin-top:20px">
      ${ASSETS.map((a) => `
        <div>
          <div>${a.label}</div>
          <button class="small" data-asset="${a.key}">Alege imagine…</button>
          <img class="asset-thumb" id="thumb-${a.key}" alt="" hidden>
          <div class="error" id="err-${a.key}"></div>
        </div>`).join('')}
    </div>`;

  const startEl = el.querySelector('#startDate');
  const endEl = el.querySelector('#endDate');
  startEl.value = state.session.startDate;
  endEl.value = state.session.endDate;
  startEl.addEventListener('change', () => { state.session.startDate = startEl.value; save(); });
  endEl.addEventListener('change', () => { state.session.endDate = endEl.value; save(); });

  function refreshThumb(key) {
    const img = el.querySelector('#thumb-' + key);
    const err = el.querySelector('#err-' + key);
    err.textContent = '';
    const p = state.session[key];
    img.hidden = !p;
    if (p) {
      // Re-picking an image often yields the same path (kind + extension), so
      // clear src first to force a reload of the new file contents.
      img.src = '';
      img.src = fileUrl(p) + '?t=' + Date.now();
      img.onerror = () => { // corrupt/unreadable file → reject it
        err.textContent = 'Imaginea nu a putut fi încărcată — alege alt fișier.';
        state.session[key] = '';
        img.hidden = true;
        save();
      };
    }
  }

  el.querySelector('#clearSession').addEventListener('click', async () => {
    if (!confirm('Ștergi toate datele sesiunii curente (date, poze, nume)?\nȘabloanele modificate rămân.')) return;
    const templates = state.session.templates; // keep the user's edited wording
    state.session = { ...defaultSession(), templates };
    state.photos.forEach((p) => URL.revokeObjectURL(p.url));
    state.photos = [];
    save();
    await initSections();
  });

  ASSETS.forEach(({ key }) => {
    refreshThumb(key);
    el.querySelector(`[data-asset="${key}"]`).addEventListener('click', async () => {
      const p = await window.api.pickAsset(key);
      if (p) { state.session[key] = p; save(); refreshThumb(key); }
    });
  });
}
