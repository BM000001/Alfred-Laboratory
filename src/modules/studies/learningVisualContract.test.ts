import { it, expect } from 'vitest';
import { readVisualLearningDraft } from './learningVisualContract';

const chunks = [{ chunkId:'a', text:'Uma ponte liga duas margens.' }];
const frame = {chunkId:'a',excerpt:'duas margens',title:'Margens',description:'Observe as extremidades.'};
it('aceita um roteiro fundamentado em material de qualquer disciplina e descarta campos ativos', () => {
  const draft = readVisualLearningDraft({version:1,kind:'storyboard',frames:[{...frame,script:'unused'}]},'storyboard',chunks);
  expect(draft.frames).toEqual([frame]);
});
it('recusa citação inventada, ciclo no mapa e alternativas repetidas', () => {
  for (const [kind, frames] of [
    ['storyboard',[{...frame,excerpt:'três margens'}]],
    ['mind-map',[frame,{...frame,parent:1}]],
    ['interactive',[{...frame,choices:['A','a'],correctChoice:0,feedback:'Veja o trecho.'}]],
  ] as const) expect(() => readVisualLearningDraft({version:1,kind,frames},kind,chunks)).toThrow();
});
