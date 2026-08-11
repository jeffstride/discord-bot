const { command: hello, handleCommand: handleHello } = require('./commands/hello');
const { command: roll, handleCommand: handleRoll } = require('./commands/roll');
const { command: remind, handleCommand: handleRemind } = require('./commands/remind');

const commandHandlers = {
  [hello.name]: handleHello,
  [roll.name]: handleRoll,
  [remind.name]: handleRemind,
};

function handleCommand(req, res) {
  const { name } = req.body.data;
  const commandHandler = commandHandlers[name];

  if (commandHandler) {
    return res.send(commandHandler(req));
  }

  console.error(`Unrecognized command: ${name}`);
  return res.status(400).send({ error: 'Unknown command' });
}

module.exports = { handleCommand };
