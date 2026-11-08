import { describe, expect, it } from 'vitest';
import { extractTextDocument } from './documentExtractor';

describe('extractTextDocument', () => {
  it('extrai texto UTF-8, remove BOM e normaliza quebras de linha', async () => {
    const file = new File(['\uFEFFPrimeira linha\r\nSegunda linha'], 'aula.txt', { type: 'text/plain' });
    const result = await extractTextDocument(file, () => new Date('2026-11-04T12:00:00.000Z'));

    expect(result).toMatchObject({
      fileName: 'aula.txt',
      format: 'txt',
      text: 'Primeira linha\nSegunda linha',
      characterCount: 28,
      wordCount: 4,
      extractedAt: '2026-11-04T12:00:00.000Z',
    });
  });

  it('reconhece Markdown, CSV e JSON pela extensão', async () => {
    await expect(extractTextDocument(new File(['# Aula'], 'aula.md'))).resolves.toMatchObject({ format: 'md' });
    await expect(extractTextDocument(new File(['nome,nota'], 'notas.csv'))).resolves.toMatchObject({ format: 'csv' });
    await expect(extractTextDocument(new File(['{"a":1}'], 'dados.json'))).resolves.toMatchObject({ format: 'json' });
  });

  it('rejeita arquivos vazios e formatos ainda não suportados', async () => {
    await expect(extractTextDocument(new File([], 'vazio.txt'))).rejects.toThrow(/vazio/);
    await expect(extractTextDocument(new File(['conteúdo'], 'aula.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).rejects.toThrow(/não suportado/);
  });

  it('valida JSON antes de disponibilizar o texto extraído', async () => {
    await expect(extractTextDocument(new File(['{invalido'], 'dados.json'))).rejects.toThrow(/JSON/);
  });

  it('rejeita documentos sem texto útil', async () => {
    await expect(extractTextDocument(new File(['   \n  '], 'branco.txt'))).rejects.toThrow(/texto/);
  });
});
