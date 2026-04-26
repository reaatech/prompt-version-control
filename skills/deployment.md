# Skill: Deployment

Handles deployment configuration and infrastructure as code for the Prompt Version Control project, enabling reliable and scalable production deployments.

## Capabilities

- **Docker Images**: Build optimized container images
- **Kubernetes Manifests**: Generate deployment configurations
- **Helm Charts**: Create parameterized deployment templates
- **Environment Configuration**: Manage environment-specific settings
- **CI/CD Pipelines**: Configure automated deployment workflows
- **Infrastructure Scaling**: Configure auto-scaling policies

## Usage

### Basic Usage

```bash
# Build Docker image
@agent deployment --action="build" --target="docker" --version="1.0.0"

# Generate Kubernetes manifests
@agent deployment --action="generate" --target="kubernetes" --environment="production"

# Update Helm chart
@agent deployment --action="update" --target="helm" --version="1.0.0"

# Deploy to environment
@agent deployment --action="deploy" --environment="staging" --version="1.0.0"

# Configure auto-scaling
@agent deployment --action="configure" --target="autoscaling" --min=2 --max=10
```

### Command Line Options

| Option          | Description                                                    | Default    |
| --------------- | -------------------------------------------------------------- | ---------- |
| `--action`      | Deployment action (build, generate, update, deploy, configure) | -          |
| `--target`      | Target platform (docker, kubernetes, helm, ecs, gke)           | kubernetes |
| `--environment` | Target environment (dev, staging, production)                  | -          |
| `--version`     | Application version                                            | latest     |
| `--min`         | Minimum replicas for autoscaling                               | 1          |
| `--max`         | Maximum replicas for autoscaling                               | 10         |
| `--dry-run`     | Show changes without applying                                  | false      |

## Docker Configuration

### Multi-Stage Build

```dockerfile
# deployments/docker/Dockerfile
# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/cli/package.json ./packages/cli/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter=server...

# Copy source
COPY . .

# Build application
RUN pnpm --filter=server build

# Prune dev dependencies
RUN pnpm --filter=server deploy --prod /app/prod

# Runtime stage
FROM node:22-alpine AS runtime

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/prod ./
COPY --from=builder --chown=nodejs:nodejs /app/packages/server/prisma ./prisma

# Set permissions
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "packages/server/dist/index.js"]
```

### Docker Compose (Development)

```yaml
# deployments/docker/docker-compose.yml
version: '3.8'

services:
  pvc-server:
    build:
      context: ../..
      dockerfile: deployments/docker/Dockerfile
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://postgres:password@db:5432/pvc
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: debug
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ../../packages/server/src:/app/packages/server/src
      - ../../packages/shared/src:/app/packages/shared/src
    command: ['node', '--watch', 'packages/server/src/index.ts']

  # Optional: Background worker for async tasks (webhook delivery, cache warming)
  # pvc-worker:
  #   build:
  #     context: ../..
  #     dockerfile: deployments/docker/Dockerfile
  #   environment:
  #     NODE_ENV: development
  #     DATABASE_URL: postgresql://postgres:password@db:5432/pvc
  #     REDIS_URL: redis://redis:6379
  #   depends_on:
  #     - db
  #     - redis
  #   command: ["node", "packages/server/src/worker.ts"]

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: pvc
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  # Optional: Adminer for database management
  adminer:
    image: adminer:latest
    ports:
      - '8080:8080'
    environment:
      ADMINER_DEFAULT_SERVER: db

volumes:
  postgres_data:
  redis_data:
```

## Kubernetes Configuration

### Production Deployment

```yaml
# deployments/kubernetes/production/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pvc-server
  namespace: prompt-version-control
  labels:
    app: pvc-server
    version: '1.0.0'
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: pvc-server
  template:
    metadata:
      labels:
        app: pvc-server
        version: '1.0.0'
      annotations:
        prometheus.io/scrape: 'true'
        prometheus.io/port: '3000'
        prometheus.io/path: '/metrics'
    spec:
      serviceAccountName: pvc-server
      securityContext:
        runAsNonRoot: true
        fsGroup: 1001
      initContainers:
        # Run database migrations
        - name: migrations
          image: pvc-server:1.0.0
          command: ['npx', 'prisma', 'migrate', 'deploy']
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: pvc-secrets
                  key: database-url
      containers:
        - name: server
          image: pvc-server:1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          env:
            - name: NODE_ENV
              value: 'production'
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: pvc-secrets
                  key: database-url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: pvc-secrets
                  key: redis-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: pvc-secrets
                  key: jwt-secret
          envFrom:
            - configMapRef:
                name: pvc-config
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ['ALL']
```

### Horizontal Pod Autoscaler

```yaml
# deployments/kubernetes/production/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: pvc-server-hpa
  namespace: prompt-version-control
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: pvc-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: '100'
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 30
```

### Ingress Configuration

```yaml
# deployments/kubernetes/production/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pvc-ingress
  namespace: prompt-version-control
  annotations:
    nginx.ingress.kubernetes.io/rate-limit: '100'
    nginx.ingress.kubernetes.io/rate-limit-window: '1m'
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
    cert-manager.io/cluster-issuer: 'letsencrypt-prod'
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "DENY" always;
      add_header X-XSS-Protection "1; mode=block" always;
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.pvc.example.com
      secretName: pvc-tls
  rules:
    - host: api.pvc.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: pvc-server
                port:
                  number: 80
```

### Pod Disruption Budget

```yaml
# deployments/kubernetes/production/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: pvc-server-pdb
  namespace: prompt-version-control
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: pvc-server
```

## Helm Chart

### Chart Structure

```
deployments/helm/pvc/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-staging.yaml
├── values-production.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   └── serviceaccount.yaml
```

### Chart.yaml

```yaml
# deployments/helm/pvc/Chart.yaml
apiVersion: v2
name: pvc
description: Prompt Version Control - Git-like versioning for AI prompts
type: application
version: 1.0.0
appVersion: '1.0.0'
keywords:
  - ai
  - prompts
  - version-control
  - llm
home: https://github.com/reaatech/prompt-version-control
sources:
  - https://github.com/reaatech/prompt-version-control
maintainers:
  - name: reaa
    email: hello@reaa.tech
dependencies:
  - name: postgresql
    version: 12.0.0
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 18.0.0
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

### values.yaml

```yaml
# deployments/helm/pvc/values.yaml
replicaCount: 3

image:
  repository: ghcr.io/reaatech/prompt-version-control
  pullPolicy: IfNotPresent
  tag: 'latest'

serviceAccount:
  create: true
  name: pvc-server
  annotations: {}

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop: ['ALL']

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: api.pvc.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: pvc-tls
      hosts:
        - api.pvc.example.com

resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

# Database configuration
postgresql:
  enabled: true
  auth:
    existingSecret: pvc-postgresql
  primary:
    persistence:
      size: 10Gi

# Redis configuration
redis:
  enabled: true
  auth:
    existingSecret: pvc-redis
  master:
    persistence:
      enabled: false

# Application configuration
config:
  logLevel: info
  nodeEnv: production
  maxPromptSize: 100000
  maxVersionsPerPrompt: 100

# Secrets (should be created separately)
secrets:
  existingSecret: pvc-secrets
```

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    tags:
      - 'v*.*.*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=sha

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: deployments/docker/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: v3.13.0

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.STAGING_KUBECONFIG }}

      - name: Deploy to staging
        run: |
          helm upgrade --install pvc deployments/helm/pvc \
            --namespace prompt-version-control \
            --create-namespace \
            --values deployments/helm/pvc/values-staging.yaml \
            --set image.tag=${{ github.ref_name }} \
            --wait --timeout 5m

      - name: Run smoke tests
        run: |
          kubectl run smoke-test --image=curlimages/curl --rm -it --restart=Never -- \
            https://staging-api.pvc.example.com/health

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: v3.13.0

      - name: Configure kubectl
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.PRODUCTION_KUBECONFIG }}

      - name: Deploy to production
        run: |
          helm upgrade --install pvc deployments/helm/pvc \
            --namespace prompt-version-control \
            --create-namespace \
            --values deployments/helm/pvc/values-production.yaml \
            --set image.tag=${{ github.ref_name }} \
            --wait --timeout 10m
```

## Environment Configuration

### Development

```yaml
# deployments/helm/pvc/values-dev.yaml
replicaCount: 1

image:
  tag: 'dev'

resources:
  limits:
    cpu: 500m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: false

ingress:
  enabled: false

config:
  logLevel: debug
  nodeEnv: development
```

### Staging

```yaml
# deployments/helm/pvc/values-staging.yaml
replicaCount: 2

image:
  tag: 'staging'

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 5

ingress:
  enabled: true
  hosts:
    - host: staging-api.pvc.example.com

config:
  logLevel: info
  nodeEnv: staging
```

### Production

```yaml
# deployments/helm/pvc/values-production.yaml
replicaCount: 3

image:
  tag: '1.0.0'

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20

ingress:
  enabled: true
  hosts:
    - host: api.pvc.example.com

config:
  logLevel: warn
  nodeEnv: production
  maxPromptSize: 100000
```

## Examples

### Example 1: Build and Push Docker Image

```bash
@agent deployment --action="build" --target="docker" --version="1.0.0"
```

Builds and pushes image to GitHub Container Registry.

### Example 2: Deploy to Staging

```bash
@agent deployment --action="deploy" --environment="staging" --version="1.0.0"
```

Deploys version 1.0.0 to staging environment.

### Example 3: Generate Kubernetes Manifests

```bash
@agent deployment --action="generate" --target="kubernetes" --environment="production"
```

Generates production Kubernetes manifests.

### Example 4: Configure Auto-scaling

```bash
@agent deployment --action="configure" --target="autoscaling" --min=3 --max=15
```

Configures HPA with 3-15 replicas.

## Best Practices

### 1. Security

- **Run as non-root user**
- **Use read-only root filesystem**
- **Drop all capabilities**
- **Scan images for vulnerabilities**
- **Use secrets management (not env vars for sensitive data)**

### 2. Reliability

- **Configure health checks**
- **Use Pod Disruption Budgets**
- **Implement graceful shutdown**
- **Set appropriate resource limits**
- **Use rolling update strategy**

### 3. Observability

- **Expose Prometheus metrics**
- **Configure structured logging**
- **Add distributed tracing**
- **Monitor resource usage**
- **Set up alerts**

### 4. Performance

- **Use multi-stage Docker builds**
- **Optimize container size**
- **Configure connection pooling**
- **Use caching layers**
- **Tune resource requests/limits**

## Error Handling

The skill provides clear error messages for:

- Docker build failures
- Kubernetes deployment errors
- Helm chart validation issues
- Configuration problems
- Resource constraints

## Integration

Deployment integrates with:

- **GitHub Actions**: CI/CD automation
- **Helm**: Package management
- **kubectl**: Cluster operations
- **Docker**: Container building
- **Monitoring**: Prometheus, Grafana
