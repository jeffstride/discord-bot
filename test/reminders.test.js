import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  createReminder,
  loadReminders,
  removeReminder,
  saveReminders,
} from '../services/reminders.js';

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
