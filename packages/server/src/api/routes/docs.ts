import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';

const router = new Hono();

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Locate the OpenAPI spec. We support several layouts:
 *   - dev:    packages/server/src/api/routes/  → ../../../../../docs/api/openapi.yaml
 *   - dist:   packages/server/dist/api/routes/ → ../../../../../docs/api/openapi.yaml
 *   - docker: /app/openapi.yaml (copied at build time)
 *   - explicit: $OPENAPI_SPEC_PATH
 */
const candidatePaths: string[] = [
  ...(process.env.OPENAPI_SPEC_PATH ? [process.env.OPENAPI_SPEC_PATH] : []),
  resolve(__dirname, '../../../../../docs/api/openapi.yaml'),
  resolve(process.cwd(), 'docs/api/openapi.yaml'),
  resolve(process.cwd(), 'openapi.yaml'),
];

let cachedSpec: string | null = null;
async function loadSpec(): Promise<string | null> {
  if (cachedSpec) return cachedSpec;
  for (const p of candidatePaths) {
    try {
      await stat(p);
      cachedSpec = await readFile(p, 'utf8');
      return cachedSpec;
    } catch {
      // try next candidate
    }
  }
  return null;
}

// Where Swagger UI assets are loaded from. Defaults to the public CDN; override
// via SWAGGER_UI_BASE_URL to point at a vendored copy for airgapped installs.
const SWAGGER_UI_BASE = (
  process.env.SWAGGER_UI_BASE_URL ?? 'https://unpkg.com/swagger-ui-dist@5'
).replace(/\/$/, '');

router.get('/', async (c) => {
  const spec = await loadSpec();
  if (!spec) {
    return c.json({ error: 'OpenAPI spec not found' }, 404);
  }

  const html = `<!DOCTYPE html>
<html>
  <head>
    <title>PVC API Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" type="text/css" href="${SWAGGER_UI_BASE}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${SWAGGER_UI_BASE}/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        SwaggerUIBundle({
          url: 'openapi.yaml',
          dom_id: '#swagger-ui',
        });
      };
    </script>
  </body>
</html>`;

  return c.html(html);
});

router.get('/openapi.yaml', async (c) => {
  const spec = await loadSpec();
  if (!spec) {
    return c.json({ error: 'OpenAPI spec not found' }, 404);
  }
  return c.text(spec, 200, { 'Content-Type': 'text/yaml' });
});

export { router as docsRoutes };
