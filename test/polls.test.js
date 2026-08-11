import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { command } from '../commands/poll.js';
import {
  createPoll,
  deletePoll,
  getTopScores,
  getUserScore,
  getUserScoreRecord,
  getPollPath,
  loadPoll,
  recordPollVotes,
  resetPoll,
  resetScores,
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

test('creates a poll and records aggregate votes by user', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Which answers apply?', 'First\nSecond\nThird', '', dataDirectory);

  recordPollVotes(
    'quiz1',
    ['0', '2'],
    { userId: 'user-1', username: 'Ada' },
    dataDirectory,
  );
  recordPollVotes(
    'quiz1',
    ['2'],
    { userId: 'user-2', username: 'Grace' },
    dataDirectory,
  );

  assert.deepEqual(loadPoll('quiz1', dataDirectory).options, [
    { text: 'First', count: 1 },
    { text: 'Second', count: 0 },
    { text: 'Third', count: 2 },
  ]);
  assert.deepEqual(loadPoll('quiz1', dataDirectory).voters, ['user-1', 'user-2']);
});

test('does not allow a user to answer the same poll twice', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  const voter = { userId: 'user-1', username: 'Ada' };
  createPoll('quiz1', 'Choose', 'First\nSecond', '', dataDirectory);
  recordPollVotes('quiz1', ['0'], voter, dataDirectory);

  assert.throws(
    () => recordPollVotes('quiz1', ['1'], voter, dataDirectory),
    /already answered/,
  );
});

test('resets counts without deleting the poll definition', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'First\nSecond', '', dataDirectory);
  recordPollVotes(
    'quiz1',
    ['1'],
    { userId: 'user-1', username: 'Ada' },
    dataDirectory,
  );

  resetPoll('quiz1', dataDirectory);

  const poll = loadPoll('quiz1', dataDirectory);
  assert.equal(poll.prompt, 'Choose');
  assert.deepEqual(poll.options.map((option) => option.count), [0, 0]);
  assert.deepEqual(poll.voters, []);
});

test('matches quiz answers by case-insensitive option prefix', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll(
    'quiz1',
    'Choose every A answer',
    'A) First\nB) Second\na) Third',
    'A)',
    dataDirectory,
  );

  const result = recordPollVotes(
    'quiz1',
    ['0', '2'],
    { userId: 'user-1', username: 'Ada' },
    dataDirectory,
  );

  assert.equal(result.isCorrect, true);
  assert.deepEqual(loadPoll('quiz1', dataDirectory).correctOptionIndexes, [0, 2]);
  assert.equal(getUserScore('user-1', dataDirectory), 3);
  assert.deepEqual(getUserScoreRecord('user-1', dataDirectory), {
    userId: 'user-1',
    username: 'Ada',
    correct: 1,
    incorrect: 0,
    score: 3,
  });
});

test('rejects a correct answer prefix that matches no option', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));

  assert.throws(
    () => createPoll('quiz1', 'Choose', 'A) First\nB) Second', 'C)', dataDirectory),
    /must match the start/,
  );
});

test('does not score a partial or extra quiz selection as correct', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'A) First\nA) Second\nB) Third', 'a)', dataDirectory);

  const result = recordPollVotes(
    'quiz1',
    ['0'],
    { userId: 'user-1', username: 'Ada' },
    dataDirectory,
  );

  assert.equal(result.isCorrect, false);
  assert.equal(getUserScore('user-1', dataDirectory), -1);
  assert.deepEqual(getUserScoreRecord('user-1', dataDirectory), {
    userId: 'user-1',
    username: 'Ada',
    correct: 0,
    incorrect: 1,
    score: -1,
  });
});

test('persists correct and incorrect counts with the calculated score', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  const voter = { userId: 'user-1', username: 'Ada' };
  createPoll('quiz1', 'Choose', 'A) Yes\nB) No', 'A)', dataDirectory);
  createPoll('quiz2', 'Choose', 'A) Yes\nB) No', 'A)', dataDirectory);
  recordPollVotes('quiz1', ['0'], voter, dataDirectory);
  recordPollVotes('quiz2', ['1'], voter, dataDirectory);

  const savedScores = JSON.parse(
    fs.readFileSync(path.join(dataDirectory, 'poll-scores.json'), 'utf8'),
  );
  assert.deepEqual(savedScores.users[0], {
    userId: 'user-1',
    username: 'Ada',
    correct: 1,
    incorrect: 1,
    score: 2,
  });
});

test('returns the top five cumulative quiz scores', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));

  for (let index = 0; index < 6; index += 1) {
    createPoll(`quiz${index}`, 'Choose', 'A) Yes\nB) No', 'A)', dataDirectory);
    recordPollVotes(
      `quiz${index}`,
      ['0'],
      { userId: `user-${index}`, username: `Student ${index}` },
      dataDirectory,
    );
  }

  assert.equal(getTopScores(5, dataDirectory).length, 5);
});

test('resets all cumulative quiz scores', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'A) Yes\nB) No', 'A)', dataDirectory);
  recordPollVotes(
    'quiz1',
    ['0'],
    { userId: 'user-1', username: 'Ada' },
    dataDirectory,
  );

  resetScores(dataDirectory);

  assert.deepEqual(getTopScores(5, dataDirectory), []);
});

test('deletes the poll file', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'First\nSecond', '', dataDirectory);

  deletePoll('quiz1', dataDirectory);

  assert.equal(fs.existsSync(getPollPath('quiz1', dataDirectory)), false);
});
