import { command as hello, handleCommand as handleHello } from './commands/hello.js';
import { command as roll, handleCommand as handleRoll } from './commands/roll.js';
import { command as remind, handleCommand as handleRemind } from './commands/remind.js';

const commandHandlers = {
  [hello.name]: handleHello,
  [roll.name]: handleRoll,
  [remind.name]: handleRemind,
};

export function handleCommand(req, res) {
  const { name } = req.body.data;
  const commandHandler = commandHandlers[name];

  if (commandHandler) {
    return res.send(commandHandler(req));
  }

  console.error(`Unrecognized command: ${name}`);
  return res.status(400).send({ error: 'Unknown command' });
}
