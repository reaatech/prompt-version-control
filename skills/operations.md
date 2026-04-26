# Skill: Operations

Production troubleshooting, log analysis, and runbook execution for the Prompt Version Control system.

## Capabilities

- **Log Analysis**: Parse and filter structured Pino JSON logs
- **Metrics Investigation**: Query Prometheus metrics and traces
- **Promotion Debugging**: Diagnose why staging → production promotions failed
- **Database Health**: Analyze slow queries, connection pool status, and locks
- **Runbook Generation**: Create step-by-step incident response procedures
- **Eval Failure Analysis**: Correlate eval failures with prompt changes

## Usage

### Basic Usage

```bash
# Diagnose a failed promotion
@agent operations --action="diagnose" --target="promotion" --prompt-id="abc123"

# Analyze recent server logs
@agent operations --action="logs" --service="server" --since="1h" --level="error"

# Check database health
@agent operations --action="db-health" --connection-string="$DATABASE_URL"

# Generate incident runbook
@agent operations --action="runbook" --incident="eval-harness-timeout"

# Trace a request by correlation ID
@agent operations --action="trace" --request-id="req_abc123"
```

### Command Line Options

| Option         | Description                                                  | Default |
| -------------- | ------------------------------------------------------------ | ------- |
| `--action`     | Operation action (diagnose, logs, db-health, runbook, trace) | -       |
| `--target`     | Target resource (promotion, deployment, eval, etc.)          | -       |
| `--service`    | Service name (server, cli, mcp)                              | server  |
| `--since`      | Time window (1h, 24h, 7d)                                    | 1h      |
| `--level`      | Log level filter (debug, info, warn, error)                  | info    |
| `--request-id` | Correlation ID to trace                                      | -       |
| `--prompt-id`  | Prompt ID for context                                        | -       |

## Diagnostic Patterns

### Promotion Failure Diagnosis

```typescript
// Diagnostic flow for staging → production promotion failures
async function diagnosePromotion(promptId: string) {
  // 1. Check eval status
  const evals = await getRecentEvaluations(promptId);
  const failedEvals = evals.filter((e) => e.status === 'failed');

  if (failedEvals.length > 0) {
    return {
      cause: 'EVAL_FAILURE',
      details: failedEvals.map((e) => ({
        harnessId: e.harnessId,
        score: e.score,
        error: e.error,
      })),
      recommendation: 'Re-run evals or adjust thresholds in project settings',
    };
  }

  // 2. Check if evals are stale (> 7 days)
  const staleThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const staleEvals = evals.filter((e) => e.completedAt < staleThreshold);

  if (staleEvals.length > 0) {
    return {
      cause: 'STALE_EVALS',
      details: { oldestEval: staleEvals[0].completedAt },
      recommendation: 'Trigger fresh evaluation before promotion',
    };
  }

  // 3. Check manual override / audit log
  const recentBlocks = await getAuditLog({
    resource: promptId,
    action: 'promotion_blocked',
    since: '24h',
  });

  if (recentBlocks.length > 0) {
    return {
      cause: 'MANUAL_BLOCK',
      details: recentBlocks[0],
      recommendation: 'Contact the team member who blocked the promotion',
    };
  }

  return { cause: 'UNKNOWN', recommendation: 'Check server logs for errors' };
}
```

### Log Analysis

```bash
# Filter server logs for errors in the last hour
@agent operations --action="logs" --service="server" --since="1h" --level="error"

# Example output:
# 2024-01-15T10:30:00Z ERROR requestId=req_abc123
#   code=PROMOTION_FAILED
#   message="Eval gate blocked promotion"
#   promptId=prompt_123 versionId=ver_456
#   evalScore=0.72 threshold=0.80
```

### Database Health Check

```typescript
// Check database vitals
async function checkDatabaseHealth() {
  const checks = await Promise.all([
    // Connection pool status
    prisma.$queryRaw`SELECT count(*) as active_connections 
                      FROM pg_stat_activity 
                      WHERE datname = current_database()`,

    // Long-running queries
    prisma.$queryRaw`SELECT pid, query, now() - query_start as duration 
                      FROM pg_stat_activity 
                      WHERE state = 'active' 
                      AND now() - query_start > interval '30 seconds'`,

    // Table bloat estimate
    prisma.$queryRaw`SELECT schemaname, relname, n_live_tup, n_dead_tup 
                      FROM pg_stat_user_tables 
                      WHERE n_dead_tup > 1000`,

    // Index usage
    prisma.$queryRaw`SELECT relname, indexrelname, idx_scan, idx_tup_read 
                      FROM pg_stat_user_indexes 
                      WHERE idx_scan < 10 
                      AND schemaname = 'public'`,
  ]);

  return {
    activeConnections: checks[0],
    longRunningQueries: checks[1],
    tableBloat: checks[2],
    unusedIndexes: checks[3],
  };
}
```

## Runbook Templates

### Eval Harness Timeout

````markdown
# Runbook: Eval Harness Timeout

## Symptoms

- Promotion stays "pending" indefinitely
- Eval status shows "running" for > 30 minutes
- Webhook delivery failures in logs

## Diagnostic Steps

1. Check eval harness health: `curl $EVAL_HARNESS_URL/health`
2. Check webhook delivery status in PVC logs
3. Verify network connectivity between PVC and eval harness
4. Check eval harness queue depth

## Resolution

1. **Transient failure**: Cancel eval, trigger re-run
   ```bash
   pvc eval trigger --prompt <id> --version <version>
   ```
````

2. **Harness down**: Switch to secondary harness or manual promotion with audit override
3. **Network issue**: Verify VPC peering / firewall rules

## Escalation

- If harness is managed by another team, open P1 ticket
- If queue is backed up, consider pausing non-critical evals

````

### Database Connection Pool Exhaustion

```markdown
# Runbook: Database Connection Pool Exhaustion

## Symptoms
- API response times spike (> 2s p95)
- Errors: " Can't reach database server" or connection timeouts
- Prisma logs show `PoolTimeout` errors

## Diagnostic Steps
1. Check active connections: `SELECT count(*) FROM pg_stat_activity;`
2. Identify connection sources (app, analytics, migrations)
3. Check for connection leaks (unclosed transactions)

## Resolution
1. **Immediate**: Restart API pods to clear leaked connections
2. **Short-term**: Increase `connection_limit` in Prisma config temporarily
3. **Long-term**: Fix transaction leaks, add connection pooling (PgBouncer)
````

## Integration

Operations integrates with:

- **Pino logs**: Structured JSON parsing
- **Prometheus**: Metrics querying
- **OpenTelemetry**: Distributed trace lookup
- **Prisma**: Database introspection
- **Audit logs**: Mutation history

## Best Practices

1. **Correlate Events**: Always check logs, metrics, and traces together
2. **Version Context**: When debugging prompts, know the exact version IDs involved
3. **Minimal Impact**: Read-only diagnostics first; mutations only when necessary
4. **Document Findings**: Update runbooks with new patterns discovered
