import { command as hello, handleCommand as handleHello } from './commands/hello.js';
import { command as roll, handleCommand as handleRoll } from './commands/roll.js';
import { command as remind, handleCommand as handleRemind } from './commands/remind.js';
import { command as coldcall, handleCommand as handleColdcall } from './commands/coldcall.js';
import { command as credit, handleCommand as handleCredit } from './commands/credit.js';
import { command as setSection, handleCommand as handleSetSection } from './commands/setsection.js';
import { command as poll, handleCommand as handlePoll } from './commands/poll.js';
import { command as score, handleCommand as handleScore } from './commands/score.js';
import { command as dad, handleCommand as handleDad } from './commands/dad.js';

const commandHandlers = {
  [hello.name]: handleHello,
  [roll.name]: handleRoll,
  [remind.name]: handleRemind,
  [coldcall.name]: handleColdcall,
  [credit.name]: handleCredit,
  [setSection.name]: handleSetSection,
  [poll.name]: handlePoll,
  [score.name]: handleScore,
  [dad.name]: handleDad,
};

export async function handleCommand(req, res) {
  const { name } = req.body.data;
  const commandHandler = commandHandlers[name];

  if (commandHandler) {
    const result = commandHandler(req);

    if (!result) {
      console.error(`Command could not be handled: ${name}`);
      return res.status(400).json({ error: 'Command could not be handled' });
    }

    res.send(result.response || result);

    if (result.afterResponse) {
      try {
        await result.afterResponse();
      } catch (error) {
        console.error('Error updating command response:', error.message);
      }
    }

    return;
  }

  console.error(`Unrecognized command: ${name}`);
  return res.status(400).send({ error: 'Unknown command' });
}
