import { register, Counter, Histogram, Gauge } from 'prom-client';

// HTTP request duration
export const httpRequestDuration = new Histogram({
  name: 'pvc_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
});

// Business metrics
export const promptVersionsCreated = new Counter({
  name: 'pvc_prompt_versions_created_total',
  help: 'Total number of prompt versions created',
  labelNames: ['project'],
});

export const evaluationsCompleted = new Counter({
  name: 'pvc_evaluations_completed_total',
  help: 'Total evaluations completed',
  labelNames: ['status'],
});

export const deploymentsActive = new Gauge({
  name: 'pvc_deployments_active',
  help: 'Number of active deployments',
});

export async function getMetrics(): Promise<string> {
  return register.metrics();
}
