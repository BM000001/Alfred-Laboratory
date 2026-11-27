import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { fileRepository } from '../../storage/repositories';
import { prepareMaterialPack } from './materialPackCheckpoint';

it('retoma o pacote validado após reabrir sem consumir uma nova chamada e limpa o checkpoint ao concluir', async () => {
  const text = 'Uma ponte conecta duas margens e permite atravessar um curso de água.';
  const source = {fileId:'ponte',disciplineId:'geo',topicId:'rios',sourceText:text};
  await fileRepository.save({id:'ponte',disciplineId:'geo',name:'ponte.txt',blob:new Blob([text]),size:text.length,type:'text/plain',
    createdAt:'',processing:{version:1,profile:'printed',status:'awaiting-ai',topicId:'rios',stage:'IA',
      raw:{format:'txt',text,wordCount:13,characterCount:text.length,extractedAt:''}}});
  const fetcher = vi.fn(async () => new Response(JSON.stringify({questions:[], lessons:[],
    flashcards:[{front:'O que a ponte conecta?',back:'duas margens',chunkId:'trecho-1'}]})));
  const request = {configuredOrigin:'https://preview.example',currentOrigin:'https://preview.example',
    consent:true,signal:new AbortController().signal,sourceText:text,fetcher};
  const first = await prepareMaterialPack(source, request);
  expect(first.pack.flashcards).toHaveLength(1);
  const resumed = await prepareMaterialPack(source, request);
  expect(resumed.pack).toEqual(first.pack);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await resumed.finish();
  expect((await fileRepository.getById('ponte'))?.processing?.pendingStudyPack).toBeUndefined();
});
