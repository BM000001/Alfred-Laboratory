import { describe, expect, it, vi } from 'vitest';
import { createPreprocessedVariants } from './imageOcrExtractor';

describe('local image preprocessing', () => {
  it('preserves source and produces distinct contrast and threshold versions', () => {
    const source = { width: 2, height: 1 } as HTMLCanvasElement;
    const images: Uint8ClampedArray[] = [];
    const create = vi.spyOn(document, 'createElement').mockImplementation(() => {
      const data = new Uint8ClampedArray([80, 80, 80, 255, 200, 200, 200, 255]);
      const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn(), getImageData: () => ({ data }), putImageData: () => images.push(data.slice()) }) };
      return canvas as unknown as HTMLCanvasElement;
    });
    try {
      const variants = createPreprocessedVariants(source);
      expect(variants).toHaveLength(3); expect(variants[0]).toBe(source);
      expect(images[0][0]).toBeLessThan(80); expect(images[0][4]).toBeGreaterThan(200);
      expect(images[1][0]).toBe(0); expect(images[1][4]).toBe(255);
      expect(images[0][3]).toBe(255);
    } finally { create.mockRestore(); }
  });
  it('keeps original when canvas preprocessing is unavailable', () => {
    const source = { width: 2, height: 1 } as HTMLCanvasElement;
    const create = vi.spyOn(document, 'createElement').mockReturnValue({ getContext: () => null } as unknown as HTMLCanvasElement);
    try { expect(createPreprocessedVariants(source)).toEqual([source]); } finally { create.mockRestore(); }
  });
});
