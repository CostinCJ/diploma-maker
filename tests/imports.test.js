// tests/imports.test.js
import { describe, it, expect } from 'vitest';
import { registerImport, appendNames, removeImport, countFromImport, typedNames } from '../src/shared/imports.js';

const sessionWith = (kids = [], imports = []) => ({ kids, imports });

describe('registerImport', () => {
  it('adds the source and hands back its id', () => {
    const s = sessionWith();
    const { id, imports } = registerImport(s, { label: 'lista.jpg', kind: 'photo' }, 'i1');
    expect(id).toBe('i1');
    expect(imports).toEqual([{ id: 'i1', label: 'lista.jpg', kind: 'photo', photo: '' }]);
    expect(s.imports).toEqual([]); // the caller decides when to commit it
  });

  it('carries the stored photo path when there is one', () => {
    const { imports } = registerImport(sessionWith(), { label: 'l.jpg', kind: 'photo', photo: '/data/i1.jpg' }, 'i1');
    expect(imports[0].photo).toBe('/data/i1.jpg');
  });

  it('mints an id when none is given', () => {
    const { id } = registerImport(sessionWith(), { label: 'x', kind: 'file' });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('appendNames', () => {
  it('tags every added name with the import it came from', () => {
    const s = sessionWith([{ name: 'A B', importId: '' }]);
    expect(appendNames(s, 'i1', ['C D', 'E F'])).toEqual([
      { name: 'A B', importId: '' },
      { name: 'C D', importId: 'i1' },
      { name: 'E F', importId: 'i1' },
    ]);
  });
});

describe('removeImport', () => {
  const session = () => sessionWith(
    [
      { name: 'TYPED', importId: '' },
      { name: 'FROM PHOTO', importId: 'i1' },
      { name: 'CORECTAT', importId: 'i1' },
      { name: 'FROM FILE', importId: 'i2' },
    ],
    [{ id: 'i1', label: 'lista.jpg', kind: 'photo', photo: '/data/i1.jpg' }, { id: 'i2', label: 'lista.docx', kind: 'file', photo: '' }],
  );

  // The whole point: a photo of the wrong group can be undone on its own,
  // instead of clearing the session and starting over.
  it('removes the source and every name still carried from it', () => {
    const { kids, imports } = removeImport(session(), 'i1');
    expect(kids).toEqual([{ name: 'TYPED', importId: '' }, { name: 'FROM FILE', importId: 'i2' }]);
    expect(imports).toEqual([{ id: 'i2', label: 'lista.docx', kind: 'file', photo: '' }]);
  });

  // A name is usually corrected after OCR read it; it still belongs to that
  // import, so matching by text would leave exactly the fixed rows behind.
  it('removes names that were edited after the import', () => {
    const s = session();
    s.kids[1].name = 'ALT NUME CU TOTUL';
    expect(removeImport(s, 'i1').kids.map((k) => k.name)).toEqual(['TYPED', 'FROM FILE']);
  });

  it('never touches names typed by hand', () => {
    const { kids } = removeImport(session(), 'i2');
    expect(kids.some((k) => k.name === 'TYPED')).toBe(true);
  });

  it('leaves the session alone for an unknown id', () => {
    const s = session();
    const { kids, imports } = removeImport(s, 'nope');
    expect(kids).toEqual(s.kids);
    expect(imports).toEqual(s.imports);
  });

  it('does not mutate the session it was given', () => {
    const s = session();
    removeImport(s, 'i1');
    expect(s.kids).toHaveLength(4);
    expect(s.imports).toHaveLength(2);
  });
});

describe('countFromImport', () => {
  it('counts only the names still in the list', () => {
    const kids = [{ name: 'A', importId: 'i1' }, { name: 'B', importId: 'i2' }];
    expect(countFromImport(kids, 'i1')).toBe(1);
    expect(countFromImport(kids, 'gone')).toBe(0);
  });
});

describe('typedNames', () => {
  it('picks out the rows that belong to no import', () => {
    const kids = [{ name: 'A', importId: '' }, { name: 'B', importId: 'i1' }];
    expect(typedNames(kids)).toEqual([{ name: 'A', importId: '' }]);
  });
});
