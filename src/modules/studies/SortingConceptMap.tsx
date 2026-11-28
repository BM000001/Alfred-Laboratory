import { useEffect, useRef } from 'react';
import { parse } from '@markmap/parse';
import { Markmap } from '@markmap/view';

const outline = '# Ordenação por bolhas\n## Comparar vizinhos\n## Trocar valores fora de ordem\n## Repetir passagens\n### Parar quando não houver trocas';

export default function SortingConceptMap() {
  const diagram = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = diagram.current;
    if (!svg) return;
    const map = Markmap.create(svg, parse(outline).root, { duration: 0 });
    const observer = new ResizeObserver(() => void map.fit());
    observer.observe(svg);
    return () => { observer.disconnect(); map.destroy(); };
  }, []);
  return <figure className="sorting-map">
    <svg ref={diagram} aria-hidden="true" />
    <figcaption>Compare vizinhos. Troque pares fora de ordem. Repita até uma passagem sem trocas.</figcaption>
  </figure>;
}
