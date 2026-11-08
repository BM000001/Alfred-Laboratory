import type { AssistantContext, AssistantMessage } from '../../assistant/contracts';

export interface BrainContext {
  messages: AssistantMessage[];
  environment: AssistantContext;
}
