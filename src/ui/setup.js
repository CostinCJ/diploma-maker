// src/ui/setup.js
import { useSession, flushSave } from '../renderer.js';
import { fileUrl } from '../shared/fileUrl.js';
import { formatDateRo } from '../shared/template.js';
import { countedNoun } from '../shared/roText.js';

const ASSETS = [
  { key: 'background', label: 'Fotografie de fundal (poza de grup)' },
  { key: 'logoLeft', label: 'Logo stânga' },
  { key: 'logoRight', label: 'Logo dreapta' },
];

/** What to call a session that was never named: its dates, or nothing yet. */
function describe({ name, startDate, endDate, kids, teachers }) {
  const dates = startDate && endDate ? `${formatDateRo(startDate)} – ${formatDateRo(endDate)}` : '';
  const title = name || dates || 'Sesiune fără nume';
  const counts = [
    kids ? countedNoun(kids, 'copil', 'copii') : '',
    teachers ? countedNoun(teachers, 'însoțitor', 'însoțitori') : '',
  ].filter(Boolean).join(', ');
  return counts ? `${title} — ${counts}` : title;
}

export function init(state, save) {
  const el = document.getElementById('step-setup');
  el.innerHTML = `
    <h2>Sesiune</h2>
    <div class="toolbar">
      <label>Sesiunea deschisă <select id="sessionPicker"></select></label>
      <button class="small" id="newSession">+ Sesiune nouă</button>
      <button class="small" id="deleteSession">✕ Șterge sesiunea</button>
    </div>
    <p class="muted">
      Fiecare serie are sesiunea ei — listele, pozele și imaginile rămân separate,
      iar șabloanele modificate se preiau într-o sesiune nouă.
    </p>
    <div class="row">
      <label>Nume sesiune <input type="text" id="sessionName" placeholder="ex. Seria 1 — iulie"></label>
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
    </div>
    <p style="margin-top:24px">
      <button class="small" id="deleteEverything">Șterge toate sesiunile</button>
      <span class="muted">De folosit înainte de a preda laptopul: șterge toate numele, pozele și imaginile.</span>
    </p>`;

  const nameEl = el.querySelector('#sessionName');
  const startEl = el.querySelector('#startDate');
  const endEl = el.querySelector('#endDate');
  const picker = el.querySelector('#sessionPicker');

  nameEl.value = state.session.name;
  startEl.value = state.session.startDate;
  endEl.value = state.session.endDate;
  // The picker shows the name and the dates, so it has to follow them as typed.
  nameEl.addEventListener('input', () => { state.session.name = nameEl.value; save(); refreshPicker(); });
  startEl.addEventListener('change', () => { state.session.startDate = startEl.value; save(); refreshPicker(); });
  endEl.addEventListener('change', () => { state.session.endDate = endEl.value; save(); refreshPicker(); });

  async function refreshPicker() {
    const sessions = await window.api.listSessions();
    picker.innerHTML = '';
    for (const entry of sessions) {
      const option = document.createElement('option');
      option.value = entry.id;
      // The open session is described from the live state: it may hold edits
      // that have not been written yet.
      option.textContent = entry.id === state.sessionId
        ? describe({
          name: state.session.name,
          startDate: state.session.startDate,
          endDate: state.session.endDate,
          kids: state.session.kids.length,
          teachers: state.session.teachers.length,
        })
        : describe(entry);
      option.selected = entry.id === state.sessionId;
      picker.appendChild(option);
    }
    el.querySelector('#deleteSession').disabled = sessions.length < 2;
  }

  picker.addEventListener('change', async () => {
    await flushSave(); // the edits so far belong to the session being left
    const opened = await window.api.openSession(picker.value);
    if (opened) await useSession(opened);
  });

  el.querySelector('#newSession').addEventListener('click', async () => {
    await flushSave();
    // Carry over the wording the guide edited; nothing else belongs to a shift.
    const created = await window.api.createSession({ templates: state.session.templates });
    await useSession(created);
  });

  el.querySelector('#deleteSession').addEventListener('click', async () => {
    const what = describe({
      name: state.session.name,
      startDate: state.session.startDate,
      endDate: state.session.endDate,
      kids: state.session.kids.length,
      teachers: state.session.teachers.length,
    });
    if (!confirm(`Ștergi sesiunea „${what}” cu tot ce conține (nume, poze, imagini)?`)) return;
    await useSession(await window.api.deleteSession(state.sessionId));
  });

  el.querySelector('#deleteEverything').addEventListener('click', async () => {
    if (!confirm('Ștergi toate sesiunile, cu toate numele și pozele?\nNu se mai poate reveni.')) return;
    await useSession(await window.api.deleteAllSessions());
  });

  function refreshThumb(key) {
    const img = el.querySelector('#thumb-' + key);
    const err = el.querySelector('#err-' + key);
    err.textContent = '';
    const p = state.session[key];
    img.hidden = !p;
    if (p) {
      // Each pick lands on its own filename (see asset:pick), so the URL always
      // differs from the previous one and no cache-busting query is needed.
      img.src = fileUrl(p);
      img.onerror = () => { // corrupt/unreadable file → reject it
        err.textContent = 'Imaginea nu a putut fi încărcată — alege alt fișier.';
        state.session[key] = '';
        img.hidden = true;
        save();
      };
    }
  }

  ASSETS.forEach(({ key }) => {
    refreshThumb(key);
    el.querySelector(`[data-asset="${key}"]`).addEventListener('click', async () => {
      // The copy being replaced is named explicitly: another session may hold a
      // picture of the same kind, and only this one may be deleted.
      const p = await window.api.pickAsset(key, state.session[key]);
      if (p) { state.session[key] = p; save(); refreshThumb(key); }
    });
  });

  refreshPicker();
}
