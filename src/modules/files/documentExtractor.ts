import type { ExtractedPdfPage } from './pdfExtractor';
import { unzipSync } from 'fflate';

export type TextDocumentFormat = 'txt' | 'md' | 'csv' | 'json' | 'pdf' | 'docx' | 'pptx';

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
  docx: 'docx',
  pptx: 'pptx',
};

const MAX_OFFICE_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;

function readZipArchive(fileBytes: Uint8Array, requiredName?: string): Record<string, Uint8Array> {
  // Reject ZIP bombs before decompression. The upload service already caps the
  // compressed file at 10 MB; this adds a separate cap on expanded OOXML data.
  const bytes = fileBytes;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const floor = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= floor; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('O arquivo Office não contém um pacote ZIP válido.');
  const entries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (entries > 500 || centralOffset + centralSize > bytes.length) throw new Error('O pacote Office possui estrutura inválida ou complexa demais.');
  let cursor = centralOffset;
  let expandedSize = 0;
  let found = !requiredName;
  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('O pacote Office está corrompido.');
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const entryName = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    expandedSize += uncompressed;
    if (expandedSize > MAX_OFFICE_UNCOMPRESSED_BYTES) throw new Error('O conteúdo descompactado excede 25 MB. Divida ou reduza o documento.');
    if (entryName === requiredName) found = true;
    cursor += 46 + nameLength + extraLength + commentLength;
    if (cursor > centralOffset + centralSize) throw new Error('O pacote Office está corrompido.');
  }
  if (!found) throw new Error(requiredName?.endsWith('document.xml') ? 'O DOCX não contém o documento principal.' : 'O PPTX não contém slides legíveis.');
  try { return unzipSync(bytes); }
  catch { throw new Error('Não foi possível abrir o pacote Office. Verifique se o arquivo não está corrompido.'); }
}

function readZipEntry(fileBytes: Uint8Array, name: string): string {
  const archive = readZipArchive(fileBytes, name);
  const entry = archive[name];
  if (!entry) throw new Error('Não foi possível ler o conteúdo principal do arquivo Office.');
  return new TextDecoder('utf-8', { fatal: false }).decode(entry);
}

function xmlText(markup: string): string {
  const namespaceFree = markup.replace(/<\/?(?:w|a):/g, (tag) => tag.replace(/(?:w|a):/, ''));
  const root = new DOMParser().parseFromString(`<root>${namespaceFree}</root>`, 'application/xml');
  if (root.querySelector('parsererror')) throw new Error('O conteúdo XML do documento está corrompido.');
  return root.documentElement.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
}

function officeParagraphs(xml: string, tag: 'w:p' | 'a:p'): string[] {
  const blocks = xml.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'g')) ?? [];
  return blocks.map((block) => {
    const textRuns = block.match(/<(?:w:t|a:t)\b[^>]*>[\s\S]*?<\/(?:w:t|a:t)>/g) ?? [];
    return xmlText(textRuns.join(''));
  }).filter(Boolean);
}

async function extractOfficeDocument(file: File, format: 'docx' | 'pptx', now: () => Date): Promise<ExtractedTextDocument> {
  const bytes = new Uint8Array(await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(reader.result) : reject(new Error('Não foi possível decodificar o arquivo Office.'));
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o arquivo Office.'));
    reader.onabort = () => reject(new Error('A leitura do arquivo Office foi interrompida.'));
    reader.readAsArrayBuffer(file);
  }));
  const expected = format === 'docx' ? 'word/document.xml' : 'ppt/slides/slide1.xml';
  let text = '';
  if (format === 'docx') {
    text = officeParagraphs(readZipEntry(bytes, expected), 'w:p').join('\n');
  } else {
    // Use slide order numerically; do not include notes, comments, or metadata.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
    }
    if (eocd < 0) throw new Error('O arquivo Office não contém um pacote ZIP válido.');
    let cursor = view.getUint32(eocd + 16, true);
    const entries = view.getUint16(eocd + 10, true);
    const slideNames: string[] = [];
    for (let i = 0; i < entries; i += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('O pacote Office está corrompido.');
      const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true);
      const entryName = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
      if (/^ppt\/slides\/slide\d+\.xml$/.test(entryName)) slideNames.push(entryName);
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    slideNames.sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
    if (!slideNames.length || slideNames.length > 300) throw new Error('O PPTX não contém slides legíveis ou excede 300 slides.');
    const archive = readZipArchive(bytes, slideNames[0]);
    text = slideNames.map((name) => officeParagraphs(new TextDecoder().decode(archive[name]), 'a:p').join('\n')).filter(Boolean).join('\n\n');
  }
  if (!text.trim()) throw new Error(`Nenhum texto legível foi encontrado no ${format.toUpperCase()}.`);
  if (text.length > 5 * 1024 * 1024) throw new Error('O texto extraído excede 5 MB; divida o documento para continuar.');
  const words = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return { fileName: file.name, format, text: text.trim(), characterCount: text.trim().length, wordCount: words.length, extractedAt: now().toISOString() };
}

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
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';

  throw new Error('Formato ainda não suportado para leitura local. Use PDF, DOCX, PPTX, TXT, MD, CSV ou JSON.');
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
  if (format === 'pdf') return (await import('./pdfExtractor')).extractPdfDocument(file, now);
  if (format === 'docx' || format === 'pptx') return extractOfficeDocument(file, format, now);

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
