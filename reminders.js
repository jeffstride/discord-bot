const fs = require('node:fs');
const path = require('node:path');

function resolveStoragePath(storagePath) {
  return storagePath || process.env.REMINDERS_FILE || path.join(__dirname, 'data', 'reminders.json');
}

function ensureStorageDirectory(storagePath) {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
}

function loadReminders(storagePath) {
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

function saveReminders(reminders, storagePath) {
  const resolvedPath = resolveStoragePath(storagePath);
  ensureStorageDirectory(resolvedPath);
  fs.writeFileSync(resolvedPath, JSON.stringify(reminders, null, 2));
}

function createReminder({ id, channelId, userId, message, minutes, createdAt }) {
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

function addReminder(reminder, storagePath) {
  const reminders = loadReminders(storagePath);
  reminders.push(reminder);
  saveReminders(reminders, storagePath);
  return reminder;
}

function removeReminder(id, storagePath) {
  const reminders = loadReminders(storagePath).filter((reminder) => reminder.id !== id);
  saveReminders(reminders, storagePath);
  return reminders;
}

function scheduleReminder(reminder, onDue, storagePath) {
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

module.exports = {
  addReminder,
  createReminder,
  loadReminders,
  removeReminder,
  saveReminders,
  scheduleReminder,
};
