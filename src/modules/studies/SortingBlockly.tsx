import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';
import * as ptBr from 'blockly/msg/pt-br';
import { makeCode, runRestrictedPlan, type SortingPlan } from '../../../visual-learning-poc/src/core.js';

const vectorBlock = {
  type: 'alfred_sort_vector', message0: 'Vetor %1', args0: [
    { type: 'field_input', name: 'VECTOR', text: '4, 2, 3, 1' },
  ], nextStatement: 'SortPasses', colour: 145,
};
const passesBlock = {
  type: 'alfred_sort_passes', message0: 'Até %1 passagens', args0: [
    { type: 'field_number', name: 'PASSES', value: 4, min: 1, max: 8, precision: 1 },
  ], previousStatement: 'SortPasses', nextStatement: 'SortComparison', colour: 45,
};
const comparisonBlock = {
  type: 'alfred_sort_compare', message0: 'Comparar e trocar vizinhos fora de ordem',
  previousStatement: 'SortComparison', colour: 145,
};

export default function SortingBlockly() {
  const container = useRef<HTMLDivElement>(null);
  const workspace = useRef<Blockly.WorkspaceSvg>(null);
  const [textVector, setTextVector] = useState('4, 2, 3, 1');
  const [textPasses, setTextPasses] = useState('4');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const messages: Record<string, string> = {};
    for (const [key, value] of Object.entries(ptBr)) {
      if (typeof value === 'string') messages[key] = value;
    }
    Blockly.setLocale(messages);
    if (!Blockly.Blocks[vectorBlock.type]) Blockly.defineBlocksWithJsonArray([vectorBlock, passesBlock, comparisonBlock]);
    const editor = Blockly.inject(host, {
      sounds: false,
      media: import.meta.env.BASE_URL + 'blockly-media/',
      move: { scrollbars: true, drag: true, wheel: false },
      zoom: { controls: true, startScale: 0.8, minScale: 0.4, maxScale: 1.5 },
    });
    workspace.current = editor;
    const vector = editor.newBlock(vectorBlock.type);
    const passes = editor.newBlock(passesBlock.type);
    const comparison = editor.newBlock(comparisonBlock.type);
    for (const block of [vector, passes, comparison]) { block.initSvg(); block.render(); }
    vector.nextConnection?.connect(passes.previousConnection!);
    passes.nextConnection?.connect(comparison.previousConnection!);
    vector.moveBy(12, 16);
    const observer = new ResizeObserver(() => Blockly.svgResize(editor));
    observer.observe(host);
    return () => { observer.disconnect(); editor.dispose(); workspace.current = null; };
  }, []);

  function applyTextFields() {
    const vector = workspace.current?.getBlocksByType(vectorBlock.type, false)[0];
    const passes = workspace.current?.getBlocksByType(passesBlock.type, false)[0];
    if (!vector || !passes) { setError('Restaure os blocos do vetor e das passagens.'); return; }
    if (!/^[1-8]$/.test(textPasses) || !/^\s*-?\d+\s*(,\s*-?\d+\s*){1,7}$/.test(textVector)) {
      setError('Informe de 2 a 8 inteiros e de 1 a 8 passagens.'); return;
    }
    vector.setFieldValue(textVector, 'VECTOR');
    passes.setFieldValue(textPasses, 'PASSES');
    run();
  }

  function run() {
    setResult('');
    setCode('');
    const roots = workspace.current?.getTopBlocks(false);
    const vector = roots?.[0];
    const passes = vector?.getNextBlock();
    const comparison = passes?.getNextBlock();
    if (roots?.length !== 1 || vector?.type !== vectorBlock.type ||
        passes?.type !== passesBlock.type || comparison?.type !== comparisonBlock.type) {
      setError('Conecte o vetor, as passagens e a comparação nessa ordem.');
      return;
    }
    const values = String(vector.getFieldValue('VECTOR')).split(',').map(value => value.trim());
    if (values.some(value => !/^-?\d+$/.test(value))) {
      setError('Separe os números inteiros por vírgulas.');
      return;
    }
    const plan: SortingPlan = {
      vector: values.map(Number), passes: Number(passes.getFieldValue('PASSES')),
      operation: 'compare-adjacent-and-swap-if-out-of-order',
    };
    const output = runRestrictedPlan(plan);
    if (!output.ok) { setError(output.error); return; }
    setError('');
    setCode(makeCode(plan, 'js'));
    setResult(`${output.final.join(', ')} · ${output.actions.length} comparações · ${output.sorted ? 'Ordenado' : 'Ainda fora de ordem'}`);
  }

  return <section className="entry-panel" aria-label="Programação por blocos">
    <p>Edite o vetor e o número de passagens. O interpretador executa somente os três blocos da atividade.</p>
    <div className="sorting-blockly" ref={container} />
    <details><summary>Editar por teclado</summary>
      <label>Vetor <input value={textVector} maxLength={48} onChange={e => setTextVector(e.target.value)} /></label>
      <label>Passagens <input type="number" min={1} max={8} value={textPasses} onChange={e => setTextPasses(e.target.value)} /></label>
      <button type="button" onClick={applyTextFields}>Aplicar valores aos blocos e executar</button>
    </details>
    <button type="button" className="primary-action" onClick={run}>Executar blocos</button>
    {error && <p role="alert">{error}</p>}
    {result && <p role="status">{result}</p>}
    {code && <details><summary>Ver JavaScript equivalente</summary><pre className="sorting-code">{code}</pre></details>}
  </section>;
}
