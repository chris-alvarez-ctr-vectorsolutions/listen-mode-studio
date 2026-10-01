export function download(name, blobOrText, type = 'application/json') {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const readPlain = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsText(file);
});

// PDF text, page by page, read in the browser. pdf.js is loaded only when a PDF is chosen.
async function readPdf(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    const text = content.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+\n/g, '\n').trim();
    pages.push(`[Page ${n}]\n${text}`);
  }
  return pages.join('\n\n');
}

export const readFileText = file => (/\.pdf$/i.test(file.name) ? readPdf(file) : readPlain(file));
