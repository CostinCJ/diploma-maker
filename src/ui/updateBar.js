// src/ui/updateBar.js
// A strip under the app bar, shown only when there is an update to talk about.
// Not one of the five steps: it is not part of the work, and it must never
// take the screen away from the step the guide is on.
import { describeUpdate } from '../shared/updateStatus.js';

export function initUpdateBar() {
  const el = document.getElementById('updateBar');
  if (!el || !window.api?.onUpdateStatus) return;

  // Dismissing hides the current announcement, not every future one: a
  // download that finishes later still gets to say so.
  let dismissed = null;

  function render(status) {
    const info = describeUpdate(status);
    if (!info || (dismissed && dismissed === status.state)) {
      el.hidden = true;
      el.replaceChildren();
      return;
    }
    el.hidden = false;
    el.replaceChildren();

    const text = document.createElement('span');
    text.className = 'update-text';
    text.textContent = info.text;
    el.append(text);

    if (info.action) {
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = info.actionLabel;
      btn.addEventListener('click', () => {
        btn.disabled = true;
        if (info.action === 'download') window.api.downloadUpdate();
        else window.api.installUpdate();
      });
      el.append(btn);
    }

    if (info.dismissible) {
      const close = document.createElement('button');
      close.className = 'update-close';
      close.title = 'Ascunde';
      close.setAttribute('aria-label', 'Ascunde anunțul');
      close.textContent = '×';
      close.addEventListener('click', () => {
        dismissed = status.state;
        render(status);
      });
      el.append(close);
    }
  }

  window.api.onUpdateStatus((status) => {
    dismissed = null; // a new state is a new thing to say
    render(status);
  });
  // The check can finish before this page has loaded, so ask for where it got
  // to instead of waiting for an event that has already been sent.
  window.api.updateStatus().then(render).catch(() => {});
}
