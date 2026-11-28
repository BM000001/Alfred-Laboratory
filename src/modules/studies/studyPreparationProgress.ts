/** Real execution states for the Studies 2.2 material-preparation workflow.
 * Never infer completion from elapsed time or animate fake percentages.
 * See #86. This model does not start AI requests or imply background execution.
 */
export const STUDY_PREPARATION_STAGES = [
  { id: 'analysis', label: 'Analisando o material' },
  { id: 'lessons', label: 'Preparando as aulas' },
  { id: 'questions', label: 'Criando exercícios' },
  { id: 'flashcards', label: 'Preparando flashcards' },
  { id: 'trail', label: 'Montando a trilha' },
] as const;

export type StudyPreparationStageId = typeof STUDY_PREPARATION_STAGES[number]['id'];
export type StudyPreparationStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'unavailable';
export type StudyPreparationStage = {
  id: StudyPreparationStageId;
  status: StudyPreparationStatus;
  /** Counts must be reported by the actual generator, never estimated. */
  completedItems?: number;
  totalItems?: number;
  error?: string;
};
export type StudyPreparationState = {
  materialId: string;
  stages: StudyPreparationStage[];
};

export function createStudyPreparationState(materialId: string): StudyPreparationState {
  if (!materialId.trim()) throw new Error('Identificador do material obrigatório.');
  return {
    materialId,
    stages: STUDY_PREPARATION_STAGES.map(({ id }) => ({ id, status: 'waiting' })),
  };
}

export function updateStudyPreparationStage(
  state: StudyPreparationState,
  id: StudyPreparationStageId,
  patch: Omit<Partial<StudyPreparationStage>, 'id'>,
): StudyPreparationState {
  const next = state.stages.map((stage) => {
    if (stage.id !== id) return stage;
    const updated = { ...stage, ...patch };
    if (updated.completedItems !== undefined && (!Number.isInteger(updated.completedItems) || updated.completedItems < 0)) {
      throw new Error('Contagem concluída inválida.');
    }
    if (updated.totalItems !== undefined && (!Number.isInteger(updated.totalItems) || updated.totalItems < 0)) {
      throw new Error('Contagem total inválida.');
    }
    if (updated.totalItems !== undefined && updated.completedItems !== undefined && updated.completedItems > updated.totalItems) {
      throw new Error('Contagem concluída excede o total.');
    }
    return updated;
  });
  return { ...state, stages: next };
}

export function getStudyPreparationSummary(state: StudyPreparationState) {
  const completedStages = state.stages.filter((stage) => stage.status === 'completed').length;
  return {
    completedStages,
    totalStages: state.stages.length,
    failed: state.stages.some((stage) => stage.status === 'failed'),
    finished: state.stages.length > 0 && state.stages.every((stage) => stage.status === 'completed'),
  };
}
