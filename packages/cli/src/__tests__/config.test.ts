import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, saveConfig } from '../config.js';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  chmod: vi.fn(),
}));

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: vi.fn().mockReturnValue('/home/testuser'),
  };
});

import { readFile, writeFile } from 'fs/promises';

describe('loadConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return parsed config when file exists and is valid JSON', async () => {
    const config = { apiUrl: 'http://test.example.com', apiKey: 'key123' };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(config));

    const result = await loadConfig();
    expect(result).toEqual(config);
    expect(readFile).toHaveBeenCalledWith('/home/testuser/.pvcrc', 'utf8');
  });

  it('should return null when file does not exist', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await loadConfig();
    expect(result).toBeNull();
  });

  it('should return null when file contains invalid JSON', async () => {
    vi.mocked(readFile).mockResolvedValueOnce('not valid json');

    const result = await loadConfig();
    expect(result).toBeNull();
  });
});

describe('saveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write config as formatted JSON to ~/.pvcrc', async () => {
    const config = { apiUrl: 'http://test.example.com', apiKey: 'key123' };
    await saveConfig(config);

    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith(
      '/home/testuser/.pvcrc',
      JSON.stringify(config, null, 2),
    );
  });

  it('should include defaultProject when provided', async () => {
    const config = {
      apiUrl: 'http://test.example.com',
      apiKey: 'key123',
      defaultProject: 'proj-1',
    };
    await saveConfig(config);

    expect(writeFile).toHaveBeenCalledWith(
      '/home/testuser/.pvcrc',
      JSON.stringify(config, null, 2),
    );
  });
});
