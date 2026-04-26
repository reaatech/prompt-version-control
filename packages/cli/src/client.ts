import type { PVCConfig } from './config.js';

export class APIClient {
  private config: PVCConfig;

  constructor(config: PVCConfig) {
    this.config = config;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.config.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async listPrompts() {
    return this.fetch<{ data: Array<{ id: string; name: string }> }>('/api/v1/prompts');
  }

  async getPrompt(id: string) {
    return this.fetch<{
      id: string;
      name: string;
      template: string;
      description: string | null;
      variables: Record<string, unknown>;
    }>(`/api/v1/prompts/${id}`);
  }

  /** Resolve a prompt id-or-name to its id, falling back to a list lookup. */
  async resolvePromptId(idOrName: string): Promise<string> {
    try {
      const p = await this.getPrompt(idOrName);
      return p.id;
    } catch {
      // Fall through and try by name.
    }
    const list = await this.listPrompts();
    const match = list.data.find((p) => p.name === idOrName);
    if (!match) {
      throw new Error(`No prompt found matching '${idOrName}'`);
    }
    return match.id;
  }

  async listVersions(promptId: string) {
    return this.fetch<{ data: Array<{ id: string; number: number }> }>(
      `/api/v1/prompts/${promptId}/versions`,
    );
  }

  async createPrompt(data: {
    name: string;
    template: string;
    description?: string;
    variables?: Record<string, unknown>;
  }) {
    return this.fetch<{
      id: string;
      name: string;
      template: string;
    }>('/api/v1/prompts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createVersion(
    promptId: string,
    data: {
      content: string;
      template: string;
      variables?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.fetch<{
      id: string;
      number: number;
      content: string;
    }>(`/api/v1/prompts/${promptId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async setTag(promptId: string, name: string, versionId: string) {
    return this.fetch<{
      id: string;
      name: string;
      versionId: string;
    }>(`/api/v1/prompts/${promptId}/tags/${name}`, {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    });
  }

  async getProduction(promptId: string) {
    return this.fetch<{
      id: string;
      number: number;
      content: string;
    }>(`/api/v1/prompts/${promptId}/production`);
  }
}
