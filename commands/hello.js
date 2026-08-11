const { InteractionResponseType } = require('discord-interactions');

const command = {
  name: 'hello',
  description: 'Say hello to the bot',
  type: 1,
};

function handleCommand() {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Hello from your Codespaces-hosted bot! 👋' },
  };
}

module.exports = { command, handleCommand };
