import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
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
    await expect(extractTextDocument(new File(['conteúdo'], 'aula.odt'))).rejects.toThrow(/não suportado/);
  });

  it('extrai parágrafos e entidades XML de DOCX local', async () => {
    const archive = zipSync({ 'word/document.xml': strToU8('<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Árvore &amp; grafo</w:t></w:r></w:p><w:p><w:r><w:t>Uma segunda linha.</w:t></w:r></w:p></w:body></w:document>') });
    const result = await extractTextDocument(new File([archive], 'aula.docx'));
    expect(result).toMatchObject({ format: 'docx', text: 'Árvore & grafo\nUma segunda linha.', wordCount: 5 });
  });

  it('extrai texto de slides PPTX na ordem numérica', async () => {
    const archive = zipSync({
      'ppt/slides/slide2.xml': strToU8('<p:sld xmlns:a="x"><a:p><a:r><a:t>Segundo slide</a:t></a:r></a:p></p:sld>'),
      'ppt/slides/slide1.xml': strToU8('<p:sld xmlns:a="x"><a:p><a:r><a:t>Primeiro slide</a:t></a:r></a:p></p:sld>'),
    });
    const result = await extractTextDocument(new File([archive], 'aula.pptx'));
    expect(result).toMatchObject({ format: 'pptx', text: 'Primeiro slide\n\nSegundo slide' });
  });

  it('reports corrupted Office packages without pretending to extract text', async () => {
    await expect(extractTextDocument(new File(['não é zip'], 'quebrado.docx'))).rejects.toThrow(/ZIP válido/);
  });

  it('valida JSON antes de disponibilizar o texto extraído', async () => {
    await expect(extractTextDocument(new File(['{invalido'], 'dados.json'))).rejects.toThrow(/JSON/);
  });

  it('rejeita documentos sem texto útil', async () => {
    await expect(extractTextDocument(new File(['   \n  '], 'branco.txt'))).rejects.toThrow(/texto/);
  });
});
