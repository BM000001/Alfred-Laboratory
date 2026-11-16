import { createLocalOcrWorker } from './localOcrWorker';

export interface ImageOcrProgress {
  progress: number;
  status: string;
}

export interface ImageOcrResult {
  text: string;
  confidence: number;
  language: 'por';
  preprocessing: ImageOcrPreprocessing;
}

export type ImageOcrPreprocessing = 'original' | 'contrast' | 'threshold';

const MAX_IMAGE_EDGE = 2400;
const MAX_IMAGE_PIXELS = 40_000_000;

function percentile(histogram: Uint32Array, target: number, total: number): number {
  let count = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    count += histogram[value];
    if (count >= total * target) return value;
  }
  return 255;
}

function otsuThreshold(histogram: Uint32Array, total: number): number {
  let sum = 0;
  for (let value = 0; value < histogram.length; value += 1) sum += value * histogram[value];
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 127;
  for (let value = 0; value < histogram.length; value += 1) {
    backgroundWeight += histogram[value];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * histogram[value];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) { bestVariance = variance; threshold = value; }
  }
  return threshold;
}

function renderVariant(bitmap: ImageBitmap, canvas: HTMLCanvasElement, variant: ImageOcrPreprocessing): void {
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: variant !== 'original' });
  if (!context) throw new Error('Não foi possível preparar a foto para leitura.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if (variant === 'original') return;

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const histogram = new Uint32Array(256);
  const grayValues = new Uint8Array(canvas.width * canvas.height);
  for (let pixel = 0, offset = 0; pixel < grayValues.length; pixel += 1, offset += 4) {
    const gray = Math.round(data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114);
    grayValues[pixel] = gray;
    histogram[gray] += 1;
  }

  if (variant === 'contrast') {
    const low = percentile(histogram, 0.02, grayValues.length);
    const high = percentile(histogram, 0.98, grayValues.length);
    const range = Math.max(32, high - low);
    for (let pixel = 0, offset = 0; pixel < grayValues.length; pixel += 1, offset += 4) {
      const normalized = Math.max(0, Math.min(255, ((grayValues[pixel] - low) / range) * 255));
      const value = Math.round(255 * (normalized / 255) ** 0.88);
      data[offset] = value; data[offset + 1] = value; data[offset + 2] = value;
    }
  } else {
    const threshold = otsuThreshold(histogram, grayValues.length);
    // A small offset keeps faint board marker strokes from disappearing.
    const cutoff = Math.max(0, threshold - 8);
    for (let pixel = 0, offset = 0; pixel < grayValues.length; pixel += 1, offset += 4) {
      const value = grayValues[pixel] < cutoff ? 0 : 255;
      data[offset] = value; data[offset + 1] = value; data[offset + 2] = value;
    }
  }
  context.putImageData(image, 0, 0);
}

function candidateScore(text: string, confidence: number): number {
  const words = text.match(/[\p{L}\p{N}]{2,}/gu) ?? [];
  const letters = (text.match(/[\p{L}]/gu) ?? []).length;
  const symbols = (text.match(/[^\p{L}\p{N}\s.,;:!?()\-/%]/gu) ?? []).length;
  const usefulTextBonus = Math.min(8, Math.log2(words.length + 1) * 2);
  const symbolPenalty = text.length ? Math.min(12, (symbols / text.length) * 30) : 0;
  const letterPenalty = text.length > 20 && letters / text.length < 0.25 ? 8 : 0;
  return confidence + usefulTextBonus - symbolPenalty - letterPenalty;
}

/** Runs OCR on a photo locally in Safari/desktop and emits real worker progress. */
export async function extractImageTextWithLocalOcr(
  file: File,
  onProgress?: (progress: ImageOcrProgress) => void,
): Promise<ImageOcrResult> {
  if (!file.type.toLowerCase().startsWith('image/')) throw new Error('Escolha uma imagem JPG, PNG, HEIC ou outro formato de foto.');
  if (file.size <= 0) throw new Error('A imagem está vazia.');
  if (typeof createImageBitmap !== 'function') throw new Error('Este navegador não oferece leitura local desta imagem. Salve a foto como JPG ou PNG e tente novamente.');

  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('Não consegui abrir esta foto neste navegador. No iPhone, tente compartilhar ou salvar como JPG/PNG e importar novamente.'); }

  let worker: Awaited<ReturnType<typeof createLocalOcrWorker>> | undefined;
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('A foto não tem dimensões válidas.');
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new Error('A foto excede 40 megapixels e foi recusada para proteger a memória do dispositivo. Reduza a resolução e tente novamente.');

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const variants: ImageOcrPreprocessing[] = ['original', 'contrast', 'threshold'];
    const results: Array<{ text: string; confidence: number; preprocessing: ImageOcrPreprocessing; score: number }> = [];
    onProgress?.({ progress: 0, status: 'Preparando OCR local em português' });
    worker = await createLocalOcrWorker((status, progress) => onProgress?.({ progress: Math.min(0.98, progress * 0.98), status }));
    for (const [index, variant] of variants.entries()) {
      onProgress?.({ progress: index / variants.length, status: `Comparando leitura local · imagem ${index + 1} de ${variants.length}` });
      renderVariant(bitmap, canvas, variant);
      const recognized = await worker.recognize(canvas);
      const text = recognized.data.text.trim();
      if (text) {
        const confidence = Number.isFinite(recognized.data.confidence) ? recognized.data.confidence : 0;
        results.push({ text, confidence, preprocessing: variant, score: candidateScore(text, confidence) });
      }
    }
    const best = results.sort((left, right) => right.score - left.score)[0];
    onProgress?.({ progress: 1, status: best ? 'Leitura local concluída · confira o texto reconhecido' : 'Nenhum texto reconhecido' });
    if (!best) throw new Error('Não encontrei texto legível na foto. Tente uma imagem mais nítida, reta e bem iluminada.');
    return { text: best.text, confidence: best.confidence, language: 'por', preprocessing: best.preprocessing };
  } finally {
    bitmap.close();
    await worker?.terminate();
  }
}
