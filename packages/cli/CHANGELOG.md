# @reaatech/prompt-version-control-cli

## 0.1.0

### Initial release

- `pvc` binary for managing prompts, versions, and tags from the terminal
- `pvc init` writes `~/.pvcrc` with mode 0600
- Sub-commands: `prompt`, `version`, `tag`
- Reads `PVC_API_URL` and `PVC_API_KEY` env vars as a fallback to the config file
