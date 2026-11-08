export type AssistantIntent = 'tasks' | 'agenda' | 'studies' | 'memory' | 'unknown';

export interface IntentClassification {
  intent: AssistantIntent;
  confidence: 'high' | 'low';
  matchedTerms: string[];
}
