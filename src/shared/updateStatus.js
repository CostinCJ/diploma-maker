// src/shared/updateStatus.js
// What the update bar says, kept away from the DOM so it can be read (and
// tested) on its own. The bar is above the guide's work, so it only ever
// appears when there is something to say: a check that found nothing, or one
// that failed on a laptop with no internet, shows nothing at all.

/** describeUpdate(status) → { text, action, actionLabel, dismissible } | null
 *
 *  `status` is what electron/updater.js sends:
 *    { state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error',
 *      version?, percent?, message? }
 *
 *  `action` is what the button does: 'download' | 'install' | null. */
export function describeUpdate(status) {
  const { state, version, percent, message } = status ?? {};
  const named = version ? `Versiunea ${version}` : 'O versiune nouă';

  switch (state) {
    case 'available':
      return {
        text: `${named} este disponibilă. Descărcarea are câțiva zeci de MB — pornește-o când ești pe o conexiune bună.`,
        action: 'download',
        actionLabel: 'Descarcă',
        dismissible: true,
      };
    case 'downloading':
      return {
        // No percentage until the first progress event, so the bar never
        // claims a confident "0%" while the download is still starting.
        text: Number.isFinite(percent)
          ? `Se descarcă actualizarea… ${Math.max(0, Math.min(100, Math.round(percent)))}%`
          : 'Se descarcă actualizarea…',
        action: null,
        actionLabel: '',
        dismissible: false,
      };
    case 'ready':
      return {
        text: `${named} este gata de instalat. Se instalează și la închiderea aplicației.`,
        action: 'install',
        actionLabel: 'Repornește și instalează',
        dismissible: true,
      };
    case 'error':
      return {
        text: `Actualizarea nu a putut fi descărcată${message ? `: ${message}` : '.'}`,
        action: null,
        actionLabel: '',
        dismissible: true,
      };
    default:
      // 'idle', 'checking', and anything a future version invents: silent.
      return null;
  }
}
