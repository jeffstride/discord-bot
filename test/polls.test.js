import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { command } from '../commands/poll.js';
import {
  createPoll,
  deletePoll,
  getPollPath,
  loadPoll,
  recordPollVotes,
  resetPoll,
  validatePollName,
} from '../services/polls.js';

test('poll command enforces the supported action choices', () => {
  const actionOption = command.options.find((option) => option.name === 'action');

  assert.deepEqual(
    actionOption.choices.map((choice) => choice.value),
    ['create', 'send', 'delete', 'reset', 'results'],
  );
});

test('validates poll names for safe filenames', () => {
  assert.equal(validatePollName('quiz1'), true);
  assert.equal(validatePollName('quiz-1_review'), true);
  assert.equal(validatePollName('../quiz'), false);
  assert.equal(validatePollName('quiz one'), false);
});

test('creates a poll and records anonymous aggregate votes', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Which answers apply?', 'First\nSecond\nThird', dataDirectory);

  recordPollVotes('quiz1', ['0', '2'], dataDirectory);
  recordPollVotes('quiz1', ['2'], dataDirectory);

  assert.deepEqual(loadPoll('quiz1', dataDirectory).options, [
    { text: 'First', count: 1 },
    { text: 'Second', count: 0 },
    { text: 'Third', count: 2 },
  ]);
  assert.equal(
    Object.hasOwn(loadPoll('quiz1', dataDirectory), 'voters'),
    false,
  );
});

test('resets counts without deleting the poll definition', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'First\nSecond', dataDirectory);
  recordPollVotes('quiz1', ['1'], dataDirectory);

  resetPoll('quiz1', dataDirectory);

  const poll = loadPoll('quiz1', dataDirectory);
  assert.equal(poll.prompt, 'Choose');
  assert.deepEqual(poll.options.map((option) => option.count), [0, 0]);
});

test('deletes the poll file', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'First\nSecond', dataDirectory);

  deletePoll('quiz1', dataDirectory);

  assert.equal(fs.existsSync(getPollPath('quiz1', dataDirectory)), false);
});
