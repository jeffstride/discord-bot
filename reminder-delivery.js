const { DiscordRequest } = require('./utils');
const { loadReminders, scheduleReminder } = require('./reminders');

async function sendDiscordMessage(channelId, content) {
  if (!channelId) {
    return;
  }

  try {
    await DiscordRequest(`channels/${channelId}/messages`, {
      method: 'POST',
      body: { content },
    });
  } catch (error) {
    console.error('Failed to send reminder message:', error.message);
  }
}

async function deliverReminder(reminder) {
  await sendDiscordMessage(reminder.channelId, `⏰ Reminder: ${reminder.message}`);
}

function loadAndScheduleReminders() {
  loadReminders().forEach((reminder) => {
    scheduleReminder(reminder, deliverReminder);
  });
}

module.exports = { deliverReminder, loadAndScheduleReminders, sendDiscordMessage };
