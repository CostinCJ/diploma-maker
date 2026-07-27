// src/shared/roText.js
// Romanian counting: the noun is joined to the number by "de" when the last two
// digits are 0 or 20 and above — 2 nume, 19 nume, 34 de nume, 100 de nume.
// Getting this wrong is the kind of thing every reader notices immediately.

const needsDe = (n) => n >= 20 && (n % 100 === 0 || n % 100 >= 20);

/** e.g. countedNoun(34, 'nume găsit', 'nume găsite') → '34 de nume găsite'. */
export function countedNoun(n, one, many) {
  if (n === 1) return `1 ${one}`;
  return `${n} ${needsDe(n) ? 'de ' : ''}${many}`;
}
