import { command as helloCommand } from './commands/hello.js';
import { command as rollCommand } from './commands/roll.js';
import { command as remindCommand } from './commands/remind.js';
import { command as coldcallCommand } from './commands/coldcall.js';

export const ALL_COMMANDS = [helloCommand, rollCommand, remindCommand, coldcallCommand];
