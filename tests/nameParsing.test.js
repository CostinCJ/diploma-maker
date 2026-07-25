// tests/nameParsing.test.js
import { describe, it, expect } from 'vitest';
import { parseNamesFromOcrText } from '../src/shared/nameParsing.js';

// Fictional names, shaped like real OCR output from a printed participant list.
const SAMPLE = `TABEL PARTICIPANTI LA TABARA DE MUNTE
NR.
Numele si prenumele elevilor
1. | POPESCU ALEXANDRU
2. IONESCU ȘTEFAN
3. .DUMITRESCU MIHNEA
32. PĂUNESCU ȘTEFAN

38. GHIȚĂ ELENA
47. MARIN PATRICK
`;

describe('parseNamesFromOcrText', () => {
  it('extracts names, dropping headers and row numbers', () => {
    expect(parseNamesFromOcrText(SAMPLE)).toEqual([
      'POPESCU ALEXANDRU',
      'IONESCU ȘTEFAN',
      'DUMITRESCU MIHNEA',
      'PĂUNESCU ȘTEFAN',
      'GHIȚĂ ELENA',
      'MARIN PATRICK',
    ]);
  });

  it('preserves Romanian diacritics', () => {
    expect(parseNamesFromOcrText('30. BRĂTIANU ANDREI')).toEqual(['BRĂTIANU ANDREI']);
  });

  it('drops lines with no letters and empty lines', () => {
    expect(parseNamesFromOcrText('12.\n---\n\n')).toEqual([]);
  });

  it('keeps hyphenated compound names intact', () => {
    expect(parseNamesFromOcrText('31. MICU-GEORGESCU-VLAD IOAN')).toEqual(['MICU-GEORGESCU-VLAD IOAN']);
  });

  it('strips trailing OCR junk symbols and stray letter fragments', () => {
    const noisy = `16. STOICA OCTAVIAN ]
17. BARBU MATHIAS ——
19. RADU ERIC "
20. NEGRU DAVID ;
21. LAZAR ERIK a E a,
23. SANDU NATALIA >=,
25. " COMAN EVA
27. i ALBU NORA
28. *ă) BRĂTIANU ANDREI`;
    expect(parseNamesFromOcrText(noisy)).toEqual([
      'STOICA OCTAVIAN',
      'BARBU MATHIAS',
      'RADU ERIC',
      'NEGRU DAVID',
      'LAZAR ERIK',
      'SANDU NATALIA',
      'COMAN EVA',
      'ALBU NORA',
      'BRĂTIANU ANDREI',
    ]);
  });

  it('drops rows that are pure OCR noise', () => {
    expect(parseNamesFromOcrText('37. Îi A\n38. a :\n40. DD jet\n41. a: bă 0 că')).toEqual([]);
  });

  it('keeps mangled-but-recoverable rows for manual fixing', () => {
    expect(parseNamesFromOcrText('34. ÎN VLAD MARIA')).toEqual(['ÎN VLAD MARIA']);
  });

  it('keeps single-word rows when OCR merges a name into one token', () => {
    expect(parseNamesFromOcrText('12. POPESCUMARIA')).toEqual(['POPESCUMARIA']);
  });
});
