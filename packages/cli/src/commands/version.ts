import { Command, Option } from 'clipanion';
import { APIClient } from '../client.js';
import { loadConfig } from '../config.js';

export class VersionCreateCommand extends Command {
  static paths = [['version', 'create']];

  prompt = Option.String('-p,--prompt', { description: 'Prompt id or name' });
  content = Option.String('-c,--content', { description: 'Version content' });
  template = Option.String('-t,--template', {
    description: 'Template (defaults to --content if omitted)',
  });

  async execute() {
    const config = await loadConfig();
    if (!config) {
      this.context.stdout.write('Run `pvc init` first\n');
      return 1;
    }
    if (!this.prompt || !this.content) {
      this.context.stdout.write('Both --prompt and --content are required\n');
      return 1;
    }

    const client = new APIClient(config);
    const promptId = await client.resolvePromptId(this.prompt);
    const version = await client.createVersion(promptId, {
      content: this.content,
      template: this.template ?? this.content,
    });
    this.context.stdout.write(`Created version ${version.number}: ${version.id}\n`);
    return 0;
  }
}
