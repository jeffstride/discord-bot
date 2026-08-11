const { InteractionResponseType } = require('discord-interactions');

const command = {
  name: 'roll',
  description: 'Roll a die with the specified number of sides',
  type: 1,
  options: [
    {
      name: 'sides',
      description: 'Number of sides on the die',
      type: 4,
      required: true,
    },
  ],
};

function handleCommand(req) {
  const { options = [] } = req.body.data;
  const sidesOption = options.find((option) => option.name === 'sides');
  const sides = Number(sidesOption?.value);

  if (!Number.isInteger(sides) || sides < 1) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Please provide a positive integer number of sides for the die.',
      },
    };
  }

  const roll = Math.floor(Math.random() * sides) + 1;
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: `🎲 You rolled a ${roll} (1-${sides})` },
  };
}

module.exports = { command, handleCommand };
