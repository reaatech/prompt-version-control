# @reaatech/prompt-version-control-mcp

## 0.1.0

### Initial release

- `pvc-mcp` binary implementing a Model Context Protocol server backed by Prompt Version Control
- Exposes prompt retrieval as MCP tools so AI agents can pull managed prompts at runtime
- Reads `PVC_API_URL` and `PVC_API_KEY` from the environment (matches Claude Desktop config)
