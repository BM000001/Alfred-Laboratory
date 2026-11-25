/** Render a validated content map using native, keyboard/touch-friendly disclosure controls. */
export function mountConceptMap(host, map, explanations) {
  const byId = new Map(map.nodes.map(node => [node.id, node]));
  const children = id => map.nodes.filter(node => node.parentId === id);
  const explanationById = new Map(explanations.map(item => [item.id, item.body]));
  const panel = document.createElement('div'); panel.className = 'concept-map-layout';
  const tree = document.createElement('nav'); tree.className = 'concept-map-tree'; tree.setAttribute('aria-label', 'Mapa de conceitos');
  const detail = document.createElement('article'); detail.className = 'concept-map-detail'; detail.setAttribute('aria-live', 'polite');
  const title = document.createElement('h3'), body = document.createElement('p'), relationList = document.createElement('ul');
  detail.append(title, body, relationList);
  function select(node) {
    title.textContent = node.label;
    body.textContent = explanationById.get(node.explanationId) || 'Explicação não disponível.';
    relationList.replaceChildren();
    map.relations.filter(item => item.from === node.id || item.to === node.id).forEach(item => {
      const li = document.createElement('li');
      li.textContent = item.from === node.id ? `${item.label}: ${byId.get(item.to)?.label || item.to}` : `${byId.get(item.from)?.label || item.from} ${item.label} este tópico`;
      relationList.append(li);
    });
  }
  function renderNode(node, depth) {
    const item = document.createElement('li'), disclosure = document.createElement('details'); disclosure.className = 'concept-node'; disclosure.dataset.nodeId = node.id; disclosure.open = depth === 0;
    const summary = document.createElement('summary'); summary.textContent = node.label;
    summary.addEventListener('click', () => select(node));
    disclosure.append(summary);
    const nested = children(node.id);
    if (nested.length) { const group = document.createElement('ul'); nested.forEach(child => group.append(renderNode(child, depth + 1))); disclosure.append(group); }
    item.append(disclosure); return item;
  }
  const root = byId.get(map.rootId);
  const list = document.createElement('ul'); list.append(renderNode(root, 0)); tree.append(list);
  panel.append(tree, detail); host.replaceChildren(panel); select(root);
}
