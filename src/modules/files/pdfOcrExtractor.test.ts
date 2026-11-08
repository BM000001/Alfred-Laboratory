import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractPdfWithLocalOcr, MAX_OCR_PAGES_PER_RUN } from './pdfOcrExtractor';

const { mockedGetDocument, mockedCreateWorker } = vi.hoisted(() => ({
  mockedGetDocument: vi.fn(),
  mockedCreateWorker: vi.fn(),
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args: unknown[]) => mockedGetDocument(...args),
}));

vi.mock('tesseract.js', () => ({
  OEM: { LSTM_ONLY: 1 },
  createWorker: (...args: unknown[]) => mockedCreateWorker(...args),
}));

describe('extractPdfWithLocalOcr', () => {
  beforeEach(() => {
    mockedGetDocument.mockReset();
    mockedCreateWorker.mockReset();
  });

  it('respeita o limite de 20 páginas para proteger dispositivos móveis', async () => {
    const pdf = {
      numPages: MAX_OCR_PAGES_PER_RUN + 1,
      getPage: vi.fn(),
    };
    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve(pdf),
      destroy: vi.fn(),
    });

    await expect(extractPdfWithLocalOcr(new File(['pdf'], 'apostila.pdf'))).rejects.toThrow(/20 páginas/);
    expect(pdf.getPage).not.toHaveBeenCalled();
    expect(mockedCreateWorker).not.toHaveBeenCalled();
  });

  it('interrompe a operação antes de abrir o documento quando o usuário cancela', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(extractPdfWithLocalOcr(new File(['pdf'], 'apostila.pdf'), undefined, controller.signal))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(mockedGetDocument).not.toHaveBeenCalled();
    expect(mockedCreateWorker).not.toHaveBeenCalled();
  });

  it('não inicializa o mecanismo OCR para PDFs que já estão dentro do limite e ainda não têm páginas escaneadas', async () => {
    const pdf = {
      numPages: 1,
      getPage: vi.fn(async () => ({
        getTextContent: async () => ({ items: [{ str: 'Conteúdo de texto selecionável suficiente' }] }),
        cleanup: vi.fn(),
      })),
    };
    mockedGetDocument.mockReturnValue({ promise: Promise.resolve(pdf), destroy: vi.fn() });

    const result = await extractPdfWithLocalOcr(new File(['pdf'], 'texto.pdf'));

    expect(result.pages[0]).toMatchObject({ pageNumber: 1, method: 'text', confidence: null });
    expect(result.extractionMethod).toBe('text');
    expect(mockedCreateWorker).not.toHaveBeenCalled();
  });
});
