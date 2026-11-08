import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractPdfDocument, MAX_PDF_PAGES_PER_EXTRACTION } from './pdfExtractor';

const { mockedGetDocument } = vi.hoisted(() => ({ mockedGetDocument: vi.fn() }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args: unknown[]) => mockedGetDocument(...args),
}));

describe('extractPdfDocument', () => {
  beforeEach(() => mockedGetDocument.mockReset());

  function mockPdf(pages: string[]) {
    const document = {
      numPages: pages.length,
      getPage: vi.fn(async (pageNumber: number) => ({
        getTextContent: async () => ({
          items: pages[pageNumber - 1].split(' ').map((str) => ({ str })),
        }),
        cleanup: vi.fn(),
      })),
    };
    mockedGetDocument.mockReturnValue({ promise: Promise.resolve(document), destroy: vi.fn() });
    return document;
  }

  it('extrai texto localmente e mantém a referência de cada página', async () => {
    mockPdf(['Introdução à programação', 'Estruturas de repetição']);
    const file = new File(['fake-pdf-bytes'], 'apostila.pdf', { type: 'application/pdf' });
    const result = await extractPdfDocument(file, () => new Date('2026-11-04T12:00:00.000Z'));

    expect(result).toMatchObject({
      fileName: 'apostila.pdf',
      format: 'pdf',
      pageCount: 2,
      pages: [
        { pageNumber: 1, text: 'Introdução à programação' },
        { pageNumber: 2, text: 'Estruturas de repetição' },
      ],
      extractedAt: '2026-11-04T12:00:00.000Z',
    });
    expect(result.text).toContain('[Página 1]');
    expect(result.text).toContain('[Página 2]');
    expect(mockedGetDocument.mock.results[0].value.destroy).toHaveBeenCalledOnce();
  });

  it('informa quando o PDF não possui camada de texto selecionável', async () => {
    mockPdf(['', '']);
    await expect(extractPdfDocument(new File(['pdf'], 'scan.pdf'))).rejects.toThrow(/OCR/);
  });

  it('limita a extração a 300 páginas', async () => {
    const document = mockPdf([]);
    document.numPages = MAX_PDF_PAGES_PER_EXTRACTION + 1;
    await expect(extractPdfDocument(new File(['pdf'], 'grande.pdf'))).rejects.toThrow(/300 páginas/);
    expect(document.getPage).not.toHaveBeenCalled();
    expect(mockedGetDocument.mock.results[0].value.destroy).toHaveBeenCalledOnce();
  });

  it('trata documentos protegidos por senha com uma mensagem compreensível', async () => {
    const error = Object.assign(new Error('password required'), { name: 'PasswordException' });
    mockedGetDocument.mockImplementation(() => ({
      get promise() { return Promise.reject(error); },
      destroy: vi.fn(),
    }));
    await expect(extractPdfDocument(new File(['pdf'], 'protegido.pdf'))).rejects.toThrow(/protegido por senha/);
  });
});
