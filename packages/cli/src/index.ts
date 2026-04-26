#!/usr/bin/env node
import { Cli } from 'clipanion';
import { InitCommand } from './commands/init.js';
import { PromptListCommand, PromptCreateCommand, PromptGetCommand } from './commands/prompt.js';
import { VersionCreateCommand } from './commands/version.js';
import { TagSetCommand } from './commands/tag.js';

const cli = new Cli({
  binaryLabel: 'Prompt Version Control CLI',
  binaryName: 'pvc',
  binaryVersion: '0.1.0',
});

cli.register(InitCommand);
cli.register(PromptListCommand);
cli.register(PromptCreateCommand);
cli.register(PromptGetCommand);
cli.register(VersionCreateCommand);
cli.register(TagSetCommand);

cli.runExit(process.argv.slice(2));
