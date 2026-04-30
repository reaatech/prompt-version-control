import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PVCClient } from '@reaatech/prompt-version-control';
import { renderTemplate } from '@reaatech/prompt-version-control-shared';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: 'ListToolsRequestSchema',
  CallToolRequestSchema: 'CallToolRequestSchema',
}));

vi.mock('@reaatech/prompt-version-control', () => ({
  PVCClient: vi.fn().mockImplementation(() => ({
    getProduction: vi.fn(),
  })),
}));

vi.mock('@reaatech/prompt-version-control-shared', () => ({
  renderTemplate: vi.fn(),
}));

describe('MCP Server', () => {
  let serverInstance: any;
  let clientInstance: { getProduction: ReturnType<typeof vi.fn> };
  let listToolsHandler: (...args: any[]) => Promise<any>;
  let callToolHandler: (...args: any[]) => Promise<any>;

  beforeAll(async () => {
    await import('../index.js');

    serverInstance = vi.mocked(Server).mock.results[0].value;
    const handlerCalls = vi.mocked(serverInstance.setRequestHandler).mock.calls;

    listToolsHandler = handlerCalls.find(
      ([schema]: any[]) => schema === ListToolsRequestSchema,
    )?.[1] as any;

    callToolHandler = handlerCalls.find(
      ([schema]: any[]) => schema === CallToolRequestSchema,
    )?.[1] as any;

    clientInstance = vi.mocked(PVCClient).mock.results[0].value;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list tools with prompt.get definition', async () => {
    const result = await listToolsHandler();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]).toMatchObject({
      name: 'prompt.get',
      description: expect.stringContaining('production version'),
      inputSchema: {
        type: 'object',
        properties: {
          promptId: { type: 'string' },
          variables: { type: 'object' },
        },
        required: ['promptId'],
      },
    });
  });

  it('should call prompt.get tool with promptId and return rendered data', async () => {
    clientInstance.getProduction.mockResolvedValue({
      number: 3,
      content: 'Hello {{name}}',
      template: 'Hello {{name}}',
      metadata: { tags: ['greeting'] },
    });

    vi.mocked(renderTemplate).mockReturnValue({
      rendered: 'Hello World',
      variablesUsed: ['name'],
      missingVariables: [],
    });

    const result = await callToolHandler({
      params: {
        name: 'prompt.get',
        arguments: { promptId: 'prompt_123', variables: { name: 'World' } },
      },
    });

    expect(clientInstance.getProduction).toHaveBeenCalledWith('prompt_123');
    expect(renderTemplate).toHaveBeenCalledWith('Hello {{name}}', { name: 'World' });

    const textContent = result.content[0].text;
    const parsed = JSON.parse(textContent);
    expect(parsed).toMatchObject({
      version: 3,
      content: 'Hello {{name}}',
      rendered: 'Hello World',
      variablesUsed: ['name'],
      missingVariables: [],
      metadata: { tags: ['greeting'] },
    });
  });

  it('should call prompt.get tool without optional variables', async () => {
    clientInstance.getProduction.mockResolvedValue({
      number: 1,
      content: 'Static prompt',
      template: 'Static prompt',
      metadata: null,
    });

    vi.mocked(renderTemplate).mockReturnValue({
      rendered: 'Static prompt',
      variablesUsed: [],
      missingVariables: [],
    });

    const result = await callToolHandler({
      params: {
        name: 'prompt.get',
        arguments: { promptId: 'prompt_456' },
      },
    });

    expect(clientInstance.getProduction).toHaveBeenCalledWith('prompt_456');
    expect(renderTemplate).toHaveBeenCalledWith('Static prompt', {});

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.rendered).toBe('Static prompt');
  });

  it('should throw error for unknown tool', async () => {
    await expect(
      callToolHandler({
        params: {
          name: 'unknown.tool',
          arguments: {},
        },
      }),
    ).rejects.toThrow('Unknown tool: unknown.tool');
  });
});
