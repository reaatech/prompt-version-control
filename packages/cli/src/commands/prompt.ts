import { Command, Option } from 'clipanion';
import { APIClient } from '../client.js';
import { loadConfig } from '../config.js';

export class PromptListCommand extends Command {
  static paths = [['prompt', 'list']];

  async execute() {
    const config = await loadConfig();
    if (!config) {
      this.context.stdout.write('Run `pvc init` first\n');
      return 1;
    }

    const client = new APIClient(config);
    const prompts = await client.listPrompts();
    for (const p of prompts.data) {
      this.context.stdout.write(`${p.id}\t${p.name}\n`);
    }
    return 0;
  }
}

export class PromptCreateCommand extends Command {
  static paths = [['prompt', 'create']];

  name = Option.String('-n,--name', { description: 'Prompt name' });
  template = Option.String('-t,--template', { description: 'Template content' });
  description = Option.String('-d,--description', { description: 'Description' });

  async execute() {
    const config = await loadConfig();
    if (!config) {
      this.context.stdout.write('Run `pvc init` first\n');
      return 1;
    }
    if (!this.name || !this.template) {
      this.context.stdout.write('Both --name and --template are required\n');
      return 1;
    }

    const client = new APIClient(config);
    const prompt = await client.createPrompt({
      name: this.name,
      template: this.template,
      description: this.description,
    });
    this.context.stdout.write(`Created prompt: ${prompt.id}\n`);
    return 0;
  }
}

export class PromptGetCommand extends Command {
  static paths = [['prompt', 'get']];

  // Accept id-or-name; resolve name → id transparently.
  promptRef = Option.String({ required: true });

  async execute() {
    const config = await loadConfig();
    if (!config) {
      this.context.stdout.write('Run `pvc init` first\n');
      return 1;
    }

    const client = new APIClient(config);
    const promptId = await client.resolvePromptId(this.promptRef);
    const prompt = await client.getPrompt(promptId);
    this.context.stdout.write(`${JSON.stringify(prompt, null, 2)}\n`);
    return 0;
  }
}
