// tests/importList.test.js
import { describe, it, expect } from 'vitest';
import { normalizeName, splitCells, parseTableRows, parseTextList, planImport } from '../src/shared/importList.js';

describe('normalizeName', () => {
  it('collapses whitespace', () => {
    expect(normalizeName('  POPESCU   ION \n')).toBe('POPESCU ION');
  });

  it('folds the cedilla lookalikes Word writes onto the Romanian letters', () => {
    expect(normalizeName('GHIŢĂ ŞTEFAN')).toBe('GHIȚĂ ȘTEFAN');
  });

  it('leaves the written casing alone', () => {
    expect(normalizeName('Popescu Ion')).toBe('Popescu Ion');
  });

  it('drops a surname/first-name comma, which must not reach the diploma', () => {
    expect(normalizeName('Popescu, Ion')).toBe('Popescu Ion');
  });
});

describe('splitCells', () => {
  it('splits on tabs, semicolons, pipes and commas', () => {
    expect(splitCells('1\tPOPESCU;ION|A,B')).toEqual(['1', 'POPESCU', 'ION', 'A', 'B']);
  });

  it('keeps separators that are inside quotes', () => {
    expect(splitCells('"POPESCU, ION",12')).toEqual(['POPESCU, ION', '12']);
  });

  it('unescapes doubled quotes', () => {
    expect(splitCells('"a""b"')).toEqual(['a"b']);
  });
});

describe('parseTextList', () => {
  it('reads a plain one-name-per-line paste', () => {
    expect(parseTextList('Popescu Ion\nIonescu Maria\n\n')).toEqual(['Popescu Ion', 'Ionescu Maria']);
  });

  it('strips typed row numbers in any of the usual shapes', () => {
    expect(parseTextList('1. Popescu Ion\n2) Ionescu Maria\n3 - Radu Eric'))
      .toEqual(['Popescu Ion', 'Ionescu Maria', 'Radu Eric']);
  });

  it('drops a header row', () => {
    expect(parseTextList('Nr. crt.\tNumele și prenumele elevilor\n1\tPopescu Ion'))
      .toEqual(['Popescu Ion']);
  });

  it('joins a list split into Nume and Prenume columns', () => {
    expect(parseTextList('Nr;Nume;Prenume;Vârsta\n1;POPESCU;ION;12\n2;IONESCU;MARIA;11'))
      .toEqual(['POPESCU ION', 'IONESCU MARIA']);
  });

  it('drops non-name columns when there is no header to go by', () => {
    expect(parseTextList('1\tPOPESCU ION\t12\n2\tIONESCU MARIA\t11'))
      .toEqual(['POPESCU ION', 'IONESCU MARIA']);
  });

  it('keeps single-word names, which no column rule should discard', () => {
    expect(parseTextList('POPESCU\nIONESCU')).toEqual(['POPESCU', 'IONESCU']);
  });

  it('ignores lines with no letters', () => {
    expect(parseTextList('---\n12\nPopescu Ion')).toEqual(['Popescu Ion']);
  });

  it('returns nothing for empty input', () => {
    expect(parseTextList('')).toEqual([]);
    expect(parseTextList(null)).toEqual([]);
  });
});

describe('parseTableRows', () => {
  it('reads a table with the name column named in the header', () => {
    expect(parseTableRows([
      ['Nr. crt.', 'Numele și prenumele', 'Grupa'],
      ['1', 'Popescu Ion', 'A'],
      ['2', 'Ionescu Maria', 'B'],
    ])).toEqual(['Popescu Ion', 'Ionescu Maria']);
  });

  it('skips empty rows and trailing empty cells', () => {
    expect(parseTableRows([['Popescu Ion', ''], ['', ''], ['Ionescu Maria', '']]))
      .toEqual(['Popescu Ion', 'Ionescu Maria']);
  });
});

describe('planImport', () => {
  it('marks names already in the list and names repeated inside the batch', () => {
    expect(planImport(['POPESCU ION'], ['Radu Eric', 'popescu  ion', 'Radu Eric']))
      .toEqual([
        { name: 'Radu Eric', status: 'new' },
        { name: 'popescu  ion', status: 'existing' },
        { name: 'Radu Eric', status: 'repeat' },
      ]);
  });

  it('treats the two spellings of a diacritic as one name', () => {
    expect(planImport(['GHIȚĂ ELENA'], ['GHIŢĂ ELENA'])[0].status).toBe('existing');
  });
});
