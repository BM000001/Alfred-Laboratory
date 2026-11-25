/** Small, dependency-free runtime contract shared by every learning surface. */
export const CONTENT_FORMAT = 'alfred.learning-content';
export const CONTENT_VERSION = '1.0.0';

const isText = value => typeof value === 'string' && value.trim().length > 0;

export function validateLearningContent(content) {
  const errors = [];
  const path = (name, message) => errors.push(`${name}: ${message}`);
  if (!content || typeof content !== 'object' || Array.isArray(content)) return { ok: false, errors: ['content: expected an object'] };
  if (content.format !== CONTENT_FORMAT) path('format', `expected ${CONTENT_FORMAT}`);
  if (content.version !== CONTENT_VERSION) path('version', `unsupported version ${String(content.version)}`);
  if (!isText(content.id)) path('id', 'expected a non-empty string');
  if (!isText(content.title)) path('title', 'expected a non-empty string');
  if (!Array.isArray(content.objectives) || content.objectives.length === 0) path('objectives', 'expected at least one learning objective');
  else content.objectives.forEach((o, i) => {
    if (!o || !isText(o.id) || !isText(o.description)) path(`objectives[${i}]`, 'expected id and description');
  });
  const objectiveIds = new Set((content.objectives || []).map(o => o?.id));
  if (!Array.isArray(content.explanations) || content.explanations.length === 0) path('explanations', 'expected at least one explanation');
  else content.explanations.forEach((e, i) => {
    if (!e || !isText(e.id) || !isText(e.body)) path(`explanations[${i}]`, 'expected id and body');
  });
  const explanationIds = new Set((content.explanations || []).map(e => e?.id));
  const map = content.conceptMap;
  if (!map || !Array.isArray(map.nodes) || map.nodes.length < 2 || !Array.isArray(map.relations) || !isText(map.rootId)) path('conceptMap', 'expected rootId, at least two nodes and a relations array');
  else {
    const nodeIds = new Set(map.nodes.map(n => n?.id));
    if (nodeIds.size !== map.nodes.length) path('conceptMap.nodes', 'node ids must be unique');
    if (!nodeIds.has(map.rootId)) path('conceptMap.rootId', 'must identify an existing node');
    if (map.nodes.find(node => node.id === map.rootId)?.parentId) path('conceptMap.rootId', 'root node cannot have a parent');
    map.nodes.forEach((n, i) => {
      if (!n || !isText(n.id) || !isText(n.label) || !explanationIds.has(n.explanationId)) path(`conceptMap.nodes[${i}]`, 'expected id, label and a valid explanationId');
      if (n?.parentId && (!nodeIds.has(n.parentId) || n.parentId === n.id)) path(`conceptMap.nodes[${i}].parentId`, 'must identify another existing node');
      if (n?.id !== map.rootId && !n?.parentId) path(`conceptMap.nodes[${i}].parentId`, 'every non-root node must be connected to the root');
    });
    map.relations.forEach((relation, i) => {
      if (!relation || !nodeIds.has(relation.from) || !nodeIds.has(relation.to) || !isText(relation.label)) path(`conceptMap.relations[${i}]`, 'expected existing node ids and a label');
    });
    const reachable = new Set();
    const visit = id => { if (reachable.has(id)) return; reachable.add(id); map.nodes.filter(node => node.parentId === id).forEach(node => visit(node.id)); };
    if (nodeIds.has(map.rootId)) visit(map.rootId);
    if (reachable.size !== map.nodes.length) path('conceptMap.nodes', 'every node must be reachable from rootId');
    for (const node of map.nodes) {
      const seen = new Set([node.id]); let parent = node.parentId;
      while (parent) {
        if (seen.has(parent)) { path('conceptMap.nodes', 'parent relationships must be acyclic'); break; }
        seen.add(parent); parent = map.nodes.find(candidate => candidate.id === parent)?.parentId;
      }
    }
  }
  if (!Array.isArray(content.interactions)) path('interactions', 'expected an array');
  else content.interactions.forEach((x, i) => {
    if (!x || !isText(x.id) || !isText(x.type) || !objectiveIds.has(x.objectiveId)) path(`interactions[${i}]`, 'expected id/type and a valid objectiveId');
    if (x?.type === 'choice') {
      if (!Array.isArray(x.options) || x.options.length < 2) path(`interactions[${i}].options`, 'choice needs at least two options');
      if (new Set((x.options || []).map(option => option?.id)).size !== (x.options || []).length) path(`interactions[${i}].options`, 'option ids must be unique');
      if (!x.options?.some(option => option.id === x.answerId)) path(`interactions[${i}].answerId`, 'must identify one option');
      if (!isText(x.feedbackCorrect) || !isText(x.feedbackIncorrect)) path(`interactions[${i}].feedback`, 'correct and incorrect feedback are required');
    }
  });
  if (!Array.isArray(content.visuals)) path('visuals', 'expected an array');
  else content.visuals.forEach((v, i) => {
    if (!v || !isText(v.id) || !['svg', 'local-image', 'diagram'].includes(v.kind) || !isText(v.alt)) path(`visuals[${i}]`, 'expected id, supported kind and accessible alt text');
  });
  if (!content.completion || !isText(content.completion.id) || !Array.isArray(content.completion.rules) || content.completion.rules.length === 0) path('completion', 'expected an id and at least one verifiable rule');
  else content.completion.rules.forEach((rule, i) => {
    const valid = rule?.type === 'all-questions-correct' || rule?.type === 'sorted-vector' || (rule?.type === 'minimum-correct' && Number.isInteger(rule.value) && rule.value > 0);
    if (!valid) path(`completion.rules[${i}]`, 'unsupported or malformed completion rule');
  });
  if (!Array.isArray(content.references) || content.references.length === 0) path('references', 'cite the original academic material or label the content as authored demonstration material');
  else content.references.forEach((r, i) => {
    if (!r || !isText(r.kind) || !isText(r.label)) path(`references[${i}]`, 'expected kind and label');
  });
  return { ok: errors.length === 0, errors };
}

export function gradeChoice(interaction, selectedOptionId) {
  if (!interaction || interaction.type !== 'choice') throw new TypeError('Expected a choice interaction.');
  const correct = selectedOptionId === interaction.answerId;
  return { correct, feedback: correct ? interaction.feedbackCorrect : interaction.feedbackIncorrect };
}

export function evaluateCompletion(rules, evidence) {
  if (!Array.isArray(rules) || !evidence || typeof evidence !== 'object') return false;
  return rules.every(rule => {
    if (rule.type === 'all-questions-correct') return evidence.total > 0 && evidence.correct === evidence.total;
    if (rule.type === 'minimum-correct') return evidence.correct >= rule.value;
    if (rule.type === 'sorted-vector') return Array.isArray(evidence.vector) && evidence.vector.every((n, i, a) => i === 0 || a[i - 1] <= n);
    return false;
  });
}

export function createProgressRecord(content, { completed = [], answers = [] } = {}) {
  if (!validateLearningContent(content).ok) throw new TypeError('Cannot record progress for invalid learning content.');
  const interactions = new Map(content.interactions.map(item => [item.id, item]));
  if (completed.some(id => !interactions.has(id))) throw new TypeError('Progress references an unknown interaction.');
  const safeAnswers = answers.map(({ interactionId, selectedOptionId, correct }) => {
    const interaction = interactions.get(interactionId);
    if (!interaction || (interaction.type === 'choice' && !interaction.options.some(option => option.id === selectedOptionId))) throw new TypeError('Progress answer is outside the content contract.');
    return { interactionId, selectedOptionId, correct: Boolean(correct) };
  });
  return { format: 'alfred.learning-progress', version: '1.0.0', contentId: content.id, contentVersion: content.version, completed: [...new Set(completed)], answers: safeAnswers };
}
