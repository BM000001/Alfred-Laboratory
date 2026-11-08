import type { ToolDefinition } from '../../assistant/contracts';

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition<unknown, unknown>>();

  register(tool: ToolDefinition<unknown, unknown>): void {
    if (!tool.id.trim()) throw new Error('A ferramenta precisa ter um identificador.');
    if (this.tools.has(tool.id)) throw new Error('Ferramenta já registrada: ' + tool.id);
    this.tools.set(tool.id, tool);
  }

  get(id: string): ToolDefinition<unknown, unknown> | undefined {
    return this.tools.get(id);
  }

  list(): readonly ToolDefinition<unknown, unknown>[] {
    return [...this.tools.values()];
  }

  async executeRead(id: string, input: unknown): Promise<unknown> {
    const tool = this.get(id);
    if (!tool) throw new Error('Ferramenta não registrada: ' + id);
    if (tool.risk !== 'read' || tool.approval !== 'never') {
      throw new Error('A ferramenta não está autorizada para execução automática de leitura.');
    }
    return tool.execute(input);
  }
}
