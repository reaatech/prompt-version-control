#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PVCClient } from '@pvc/sdk';
import { renderTemplate } from '@pvc/shared';
import { z } from 'zod';

const PromptGetArgsSchema = z.object({
  promptId: z.string().min(1),
  variables: z.record(z.string()).optional(),
});

const API_URL = process.env.PVC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.PVC_API_KEY || '';

const client = new PVCClient({ apiKey: API_KEY, baseUrl: API_URL });

const server = new Server(
  {
    name: 'prompt-version-control',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'prompt.get',
        description:
          'Retrieve the production version of a prompt with optional variable substitution',
        inputSchema: {
          type: 'object',
          properties: {
            promptId: { type: 'string', description: 'Prompt ID or name' },
            variables: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Variables to interpolate into the template',
            },
          },
          required: ['promptId'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'prompt.get') {
    const args = PromptGetArgsSchema.parse(request.params.arguments);

    const version = await client.getProduction(args.promptId);
    const { rendered, variablesUsed, missingVariables } = renderTemplate(
      version.template,
      args.variables ?? {},
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              version: version.number,
              content: version.content,
              rendered,
              variablesUsed,
              missingVariables,
              metadata: version.metadata,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
