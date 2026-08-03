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

const REMIND_COMMAND = {
  name: 'remind',
  description: 'Schedule a reminder message for later',
  type: 1,
  options: [
    {
      name: 'minutes',
      description: 'How many minutes from now to send the reminder',
      type: 4, // 4 = INTEGER
      required: true,
    },
    {
      name: 'message',
      description: 'The reminder message to send',
      type: 3, // 3 = STRING
      required: true,
    },
  ],
};

const ALL_COMMANDS = [HELLO_COMMAND, ROLL_COMMAND, REMIND_COMMAND];

module.exports = { ALL_COMMANDS, HELLO_COMMAND, ROLL_COMMAND, REMIND_COMMAND };
