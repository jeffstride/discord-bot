import { command as helloCommand } from './commands/hello.js';
import { command as rollCommand } from './commands/roll.js';
import { command as remindCommand } from './commands/remind.js';
import { command as coldcallCommand } from './commands/coldcall.js';
import { command as creditCommand } from './commands/credit.js';
import { command as setSectionCommand } from './commands/setsection.js';
import { command as pollCommand } from './commands/poll.js';

export const ALL_COMMANDS = [
  helloCommand,
  rollCommand,
  remindCommand,
  coldcallCommand,
  creditCommand,
  setSectionCommand,
  pollCommand,
];
