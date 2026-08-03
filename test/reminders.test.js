const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createReminder, loadReminders, saveReminders, removeReminder } = require('../reminders');

test('reminders round-trip through storage', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reminders-'));
  const storagePath = path.join(tempDir, 'reminders.json');

  const reminder = createReminder({
    id: 'reminder-1',
    channelId: '123',
    userId: '456',
    message: 'Take a break',
    minutes: 5,
    createdAt: 1_700_000_000_000,
  });

  saveReminders([reminder], storagePath);
  const loaded = loadReminders(storagePath);

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].message, 'Take a break');
  assert.equal(loaded[0].minutes, 5);

  removeReminder('reminder-1', storagePath);
  assert.deepEqual(loadReminders(storagePath), []);
});
