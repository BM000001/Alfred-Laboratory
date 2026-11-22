import { describe, expect, it } from 'vitest';
import {
  createStudyPreparationState,
  getStudyPreparationSummary,
  updateStudyPreparationStage,
} from './studyPreparationProgress';

describe('study preparation progress', () => {
  it('starts with five waiting stages and no invented counts', () => {
    const state = createStudyPreparationState('material-1');
    expect(state.stages).toHaveLength(5);
    expect(state.stages.every(stage => stage.status === 'waiting')).toBe(true);
    expect(state.stages.every(stage => stage.completedItems === undefined)).toBe(true);
    expect(getStudyPreparationSummary(state).finished).toBe(false);
  });

  it('tracks actual progress and failures', () => {
    const started = updateStudyPreparationStage(createStudyPreparationState('m'), 'questions', {
      status: 'running', completedItems: 2, totalItems: 8,
    });
    expect(started.stages.find(stage => stage.id === 'questions')?.completedItems).toBe(2);
    const failed = updateStudyPreparationStage(started, 'questions', { status: 'failed', error: 'IA indisponível' });
    expect(getStudyPreparationSummary(failed).failed).toBe(true);
  });

  it('rejects impossible counts', () => {
    const state = createStudyPreparationState('m');
    expect(() => updateStudyPreparationStage(state, 'questions', { completedItems: 9, totalItems: 8 })).toThrow();
    expect(() => updateStudyPreparationStage(state, 'questions', { completedItems: -1 })).toThrow();
  });
});
