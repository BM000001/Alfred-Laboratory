import type { AssistantContext, AssistantMessage, AssistantRequest } from '../../assistant/contracts';

const MAX_CONTEXT_MESSAGES = 40;
const MAX_MESSAGE_CHARACTERS = 4_000;
const MAX_TOTAL_CHARACTERS = 16_000;

export function buildAssistantRequest(
  messages: readonly AssistantMessage[],
  context: AssistantContext,
): AssistantRequest {
  const normalized = messages
    .filter((message) => message.content.trim().length > 0)
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({
      ...message,
      content: message.content.slice(0, MAX_MESSAGE_CHARACTERS),
    }));

  let totalCharacters = normalized.reduce((total, message) => total + message.content.length, 0);
  while (totalCharacters > MAX_TOTAL_CHARACTERS && normalized.length > 1) {
    totalCharacters -= normalized.shift()!.content.length;
  }

  return {
    messages: normalized,
    context: { ...context },
  };
}
