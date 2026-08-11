import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DiscordRequest } from '../utils.js';

const servicesDirectory = path.dirname(fileURLToPath(import.meta.url));

function resolveStoragePath(storagePath) {
  return storagePath
    || process.env.REMINDERS_FILE
    || path.join(servicesDirectory, '..', 'data', 'reminders.json');
}

function ensureStorageDirectory(storagePath) {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
}

export function loadReminders(storagePath) {
  const resolvedPath = resolveStoragePath(storagePath);

  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load reminders:', error.message);
    return [];
  }
}

export function saveReminders(reminders, storagePath) {
  const resolvedPath = resolveStoragePath(storagePath);
  ensureStorageDirectory(resolvedPath);
  fs.writeFileSync(resolvedPath, JSON.stringify(reminders, null, 2));
}

export function createReminder({ id, channelId, userId, message, minutes, createdAt }) {
  const now = createdAt ?? Date.now();

  return {
    id: id ?? `${now}-${Math.random().toString(16).slice(2)}`,
    channelId,
    userId,
    message,
    minutes,
    createdAt: now,
    dueAt: now + minutes * 60 * 1000,
  };
}

export function addReminder(reminder, storagePath) {
  const reminders = loadReminders(storagePath);
  reminders.push(reminder);
  saveReminders(reminders, storagePath);
  return reminder;
}

export function removeReminder(id, storagePath) {
  const reminders = loadReminders(storagePath).filter((reminder) => reminder.id !== id);
  saveReminders(reminders, storagePath);
  return reminders;
}

export function scheduleReminder(reminder, onDue, storagePath) {
  const delay = Math.max(0, reminder.dueAt - Date.now());

  return setTimeout(() => {
    const persistedReminder = loadReminders(storagePath).find((item) => item.id === reminder.id);

    if (!persistedReminder) {
      onDue(reminder);
      return;
    }

    if (persistedReminder.dueAt <= Date.now()) {
      removeReminder(persistedReminder.id, storagePath);
      onDue(persistedReminder);
    }
  }, delay);
}

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
