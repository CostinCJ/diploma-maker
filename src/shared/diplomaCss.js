// src/shared/diplomaCss.js — layout matches the existing printed diploma.
export const DIPLOMA_CSS = `
.diploma {
  position: relative; width: 297mm; height: 210mm; overflow: hidden;
  page-break-after: always; background: #fff;
  font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a;
}
.diploma .bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; opacity: 0.5;
}
.diploma .logo { position: absolute; top: 10mm; width: 35mm; height: auto; }
.diploma .logo.left { left: 10mm; }
.diploma .logo.right { right: 10mm; }
.diploma .content {
  position: absolute; inset: 0; padding: 0 25mm;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8mm; text-align: center;
}
.diploma h1 { font-size: 40pt; font-weight: bold; margin: 0; }
.diploma .award { font-size: 16pt; letter-spacing: 1px; margin: 0; }
.diploma .name {
  font-size: 26pt; font-weight: bold; margin: 0;
  min-width: 100mm; padding: 0 10mm 2mm; border-bottom: 1px dotted #444;
}
.diploma .part { font-size: 16pt; font-style: italic; margin: 0; }
.diploma .dates { font-size: 14pt; margin: 0; }
@media print { @page { size: A4 landscape; margin: 0; } body { margin: 0; } }
`;
