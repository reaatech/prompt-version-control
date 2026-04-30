import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InitCommand } from '../../commands/init.js';

vi.mock('../../config.js', () => ({
  saveConfig: vi.fn(),
}));

import { saveConfig } from '../../config.js';

describe('InitCommand', () => {
  let stdout: { write: ReturnType<typeof vi.fn> };
  let command: InitCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    stdout = { write: vi.fn() };
    command = new InitCommand();
    command.context = { stdout } as any;
  });

  it('should save config with provided api-url and api-key', async () => {
    command.apiUrl = 'http://custom:3000';
    command.apiKey = 'my-secret-key';

    await command.execute();

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith({
      apiUrl: 'http://custom:3000',
      apiKey: 'my-secret-key',
    });
    expect(stdout.write).toHaveBeenCalledWith('Initialized PVC CLI\n');
    expect(stdout.write).toHaveBeenCalledWith('API URL: http://custom:3000\n');
  });

  it('should require --api-key to be provided', async () => {
    command.apiUrl = undefined as any;
    command.apiKey = undefined as any;

    const result = await command.execute();

    expect(result).toBe(1);
    expect(saveConfig).not.toHaveBeenCalled();
    expect(stdout.write).toHaveBeenCalledWith('Error: --api-key is required\n');
  });

  it('should reject empty api-key with custom api-url', async () => {
    command.apiUrl = 'http://prod.example.com';
    command.apiKey = '';

    const result = await command.execute();

    expect(result).toBe(1);
    expect(saveConfig).not.toHaveBeenCalled();
    expect(stdout.write).toHaveBeenCalledWith('Error: --api-key is required\n');
  });
});
