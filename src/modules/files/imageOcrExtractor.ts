import { PSM } from 'tesseract.js';
import { PROCESSING_PROFILES, assessMaterial, type ProcessingProfile } from '../studies/materialReliability';
import { createLocalOcrWorker } from './localOcrWorker';

export interface ImageOcrProgress {
  progress: number;
  status: string;
}

export interface ImageOcrResult {
  text: string;
  confidence: number;
  language: 'por';
  imageQuality?: number;
}

const MAX_IMAGE_EDGE = 2200;
const MAX_IMAGE_PIXELS = 40_000_000;

interface OcrCandidate {
  text: string;
  confidence: number;
}

/** Keeps OCR selection deterministic and avoids preferring a long garbage result. */
export function chooseBestOcrCandidate(candidates: OcrCandidate[]): OcrCandidate {
  return [...candidates].sort((left, right) => {
    return assessMaterial(right.text, right.confidence).score - assessMaterial(left.text, left.confidence).score;
  })[0] ?? { text: '', confidence: 0 };
}

export function createPreprocessedVariants(source: HTMLCanvasElement): HTMLCanvasElement[] {
  const variants = [source];
  const gray = document.createElement('canvas');
  gray.width = source.width;
  gray.height = source.height;
  const grayContext = gray.getContext('2d', { willReadFrequently: true });
  if (!grayContext) return variants;
  grayContext.drawImage(source, 0, 0);
  const image = grayContext.getImageData(0, 0, gray.width, gray.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const luminance = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (luminance - 128) * 1.45 + 128));
    image.data[index] = contrast;
    image.data[index + 1] = contrast;
    image.data[index + 2] = contrast;
  }
  grayContext.putImageData(image, 0, 0);
  variants.push(gray);

  const threshold = document.createElement('canvas');
  threshold.width = source.width;
  threshold.height = source.height;
  const thresholdContext = threshold.getContext('2d', { willReadFrequently: true });
  if (!thresholdContext) return variants;
  thresholdContext.drawImage(gray, 0, 0);
  const thresholdImage = thresholdContext.getImageData(0, 0, threshold.width, threshold.height);
  for (let index = 0; index < thresholdImage.data.length; index += 4) {
    const value = thresholdImage.data[index] > 168 ? 255 : 0;
    thresholdImage.data[index] = value;
    thresholdImage.data[index + 1] = value;
    thresholdImage.data[index + 2] = value;
  }
  thresholdContext.putImageData(thresholdImage, 0, 0);
  variants.push(threshold);
  return variants;
}

/** Runs OCR on a photo locally in Safari/desktop and emits real worker progress. */
export async function extractImageTextWithLocalOcr(
  file: File,
  onProgress?: (progress: ImageOcrProgress) => void,
  options?: { profile?: ProcessingProfile; signal?: AbortSignal },
): Promise<ImageOcrResult> {
  options?.signal?.throwIfAborted();
  if (!file.type.toLowerCase().startsWith('image/')) throw new Error('Escolha uma imagem JPG, PNG, HEIC ou outro formato de foto.');
  if (file.size <= 0) throw new Error('A imagem está vazia.');
  if (typeof createImageBitmap !== 'function') throw new Error('Este navegador não oferece leitura local desta imagem. Salve a foto como JPG ou PNG e tente novamente.');

  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('Não consegui abrir esta foto neste navegador. No iPhone, tente compartilhar ou salvar como JPG/PNG e importar novamente.'); }
  }

  let worker: Awaited<ReturnType<typeof createLocalOcrWorker>> | undefined;
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('A foto não tem dimensões válidas.');
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new Error('A foto excede 40 megapixels e foi recusada para proteger a memória do dispositivo. Reduza a resolução e tente novamente.');

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Não foi possível preparar a foto para leitura.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    onProgress?.({ progress: 0, status: 'Preparando a foto para OCR local' });
    worker = await createLocalOcrWorker((status, progress) => onProgress?.({ progress: Math.min(0.95, progress * 0.95), status }));
    const profile = PROCESSING_PROFILES[options?.profile ?? 'board'];
    await worker.setParameters({ tessedit_pageseg_mode: profile.layout === 'sparse' ? PSM.SPARSE_TEXT : profile.layout === 'block' ? PSM.SINGLE_BLOCK : PSM.AUTO });
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0, squares = 0, count = 0;
    for (let i = 0; i < pixels.length; i += 64) { const value = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3; sum += value; squares += value * value; count++; }
    const contrast = Math.sqrt(Math.max(0, squares / count - (sum / count) ** 2));
    const imageQuality = Math.round(Math.min(100, contrast * 2, Math.min(bitmap.width, bitmap.height) / 6));
    const candidates: OcrCandidate[] = [];
    const variants = createPreprocessedVariants(canvas).slice(0, profile.variants);
    for (const [index, variant] of variants.entries()) {
      onProgress?.({ progress: Math.min(0.92, 0.08 + (index / variants.length) * 0.72), status: `Lendo versão ${index + 1} de ${variants.length} da foto` });
      options?.signal?.throwIfAborted();
      const abort = () => { void worker?.terminate(); };
      options?.signal?.addEventListener('abort', abort, { once: true });
      let recognized;
      try { recognized = await worker.recognize(variant); }
      finally { options?.signal?.removeEventListener('abort', abort); }
      options?.signal?.throwIfAborted();
      candidates.push({ text: recognized.data.text.trim(), confidence: Number.isFinite(recognized.data.confidence) ? recognized.data.confidence : 0 });
    }
    const best = chooseBestOcrCandidate(candidates);
    const text = best.text.trim();
    onProgress?.({ progress: 1, status: text ? `Texto reconhecido · confiança estimada em ${Math.round(best.confidence)}%` : 'Nenhum texto reconhecido' });
    if (!text) throw new Error('Não encontrei texto legível na foto. Tente uma imagem mais nítida, reta e bem iluminada.');
    return { text, confidence: best.confidence, imageQuality, language: 'por' };
  } finally {
    bitmap.close();
    await worker?.terminate();
  }
}
