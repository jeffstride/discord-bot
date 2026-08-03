// Slash command definitions. Each object here follows Discord's Application
// Command structure:
// https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-structure

const HELLO_COMMAND = {
  name: 'hello',
  description: 'Say hello to the bot',
  type: 1, // 1 = CHAT_INPUT, i.e. a slash command
};

const ROLL_COMMAND = {
  name: 'roll',
  description: 'Roll a die with the specified number of sides',
  type: 1,
  options: [
    {
      name: 'sides',
      description: 'Number of sides on the die',
      type: 4, // 4 = INTEGER
      required: true,
    },
  ],
};

const ALL_COMMANDS = [HELLO_COMMAND, ROLL_COMMAND];

module.exports = { ALL_COMMANDS, HELLO_COMMAND, ROLL_COMMAND };
