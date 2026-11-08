import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker, OEM } from 'tesseract.js';
import type { ExtractedPdfPage } from './pdfExtractor';

export const MAX_OCR_PAGES_PER_RUN = 20;
const MAX_RENDER_WIDTH = 1800;
const MIN_NATIVE_TEXT_LENGTH = 12;

export interface OcrProgress {
  currentPage: number;
  totalPages: number;
  progress: number;
  status: string;
}

export interface OcrPage extends ExtractedPdfPage {
  confidence: number | null;
  method: 'text' | 'ocr';
}

export interface OcrPdfResult {
  fileName: string;
  format: 'pdf';
  text: string;
  characterCount: number;
  wordCount: number;
  extractedAt: string;
  pageCount: number;
  pages: OcrPage[];
  extractionMethod: 'text' | 'ocr';
  language?: 'por';
}

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('Não foi possível decodificar o PDF para OCR.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o PDF para OCR.'));
    reader.onabort = () => reject(new Error('A leitura do PDF foi interrompida.'));
    reader.readAsArrayBuffer(file);
  });
}

function abortError(): Error {
  const error = new Error('Operação de OCR cancelada.');
  error.name = 'AbortError';
  return error;
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function pageTextFromContent(content: Awaited<ReturnType<pdfjsLib.PDFPageProxy['getTextContent']>>): string {
  return content.items
    .map((item) => ('str' in item ? item.str + ('hasEOL' in item && item.hasEOL ? '\n' : ' ') : ''))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildText(pages: OcrPage[]): string {
  return pages.map((page) => '[Página ' + page.pageNumber + ']\n' + page.text).join('\n\n').trim();
}

function assetUrl(relativePath: string): string {
  return new URL(import.meta.env.BASE_URL + 'ocr/' + relativePath, window.location.origin).toString();
}

async function createLocalOcrWorker(onStatus?: (status: string, progress: number) => void): Promise<OcrWorker> {
  return createWorker('por', OEM.LSTM_ONLY, {
    workerPath: assetUrl('worker.min.js'),
    corePath: assetUrl('core'),
    langPath: assetUrl('lang'),
    gzip: true,
    cacheMethod: 'write',
    workerBlobURL: false,
    logger: (message) => {
      if (message.status) onStatus?.(message.status, message.progress ?? 0);
    },
  });
}

/**
 * Recognizes only pages without a useful text layer. The PDF and page images
 * stay in the browser; worker, WebAssembly and Portuguese model are self-hosted.
 */
export async function extractPdfWithLocalOcr(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
  signal?: AbortSignal,
  now: () => Date = () => new Date(),
): Promise<OcrPdfResult> {
  if (file.size <= 0) throw new Error('O arquivo PDF está vazio.');
  assertNotAborted(signal);

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await readFileAsArrayBuffer(file)) });
  let document: pdfjsLib.PDFDocumentProxy | undefined;
  let ocrWorker: OcrWorker | undefined;

  try {
    document = await loadingTask.promise;
    if (document.numPages > MAX_OCR_PAGES_PER_RUN) {
      throw new Error('O OCR está limitado a 20 páginas por operação para proteger a memória e a bateria. Divida o PDF em partes menores.');
    }

    const pages: OcrPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      assertNotAborted(signal);
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        const nativeText = pageTextFromContent(content);
        if (nativeText.replace(/\s/g, '').length >= MIN_NATIVE_TEXT_LENGTH) {
          pages.push({ pageNumber, text: nativeText, confidence: null, method: 'text' });
          onProgress?.({ currentPage: pageNumber, totalPages: document.numPages, progress: pageNumber / document.numPages, status: 'Texto selecionável preservado' });
          continue;
        }

        if (!ocrWorker) {
          onProgress?.({ currentPage: pageNumber, totalPages: document.numPages, progress: 0, status: 'Preparando OCR local em português' });
          ocrWorker = await createLocalOcrWorker((status, pageProgress) => onProgress?.({
            currentPage: pageNumber,
            totalPages: document!.numPages,
            progress: Math.min(1, (pageNumber - 1 + pageProgress) / document!.numPages),
            status,
          }));
        }

        assertNotAborted(signal);
        const initialViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, MAX_RENDER_WIDTH / initialViewport.width);
        const viewport = page.getViewport({ scale });
        const canvas = window.document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Não foi possível preparar a imagem da página para OCR.');

        try {
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          assertNotAborted(signal);
          const recognized = await ocrWorker.recognize(canvas);
          const recognizedText = recognized.data.text.trim();
          pages.push({
            pageNumber,
            text: recognizedText,
            confidence: Number.isFinite(recognized.data.confidence) ? recognized.data.confidence : null,
            method: 'ocr',
          });
          onProgress?.({
            currentPage: pageNumber,
            totalPages: document.numPages,
            progress: pageNumber / document.numPages,
            status: recognizedText ? 'Página reconhecida' : 'Nenhum texto reconhecido nesta página',
          });
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      } finally {
        page.cleanup();
      }
    }

    assertNotAborted(signal);
    const text = buildText(pages);
    if (!text.replace(/\[Página \d+\]/g, '').trim()) {
      throw new Error('O OCR não encontrou texto legível. Tente um PDF com maior resolução e contraste.');
    }
    const words = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
    return {
      fileName: file.name,
      format: 'pdf',
      text,
      characterCount: text.length,
      wordCount: words.length,
      extractedAt: now().toISOString(),
      pageCount: document.numPages,
      pages,
      extractionMethod: pages.some((page) => page.method === 'ocr') ? 'ocr' : 'text',
      ...(pages.some((page) => page.method === 'ocr') ? { language: 'por' as const } : {}),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new Error('Este PDF está protegido por senha. Remova a proteção antes de aplicar OCR.');
    }
    throw error;
  } finally {
    await ocrWorker?.terminate();
    await loadingTask.destroy();
  }
}
