export type MemoryCategory = 'preference' | 'goal' | 'project' | 'routine' | 'other';
export interface AssistantMemory { id: string; title: string; content: string; category: MemoryCategory; createdAt: string; updatedAt: string; }
