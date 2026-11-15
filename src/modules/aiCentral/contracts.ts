import type { ProcessingProfile } from '../studies/materialReliability';
export type AIOperation = 'studies.analyze' | 'studies.generate';
export interface ProviderConnection {
  id: string; provider: 'gemini' | 'groq'; label: string; models: string[]; model: string | null; revision: string; freeTierConfirmed: boolean;
}
export interface AITaskInput {
  connection?: { id: string; revision: string; provider: 'gemini' | 'groq'; label: string; model: string; endpoint: string };
  comparisonId?: string;
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
  endpoint: string; token: string; freeTierConsent?: boolean;
  consent: { taskId: string; endpoint: string; includeImage: boolean };
}
export const AI_LABELS: Record<AIOperation, string> = { 'studies.analyze': 'Analisar material', 'studies.generate': 'Gerar recursos de estudo' };
