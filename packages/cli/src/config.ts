import { readFile, writeFile, chmod } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { z } from 'zod';

export interface PVCConfig {
  apiUrl: string;
  apiKey: string;
  defaultProject?: string;
}

const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  defaultProject: z.string().optional(),
});

const CONFIG_PATH = join(homedir(), '.pvcrc');

export async function loadConfig(): Promise<PVCConfig | null> {
  try {
    const data = await readFile(CONFIG_PATH, 'utf8');
    return ConfigSchema.parse(JSON.parse(data));
  } catch {
    return null;
  }
}

export async function saveConfig(config: PVCConfig): Promise<void> {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
  // Restrict permissions: API key must not be world-readable. Best-effort —
  // some filesystems (e.g. Windows) ignore POSIX modes.
  try {
    await chmod(CONFIG_PATH, 0o600);
  } catch {
    // ignore
  }
}
