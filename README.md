# Perspective MCP Server

A Model Context Protocol (MCP) server that provides tools for interacting with Perspective API.

## Features

- Text toxicity analysis
- Score suggestions
- Support for multiple attributes (TOXICITY, SEVERE_TOXICITY, IDENTITY_ATTACK, INSULT, PROFANITY, THREAT)
- Multi-language support

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## Usage

1. Get your Perspective API key
2. Add the server to your MCP settings file

```json
{
  "mcpServers": {
    "perspective": {
      "command": "node",
      "args": ["path/to/perspective-mcp-server/build/index.js"],
      "env": {
        "PERSPECTIVE_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Development

### Start Development Server

```bash
npm run watch
```

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspect
```

The Inspector will provide a URL to access debugging tools in your browser.

## License

MIT License