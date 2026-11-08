import { extractPdfDocument, type ExtractedPdfPage } from './pdfExtractor';

export type TextDocumentFormat = 'txt' | 'md' | 'csv' | 'json' | 'pdf';

export interface ExtractedTextDocument {
  fileName: string;
  format: TextDocumentFormat;
  text: string;
  characterCount: number;
  wordCount: number;
  extractedAt: string;
  extractionMethod?: 'text' | 'ocr';
  language?: string;
  pageCount?: number;
  pages?: ExtractedPdfPage[];
}

const FORMAT_BY_EXTENSION: Record<string, TextDocumentFormat> = {
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  csv: 'csv',
  json: 'json',
  pdf: 'pdf',
};

function getFormat(file: File): TextDocumentFormat {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase('en-US') ?? '';
  const format = FORMAT_BY_EXTENSION[extension];
  if (format) return format;

  const mime = file.type.toLocaleLowerCase('en-US');
  if (mime === 'text/plain') return 'txt';
  if (mime === 'text/markdown') return 'md';
  if (mime === 'text/csv') return 'csv';
  if (mime === 'application/json') return 'json';
  if (mime === 'application/pdf') return 'pdf';

  throw new Error('Formato ainda não suportado para leitura local. Use PDF, TXT, MD, CSV ou JSON.');
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Não foi possível decodificar o conteúdo do arquivo.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo.'));
    reader.onabort = () => reject(new Error('A leitura do arquivo foi interrompida.'));
    reader.readAsText(file, 'UTF-8');
  });
}

export async function extractTextDocument(
  file: File,
  now: () => Date = () => new Date(),
): Promise<ExtractedTextDocument> {
  if (file.size <= 0) throw new Error('O arquivo está vazio.');
  const format = getFormat(file);
  if (format === 'pdf') return extractPdfDocument(file, now);

  const decoded = (await readFileAsText(file)).replace(/^\uFEFF/, '');
  const text = decoded.replace(/\r\n?/g, '\n').trim();

  if (!text) throw new Error('Não foi encontrado texto para extrair deste arquivo.');
  if (format === 'json') {
    try {
      JSON.parse(text);
    } catch {
      throw new Error('O arquivo JSON contém uma estrutura inválida.');
    }
  }

  const words = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return {
    fileName: file.name,
    format,
    text,
    characterCount: text.length,
    wordCount: words.length,
    extractedAt: now().toISOString(),
  };
}
