import type { MaterialProcessingState } from '../studies/materialProcessor';
export interface ExtractedPage {
  pageNumber: number;
  text: string;
  confidence?: number | null;
  method?: 'text' | 'ocr';
}

export interface StoredTextExtraction {
  format: 'txt' | 'md' | 'csv' | 'json' | 'pdf' | 'docx' | 'pptx' | 'image';
  text: string;
  characterCount: number;
  wordCount: number;
  extractedAt: string;
  extractionMethod?: 'text' | 'ocr';
  /** OCR's provider-reported estimate (0–100); it is a signal, not a guarantee. */
  imageQuality?: number;
  confidence?: number;
  language?: string;
  pageCount?: number;
  pages?: ExtractedPage[];
}

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  /** Optional to preserve compatibility with files saved before discipline linking. */
  disciplineId?: string;
  projectId?: string;
  kind?: 'note';
  noteText?: string;
  updatedAt?: string;
  /** Extracted content is stored locally alongside the original blob. */
  extraction?: StoredTextExtraction;
  processing?: MaterialProcessingState;
  blob: Blob;
}
export interface FileSummary {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  disciplineId?: string;
  projectId?: string;
  kind?: 'note';
  noteText?: string;
  updatedAt?: string;
  hasExtractedText: boolean;
  extractedAt?: string;
}
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
