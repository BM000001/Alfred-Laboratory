import type { ProcessingProfile } from '../studies/materialReliability';
export type AIOperation = 'studies.analyze' | 'studies.generate';
export interface AITaskInput {
  includeImage?: boolean; sourceFileId: string; disciplineId: string; text: string; confidence: number; profile: ProcessingProfile;
}
export interface AIAnalysis {
  text: string;
  definitions: Array<{ term: string; definition: string; sourceExcerpt: string }>;
  formulas: string[];
  summary: string;
  uncertainties: string[];
  requiresReview: boolean;
}
export interface AIResult {
  execution?: { provider: 'local' | 'gateway'; endpoint?: string; model?: string; promptVersion: string };
  analysis?: AIAnalysis;
  resources?: import('../studies/materialReliability').MaterialResources;
  usage?: { inputTokens: number; outputTokens: number };
}
export interface AITask {
  id: string; version: 1; operation: AIOperation; provider: 'local' | 'gateway';
  input: AITaskInput; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  attempts: number; createdAt: string; updatedAt: string; result?: AIResult;
  error?: { code: string; message: string };
}
export interface AICentralSettings { id: 'central'; endpoint: string; }
export interface RemoteExecution {
  endpoint: string; token: string;
  consent: { taskId: string; endpoint: string; includeImage: boolean };
}
export const AI_LABELS: Record<AIOperation, string> = { 'studies.analyze': 'Analisar material', 'studies.generate': 'Gerar recursos de estudo' };
