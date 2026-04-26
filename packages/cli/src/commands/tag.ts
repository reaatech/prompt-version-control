import { Command, Option } from 'clipanion';
import { loadConfig } from '../config.js';
import { APIClient } from '../client.js';

export class TagSetCommand extends Command {
  static paths = [['tag', 'set']];

  prompt = Option.String('-p,--prompt', { description: 'Prompt id or name' });
  // Accept either --version <number-or-id> or the legacy -v alias.
  version = Option.String('-v,--version', {
    description: 'Version number or id',
  });
  // Tag is the canonical spelling per README; -n/--name kept as an alias.
  tag = Option.String('-t,--tag,-n,--name', {
    description: 'Tag name (draft/staging/production)',
  });

  async execute() {
    const config = await loadConfig();
    if (!config) {
      this.context.stdout.write('Run `pvc init` first\n');
      return 1;
    }
    if (!this.prompt || !this.version || !this.tag) {
      this.context.stdout.write('Required: --prompt, --version, --tag\n');
      return 1;
    }

    const client = new APIClient(config);
    const promptId = await client.resolvePromptId(this.prompt);

    // Allow `--version 2` (number) by resolving it to a version id.
    let versionId = this.version;
    if (/^\d+$/.test(this.version)) {
      const number = Number(this.version);
      const versions = await client.listVersions(promptId);
      const match = versions.data.find((v) => v.number === number);
      if (!match) {
        this.context.stdout.write(`No version #${number} for prompt ${this.prompt}\n`);
        return 1;
      }
      versionId = match.id;
    }

    const result = await client.setTag(promptId, this.tag, versionId);
    this.context.stdout.write(`Set ${result.name} on ${this.prompt} → ${result.versionId}\n`);
    return 0;
  }
}
