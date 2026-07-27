// tests/officeDocs.test.js
import { describe, it, expect } from 'vitest';
import { unzip, docxRows, xlsxRows, docxRowsFromXml, xlsxRowsFromXml, sharedStringsFromXml, isZip, isLegacyOffice } from '../src/shared/officeDocs.js';
import { namesFromFile, decodeText } from '../src/shared/importFile.js';
import { buildZip, buildDocx, buildXlsx } from './zipFixture.js';

const bytes = (arrayBuffer) => new Uint8Array(arrayBuffer);

describe('unzip', () => {
  it('reads both stored and deflated entries', async () => {
    const files = await unzip(buildZip({ 'a.txt': 'stored', 'b.txt': 'deflated '.repeat(50) }));
    const decoder = new TextDecoder();
    expect(decoder.decode(files.get('a.txt'))).toBe('stored');
    expect(decoder.decode(files.get('b.txt'))).toBe('deflated '.repeat(50));
  });

  it('rejects something that is not an archive', async () => {
    await expect(unzip(new Uint8Array(100).buffer)).rejects.toThrow(/arhivă/);
  });
});

describe('docx', () => {
  it('reads a list written as plain paragraphs', async () => {
    const rows = await docxRows(buildDocx(['Popescu Ion', 'Ionescu Maria']));
    expect(rows).toEqual([['Popescu Ion'], ['Ionescu Maria']]);
  });

  it('reads a list written as a Word table', async () => {
    const rows = await docxRows(buildDocx([[
      ['Nr.', 'Nume și prenume'],
      ['1', 'Popescu Ion'],
      ['2', 'Ionescu Maria'],
    ]]));
    expect(rows).toEqual([['Nr.', 'Nume și prenume'], ['1', 'Popescu Ion'], ['2', 'Ionescu Maria']]);
  });

  it('splits a tabbed paragraph into cells and keeps runs of one paragraph together', () => {
    const xml = '<w:body><w:p><w:r><w:t>1.</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Popescu </w:t>'
      + '<w:t>Ion</w:t></w:r></w:p></w:body>';
    expect(docxRowsFromXml(xml)).toEqual([['1.', 'Popescu Ion']]);
  });

  it('treats a manual line break as a new row', () => {
    const xml = '<w:p><w:r><w:t>Popescu Ion</w:t><w:br/><w:t>Ionescu Maria</w:t></w:r></w:p>';
    expect(docxRowsFromXml(xml)).toEqual([['Popescu Ion'], ['Ionescu Maria']]);
  });

  it('decodes XML entities in a name', () => {
    expect(docxRowsFromXml('<w:p><w:r><w:t>Ghi&#538;&#259; &amp; Fiii</w:t></w:r></w:p>'))
      .toEqual([['GhiȚă & Fiii']]);
  });

  it('reports a Word file that carries no document part', async () => {
    await expect(docxRows(buildZip({ 'other.xml': '<x/>' }))).rejects.toThrow(/word\/document\.xml/);
  });
});

describe('xlsx', () => {
  it('reads shared strings, inline strings and numbers', async () => {
    const rows = await xlsxRows(buildXlsx([
      ['Nr', 'Nume'],
      ['1', 'Popescu Ion'],
      ['2', 'Ionescu Maria'],
    ]));
    expect(rows).toEqual([['Nr', 'Nume'], ['1', 'Popescu Ion'], ['2', 'Ionescu Maria']]);
  });

  it('keeps later columns in place when a cell is missing', () => {
    const xml = '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Popescu</t></is></c>'
      + '<c r="C1" t="inlineStr"><is><t>Ion</t></is></c></row></sheetData>';
    expect(xlsxRowsFromXml(xml)).toEqual([['Popescu', '', 'Ion']]);
  });

  it('resolves multi-letter column references', () => {
    const xml = '<row r="1"><c r="AA1" t="s"><v>0</v></c></row>';
    expect(xlsxRowsFromXml(xml, ['Popescu Ion'])[0]).toHaveLength(27);
    expect(xlsxRowsFromXml(xml, ['Popescu Ion'])[0][26]).toBe('Popescu Ion');
  });

  it('joins the pieces of a rich-text shared string', () => {
    expect(sharedStringsFromXml('<sst><si><r><t>Popescu </t></r><r><t>Ion</t></r></si></sst>'))
      .toEqual(['Popescu Ion']);
  });
});

describe('namesFromFile', () => {
  it('turns a Word table into names', async () => {
    const docx = buildDocx([[
      ['Nr. crt.', 'Numele și prenumele elevilor'],
      ['1', 'Popescu Ion'],
      ['2', 'Ionescu Maria'],
    ]]);
    expect(await namesFromFile('lista.docx', docx)).toEqual(['Popescu Ion', 'Ionescu Maria']);
  });

  it('turns an Excel sheet into names', async () => {
    const xlsx = buildXlsx([['Nr', 'Nume', 'Prenume'], ['1', 'POPESCU', 'ION'], ['2', 'IONESCU', 'MARIA']]);
    expect(await namesFromFile('lista.xlsx', xlsx)).toEqual(['POPESCU ION', 'IONESCU MARIA']);
  });

  it('reads a CSV', async () => {
    const csv = new TextEncoder().encode('Nr,Nume\n1,"Popescu, Ion"\n2,Ionescu Maria\n');
    expect(await namesFromFile('lista.csv', csv.buffer)).toEqual(['Popescu Ion', 'Ionescu Maria']);
  });

  it('explains that a legacy .doc has to be re-saved', async () => {
    const doc = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await expect(namesFromFile('lista.doc', doc.buffer)).rejects.toThrow(/\.docx/);
  });

  it('refuses a file type it cannot read', async () => {
    await expect(namesFromFile('lista.pdf', new Uint8Array(8).buffer)).rejects.toThrow(/neacceptat/);
  });

  it('reports a .docx that is not actually a zip', async () => {
    await expect(namesFromFile('lista.docx', new Uint8Array(8).buffer)).rejects.toThrow(/deteriorat/);
  });
});

describe('decodeText', () => {
  it('falls back to the Windows encoding when the bytes are not UTF-8', () => {
    // "Ghiță" as Windows-1250 would be, i.e. invalid UTF-8.
    expect(decodeText(new Uint8Array([0x50, 0x6f, 0x70, 0xe3]))).toBe('Popã');
  });

  it('reads UTF-8 with its diacritics intact', () => {
    expect(decodeText(new TextEncoder().encode('GHIȚĂ ELENA'))).toBe('GHIȚĂ ELENA');
  });
});

describe('format sniffing', () => {
  it('recognises zip and legacy office headers', () => {
    expect(isZip(bytes(buildZip({ 'a.txt': 'x' })))).toBe(true);
    expect(isLegacyOffice(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toBe(true);
    expect(isLegacyOffice(bytes(buildZip({ 'a.txt': 'x' })))).toBe(false);
  });
});
