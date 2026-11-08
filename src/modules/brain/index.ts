export { Brain } from './core/Brain';
export type { BrainOptions, BrainResult } from './core/Brain';
export { classifyIntent, normalizeIntentText } from './intent/intentEngine';
export type { AssistantIntent, IntentClassification } from './intent/intentTypes';
export { ToolRegistry } from './tools/toolRegistry';
export { buildAssistantRequest } from './context/contextBuilder';
