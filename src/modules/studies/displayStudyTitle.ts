/**
 * Text-only cleanup for headings extracted from PDFs/Markdown.
 * Does not rewrite the original source, flashcard answers, or code examples.
 */
export function displayStudyTitle(raw: string): string {
  let title = raw.replace(/\s+/gu, ' ').trim();
  if (!title) return 'Título indisponível';

  title = title.replace(/^#{1,6}\s+/u, '').replace(/^\d+[.)]\s+/u, '');
  // Strip Markdown emphasis wrappers around headings (including unclosed OCR fragments).
  title = title.replace(/^\*{1,2}(?=\p{Lu})/u, '').replace(/\*{1,2}$/u, '');
  // OCR sometimes extracts a leading template fragment: "{ id".
  title = title.replace(/^\{\s+(?=\p{L})/u, '');
  title = title.trim();
  if (!title || !/[\p{L}\p{N}]/u.test(title)) return 'Título indisponível';
  return title;
}
