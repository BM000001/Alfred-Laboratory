import { createLocalOcrWorker } from './localOcrWorker';

export interface ImageOcrProgress {
  progress: number;
  status: string;
}

export interface ImageOcrResult {
  text: string;
  confidence: number;
  language: 'por';
}

const MAX_IMAGE_EDGE = 2200;
const MAX_IMAGE_PIXELS = 40_000_000;

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
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Não foi possível preparar a foto para leitura.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    onProgress?.({ progress: 0, status: 'Preparando OCR local em português' });
    worker = await createLocalOcrWorker((status, progress) => onProgress?.({ progress: Math.min(0.95, progress * 0.95), status }));
    const recognized = await worker.recognize(canvas);
    const text = recognized.data.text.trim();
    onProgress?.({ progress: 1, status: text ? 'Texto da foto reconhecido' : 'Nenhum texto reconhecido' });
    if (!text) throw new Error('Não encontrei texto legível na foto. Tente uma imagem mais nítida, reta e bem iluminada.');
    return { text, confidence: Number.isFinite(recognized.data.confidence) ? recognized.data.confidence : 0, language: 'por' };
  } finally {
    bitmap.close();
    await worker?.terminate();
  }
}
