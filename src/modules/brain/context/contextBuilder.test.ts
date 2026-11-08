import { describe, expect, it } from 'vitest';
import { buildAssistantRequest } from './contextBuilder';
import type { AssistantContext, AssistantMessage } from '../../assistant/contracts';

const context: AssistantContext = {
  locale: 'pt-BR',
  now: '2026-11-04T12:00:00.000Z',
  timezone: 'America/Sao_Paulo',
};

function message(id: number, content: string): AssistantMessage {
  return { id: String(id), role: id % 2 ? 'user' : 'assistant', content, createdAt: context.now };
}

describe('buildAssistantRequest', () => {
  it('drops blank messages and keeps only the most recent 40 messages', () => {
    const messages = Array.from({ length: 42 }, (_, index) => message(index, 'mensagem ' + index));
    messages.splice(10, 0, message(100, '   '));

    const result = buildAssistantRequest(messages, context);

    expect(result.messages).toHaveLength(40);
    expect(result.messages[0].id).toBe('2');
    expect(result.messages.at(-1)?.id).toBe('41');
  });

  it('limits individual and total context size while preserving the latest message', () => {
    const messages = Array.from({ length: 10 }, (_, index) => message(index, String(index).repeat(4_000)));
    const result = buildAssistantRequest(messages, context);

    expect(result.messages.reduce((total, item) => total + item.content.length, 0)).toBeLessThanOrEqual(16_000);
    expect(result.messages.every((item) => item.content.length <= 4_000)).toBe(true);
    expect(result.messages.at(-1)?.id).toBe('9');
  });

  it('copies context instead of mutating the caller object', () => {
    const result = buildAssistantRequest([message(1, 'Oi')], context);
    expect(result.context).toEqual(context);
    expect(result.context).not.toBe(context);
  });
});
