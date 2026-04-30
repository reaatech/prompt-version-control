import { Command, Option } from 'clipanion';
import { saveConfig } from '../config.js';

export class InitCommand extends Command {
  static paths = [['init']];

  apiUrl = Option.String('--api-url', { description: 'PVC server URL' });
  apiKey = Option.String('--api-key', { description: 'API key' });

  async execute() {
    const url = this.apiUrl || 'http://localhost:3000';
    if (!this.apiKey) {
      this.context.stdout.write('Error: --api-key is required\n');
      return 1;
    }

    await saveConfig({ apiUrl: url, apiKey: this.apiKey });
    this.context.stdout.write('Initialized PVC CLI\n');
    this.context.stdout.write(`API URL: ${url}\n`);
    return 0;
  }
}
