import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
  confidence?: number | null;
  method?: 'text' | 'ocr';
}

export interface ExtractedPdfDocument {
  fileName: string;
  format: 'pdf';
  text: string;
  characterCount: number;
  wordCount: number;
  extractedAt: string;
  extractionMethod: 'text';
  pageCount: number;
  pages: ExtractedPdfPage[];
}

export const MAX_PDF_PAGES_PER_EXTRACTION = 300;

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('Não foi possível decodificar o PDF.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o PDF.'));
    reader.onabort = () => reject(new Error('A leitura do PDF foi interrompida.'));
    reader.readAsArrayBuffer(file);
  });
}

export async function extractPdfDocument(
  file: File,
  now: () => Date = () => new Date(),
): Promise<ExtractedPdfDocument> {
  if (file.size <= 0) throw new Error('O arquivo PDF está vazio.');

  const data = new Uint8Array(await readFileAsArrayBuffer(file));
  const loadingTask = pdfjsLib.getDocument({ data });
  let document: pdfjsLib.PDFDocumentProxy | undefined;

  try {
    document = await loadingTask.promise;
    if (document.numPages > MAX_PDF_PAGES_PER_EXTRACTION) {
      throw new Error('Este PDF possui mais de 300 páginas. Divida o documento em partes menores para leitura nesta versão.');
    }

    const pages: ExtractedPdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str + ('hasEOL' in item && item.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      pages.push({ pageNumber, text: pageText });
      page.cleanup();
    }

    const text = pages
      .map((page) => '[Página ' + page.pageNumber + ']\n' + page.text)
      .join('\n\n')
      .trim();

    if (!text.replace(/\[Página \d+\]/g, '').trim()) {
      throw new Error('O PDF não contém texto selecionável. Ele pode ser um documento digitalizado; será necessário aplicar OCR.');
    }

    const words = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
    return {
      fileName: file.name,
      format: 'pdf',
      text,
      characterCount: text.length,
      wordCount: words.length,
      extractedAt: now().toISOString(),
      extractionMethod: 'text',
      pageCount: document.numPages,
      pages,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error('Este PDF está protegido por senha. Remova a proteção antes de importá-lo.');
    }
    throw error;
  } finally {
    await loadingTask.destroy();
  }
}
