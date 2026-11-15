import { describe, expect, it } from 'vitest';
import { chooseBestOcrCandidate } from './imageOcrExtractor';

describe('image OCR candidate selection', () => {
  it('prefers confidence over a longer but noisier transcription', () => {
    expect(chooseBestOcrCandidate([
      { text: 'texto muito longo com ruído e palavras aleatórias', confidence: 58 },
      { text: 'Fotossíntese converte luz em energia química.', confidence: 91 },
    ])).toEqual({ text: 'Fotossíntese converte luz em energia química.', confidence: 91 });
  });

  it('uses text length only as a deterministic tie breaker', () => {
    expect(chooseBestOcrCandidate([
      { text: 'A', confidence: 80 },
      { text: 'A definição principal do quadro', confidence: 81 },
    ]).text).toBe('A definição principal do quadro');
  });

  it('returns an empty result when all OCR passes are empty', () => {
    expect(chooseBestOcrCandidate([])).toEqual({ text: '', confidence: 0 });
  });
  it('ignores a blank OCR pass even when its confidence is higher', () => {
    expect(chooseBestOcrCandidate([
      { text: '  ', confidence: 99 },
      { text: 'Fotossíntese converte luz em energia.', confidence: 78 },
    ])).toEqual({ text: 'Fotossíntese converte luz em energia.', confidence: 78 });
  });

  it('returns zero confidence when every OCR pass is blank', () => {
    expect(chooseBestOcrCandidate([
      { text: '', confidence: 98 },
      { text: '  ', confidence: 76 },
    ])).toEqual({ text: '', confidence: 0 });
  });

});
