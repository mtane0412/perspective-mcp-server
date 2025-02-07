#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from 'googleapis';

const API_KEY = process.env.PERSPECTIVE_API_KEY;
if (!API_KEY) {
  throw new Error('PERSPECTIVE_API_KEY environment variable is required');
}

// Perspective APIクライアントの設定
const auth = new google.auth.GoogleAuth({
  apiKey: API_KEY,
  scopes: ['https://www.googleapis.com/auth/commentanalyzer']
});

class PerspectiveServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "perspective-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // エラーハンドリング
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "analyze_text",
          description: "テキストを分析し、有害性などのスコアを返します",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "分析するテキスト"
              },
              attributes: {
                type: "array",
                description: "分析する属性(例: TOXICITY, SEVERE_TOXICITY, IDENTITY_ATTACK, INSULT, PROFANITY, THREAT)",
                items: {
                  type: "string"
                }
              },
              languages: {
                type: "array",
                description: "テキストの言語(例: ja, en)。指定しない場合は自動検出されます。",
                items: {
                  type: "string"
                }
              }
            },
            required: ["text"]
          }
        },
        {
          name: "suggest_score",
          description: "テキストに対する新しいスコアを提案します",
          inputSchema: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "対象のテキスト"
              },
              attribute: {
                type: "string",
                description: "スコアを提案する属性(例: TOXICITY)"
              },
              suggestedScore: {
                type: "number",
                description: "提案するスコア(0-1の範囲)",
                minimum: 0,
                maximum: 1
              }
            },
            required: ["text", "attribute", "suggestedScore"]
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "analyze_text": {
          const { text, attributes = ["TOXICITY"], languages } = request.params.arguments as {
            text: string;
            attributes?: string[];
            languages?: string[];
          };

          try {
            const requestedAttributes: Record<string, {}> = {};
            attributes.forEach(attr => {
              requestedAttributes[attr] = {};
            });

            const url = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${API_KEY}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                comment: { text },
                languages,
                requestedAttributes,
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
              content: [{
                type: "text",
                text: JSON.stringify(data, null, 2)
              }]
            };
          } catch (error) {
            if (error instanceof Error) {
              throw new McpError(ErrorCode.InternalError, `Perspective API error: ${error.message}`);
            }
            throw error;
          }
        }

        case "suggest_score": {
          const { text, attribute, suggestedScore } = request.params.arguments as {
            text: string;
            attribute: string;
            suggestedScore: number;
          };

          try {
            const url = `https://commentanalyzer.googleapis.com/v1alpha1/comments:suggestscore?key=${API_KEY}`;
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                comment: { text },
                attributeScores: {
                  [attribute]: {
                    summaryScore: {
                      value: suggestedScore,
                      type: "PROBABILITY"
                    }
                  }
                }
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
              content: [{
                type: "text",
                text: `スコアの提案が送信されました: ${JSON.stringify(data)}`
              }]
            };
          } catch (error) {
            if (error instanceof Error) {
              throw new McpError(ErrorCode.InternalError, `Perspective API error: ${error.message}`);
            }
            throw error;
          }
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Perspective MCP server running on stdio');
  }
}

const server = new PerspectiveServer();
server.run().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
