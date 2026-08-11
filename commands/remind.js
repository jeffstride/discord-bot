const { InteractionResponseType } = require('discord-interactions');
const { addReminder, createReminder, scheduleReminder } = require('../reminders');
const { deliverReminder } = require('../reminder-delivery');

const command = {
  name: 'remind',
  description: 'Schedule a reminder message for later',
  type: 1,
  options: [
    {
      name: 'minutes',
      description: 'How many minutes from now to send the reminder',
      type: 4,
      required: true,
    },
    {
      name: 'message',
      description: 'The reminder message to send',
      type: 3,
      required: true,
    },
  ],
};

function handleCommand(req) {
  const { data, channel_id, member, user } = req.body;
  const { options = [] } = data;
  const minutesOption = options.find((option) => option.name === 'minutes');
  const messageOption = options.find((option) => option.name === 'message');
  const minutes = Number(minutesOption?.value);
  const message = messageOption?.value;

  if (!Number.isInteger(minutes) || minutes < 1) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Please provide a positive integer number of minutes.' },
    };
  }

  if (typeof message !== 'string' || !message.trim()) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Please provide a reminder message.' },
    };
  }

  const reminder = createReminder({
    channelId: channel_id,
    userId: member?.user?.id || user?.id || 'unknown',
    message: message.trim(),
    minutes,
  });

  addReminder(reminder);
  scheduleReminder(reminder, deliverReminder);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `⏰ Reminder set for ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    },
  };
}

module.exports = { command, handleCommand };
