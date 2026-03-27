import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, InitializeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { ToolContext } from '../../tools/context.js';
import type { ToolHandler } from '../../tools/types.js';
import { SkillMcpError } from '../../core/errors.js';

const TOOL_DEFINITIONS = [
  {
    name: 'search_skills',
    description: 'Search skills by keyword',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
        sources: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['local', 'catalog', 'github'],
          },
        },
        refresh: { type: 'boolean' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_skill',
    description: 'Get full skill content',
    inputSchema: {
      type: 'object' as const,
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'get_resource',
    description: 'Get a skill resource file',
    inputSchema: {
      type: 'object' as const,
      properties: { skill: { type: 'string' }, path: { type: 'string' } },
      required: ['skill', 'path'],
    },
  },
  {
    name: 'list_categories',
    description: 'Browse skill categories',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'install_skill',
    description: 'Install a skill',
    inputSchema: {
      type: 'object' as const,
      properties: {
        skill: { type: 'string' },
        target_dir: { type: 'string' },
        platform: { type: 'string' },
        source: { type: 'string' },
      },
      required: ['skill'],
    },
  },
  {
    name: 'remove_skill',
    description: 'Remove an installed skill',
    inputSchema: {
      type: 'object' as const,
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'save_skill',
    description: 'Save a new skill',
    inputSchema: {
      type: 'object' as const,
      properties: { name: { type: 'string' }, content: { type: 'string' } },
      required: ['name', 'content'],
    },
  },
  {
    name: 'push_skills',
    description: 'Push skills to remote',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'update_config',
    description: 'Update session config',
    inputSchema: {
      type: 'object' as const,
      properties: { key: { type: 'string' }, value: {} },
      required: ['key', 'value'],
    },
  },
  {
    name: 'save_config',
    description: 'Persist config to disk',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_status',
    description: 'Health check and status',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

export async function createMcpServer(
  ctx: ToolContext,
  handlers: Map<string, ToolHandler>,
): Promise<Server> {
  const skillMetadata = await ctx.skillStore.listMetadata();
  const bundledMetadata = await ctx.bundledStore.listMetadata();
  const manifest = ctx.manifestBuilder.build([...bundledMetadata, ...skillMetadata]);
  const manifestText = ctx.manifestBuilder.toText(manifest);

  const server = new Server(
    { name: 'deft-mcp', version: '1.0.0-beta.4' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    const clientInfo = request.params.clientInfo as { name?: string; version?: string } | undefined;
    ctx.clientInfo = clientInfo;

    return {
      protocolVersion: request.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: {
        name: 'deft-mcp',
        version: '1.0.0-beta.4',
      },
      instructions: manifestText,
    };
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = handlers.get(name);
    if (!handler) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: { code: 'TOOL_NOT_FOUND', message: `Unknown tool: ${name}` } }),
          },
        ],
        isError: true,
      };
    }
    try {
      const result = await handler(args ?? {}, ctx);
      return { content: result.content };
    } catch (err) {
      if (err instanceof SkillMcpError) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(err.toResponse()) }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

export async function startStdioServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
