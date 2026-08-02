// Slash command definitions. Each object here follows Discord's Application
// Command structure:
// https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-structure

const HELLO_COMMAND = {
  name: 'hello',
  description: 'Say hello to the bot',
  type: 1, // 1 = CHAT_INPUT, i.e. a slash command
};

const ALL_COMMANDS = [HELLO_COMMAND];

module.exports = { ALL_COMMANDS, HELLO_COMMAND };
