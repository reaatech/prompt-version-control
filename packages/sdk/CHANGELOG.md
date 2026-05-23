# @reaatech/prompt-version-control

## 0.1.0

### Initial release

- Typed `PromptVersionControlClient` covering prompts, versions, tags, evaluations, deployments, and metrics
- Automatic retry with exponential backoff and jitter on 5xx and network errors
- `AbortController`-based request timeouts (default 30s)
- Optional in-memory LRU cache with TTL
- `zod` is a required peer dependency — install it alongside this package
