import { createWorker, OEM } from 'tesseract.js';

export type LocalOcrWorker = Awaited<ReturnType<typeof createWorker>>;

function assetUrl(relativePath: string): string {
  return new URL(import.meta.env.BASE_URL + 'ocr/' + relativePath, window.location.origin).toString();
}

/** Starts the bundled Portuguese OCR worker. It never sends images to a service. */
export async function createLocalOcrWorker(onStatus?: (status: string, progress: number) => void): Promise<LocalOcrWorker> {
  return createWorker('por', OEM.LSTM_ONLY, {
    workerPath: assetUrl('worker.min.js'),
    corePath: assetUrl('core'),
    langPath: assetUrl('lang'),
    gzip: true,
    cacheMethod: 'write',
    workerBlobURL: false,
    // Jobs already reject their promises; do not also throw outside the pipeline.
    errorHandler: () => {},
    logger: (message) => {
      if (message.status) onStatus?.(message.status, message.progress ?? 0);
    },
  });
}
