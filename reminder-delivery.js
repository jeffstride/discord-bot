import { DiscordRequest } from './utils.js';
import { loadReminders, scheduleReminder } from './reminders.js';

export async function sendDiscordMessage(channelId, content) {
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

export async function deliverReminder(reminder) {
  await sendDiscordMessage(reminder.channelId, `⏰ Reminder: ${reminder.message}`);
}

export function loadAndScheduleReminders() {
  loadReminders().forEach((reminder) => {
    scheduleReminder(reminder, deliverReminder);
  });
}
