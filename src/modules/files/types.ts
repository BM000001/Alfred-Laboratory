export interface ExtractedPage {
  pageNumber: number;
  text: string;
  confidence?: number | null;
  method?: 'text' | 'ocr';
}

export interface StoredTextExtraction {
  format: 'txt' | 'md' | 'csv' | 'json' | 'pdf';
  text: string;
  characterCount: number;
  wordCount: number;
  extractedAt: string;
  extractionMethod?: 'text' | 'ocr';
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
  /** Extracted content is stored locally alongside the original blob. */
  extraction?: StoredTextExtraction;
  blob: Blob;
}
export interface FileSummary {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  disciplineId?: string;
  hasExtractedText: boolean;
  extractedAt?: string;
}
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
