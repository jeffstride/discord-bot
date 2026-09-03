import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  addTimeoutNotice,
  command,
  createModal,
  formatPollTimeout,
} from '../commands/poll.js';
import {
  createPoll,
  deletePoll,
  getTopScores,
  getUserScore,
  getUserScoreRecord,
  getPollPath,
  loadPoll,
  MAX_POLL_QUESTIONS,
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

test('poll modal provides the supported timeout choices', () => {
  const modal = createModal('quiz1');
  const timeoutLabel = modal.data.components.find((component) => (
    component.component?.custom_id === 'poll_timeout'
  ));

  assert.deepEqual(
    timeoutLabel.component.options.map((option) => [option.label, option.value]),
    [
      ['none', '0'],
      ['20 seconds', '20000'],
      ['30 seconds', '30000'],
      ['40 seconds', '40000'],
      ['1 minute', '60000'],
    ],
  );
});

test('formats timeout notices for poll invitations and ballots', () => {
  assert.equal(formatPollTimeout(20000), '20 seconds');
  assert.equal(formatPollTimeout(30000), '30 seconds');
  assert.equal(formatPollTimeout(40000), '40 seconds');
  assert.equal(formatPollTimeout(60000), '1 minute');
  assert.equal(
    addTimeoutNotice('Poll: quiz1', 30000),
    'Poll: quiz1\nCloses in 30 seconds',
  );
  assert.equal(addTimeoutNotice('Poll: quiz1', 0), 'Poll: quiz1');
});

test('validates poll names for safe filenames', () => {
  assert.equal(validatePollName('quiz1'), true);
  assert.equal(validatePollName('quiz-1_review'), true);
  assert.equal(validatePollName('../quiz'), false);
  assert.equal(validatePollName('quiz one'), false);
});

test('persists a poll timeout', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'Yes\nNo', '', dataDirectory, 30000);

  assert.equal(loadPoll('quiz1', dataDirectory).timeoutMs, 30000);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(getPollPath('quiz1', dataDirectory), 'utf8')).questions[0].options,
    ['Yes', 'No'],
  );
  assert.throws(
    () => createPoll('quiz2', 'Choose', 'Yes\nNo', '', dataDirectory, 15000),
    /Invalid poll timeout/,
  );
});

test('loads the legacy single-question JSON format', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  fs.writeFileSync(getPollPath('legacy', dataDirectory), JSON.stringify({
    name: 'legacy',
    prompt: 'Choose',
    options: [{ text: 'Yes' }, { text: 'No' }],
    correctOptionIndexes: [0],
    timeoutMs: 0,
  }));

  const poll = loadPoll('legacy', dataDirectory);
  assert.equal(poll.questions.length, 1);
  assert.equal(poll.prompt, 'Choose');
  assert.deepEqual(poll.options.map((option) => option.text), ['Yes', 'No']);
});

test('loads and records a multi-question poll in sequence', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  fs.writeFileSync(getPollPath('quiz1', dataDirectory), JSON.stringify({
    name: 'quiz1',
    questions: [
      {
        prompt: 'First?',
        options: ['A', 'B'],
        correctOptionIndexes: [0],
      },
      {
        prompt: 'Second?',
        options: ['C', 'D'],
        correctOptionIndexes: [1],
      },
    ],
    timeoutMs: 20000,
  }));
  const voter = { userId: 'user-1', username: 'Ada' };

  const first = recordPollVotes('quiz1', ['0'], voter, dataDirectory, 0);
  assert.equal(first.isComplete, false);
  assert.deepEqual(first.poll.responses['user-1'], [0]);
  assert.deepEqual(first.poll.voters, []);
  assert.throws(
    () => recordPollVotes('quiz1', ['0'], voter, dataDirectory, 0),
    /no longer active/,
  );

  const second = recordPollVotes('quiz1', ['1'], voter, dataDirectory, 1);
  assert.equal(second.isComplete, true);
  assert.deepEqual(second.poll.voters, ['user-1']);
  assert.deepEqual(
    second.poll.questions.map((question) => question.options.map((option) => option.count)),
    [[1, 0], [0, 1]],
  );
  assert.equal(getUserScore('user-1', dataDirectory), 6);
});

test('accepts at most ten questions in a manually authored poll', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  const question = {
    prompt: 'Choose',
    options: ['Yes', 'No'],
    correctOptionIndexes: [],
  };
  fs.writeFileSync(getPollPath('ten', dataDirectory), JSON.stringify({
    name: 'ten',
    questions: Array.from({ length: MAX_POLL_QUESTIONS }, () => question),
  }));
  assert.equal(loadPoll('ten', dataDirectory).questions.length, 10);

  fs.writeFileSync(getPollPath('eleven', dataDirectory), JSON.stringify({
    name: 'eleven',
    questions: Array.from({ length: MAX_POLL_QUESTIONS + 1 }, () => question),
  }));
  assert.throws(() => loadPoll('eleven', dataDirectory), /between 1 and 10 questions/);
});

test('creates a poll and records aggregate votes by user', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Which answers apply?', 'First\nSecond\nThird', '', dataDirectory);

  recordPollVotes(
    'quiz1',
    ['0'],
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
    { text: 'Third', count: 1 },
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

test('allows the configured instructor user to answer a poll', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'A) Yes\nB) No', '1', dataDirectory);

  const result = recordPollVotes(
    'quiz1',
    ['0'],
    { userId: 'instructor-id', username: 'Instructor' },
    dataDirectory,
  );

  assert.equal(result.isCorrect, true);
  assert.equal(getUserScore('instructor-id', dataDirectory), 3);
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

test('accepts any configured correct option number', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll(
    'quiz1',
    'Choose every A answer',
    'A) First\nB) Second\na) Third',
    '1,3',
    dataDirectory,
  );

  const result = recordPollVotes(
    'quiz1',
    ['2'],
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

test('rejects a correct answer number outside the option range', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));

  assert.throws(
    () => createPoll('quiz1', 'Choose', 'A) First\nB) Second', '3', dataDirectory),
    /between 1 and 2/,
  );
});

test('scores an option outside the correct answer list as incorrect', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'A) First\nA) Second\nB) Third', '1,2', dataDirectory);

  const result = recordPollVotes(
    'quiz1',
    ['2'],
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

test('rejects multiple selections in a poll response', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  createPoll('quiz1', 'Choose', 'A) First\nB) Second', '1', dataDirectory);

  assert.throws(
    () => recordPollVotes(
      'quiz1',
      ['0', '1'],
      { userId: 'user-1', username: 'Ada' },
      dataDirectory,
    ),
    /exactly one/,
  );
});

test('persists correct and incorrect counts with the calculated score', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'polls-'));
  const voter = { userId: 'user-1', username: 'Ada' };
  createPoll('quiz1', 'Choose', 'A) Yes\nB) No', '1', dataDirectory);
  createPoll('quiz2', 'Choose', 'A) Yes\nB) No', '1', dataDirectory);
  recordPollVotes('quiz1', ['0'], voter, dataDirectory);
  recordPollVotes('quiz2', ['1'], voter, dataDirectory);

  const savedScores = JSON.parse(
    fs.readFileSync(path.join(dataDirectory, 'poll_scores.json'), 'utf8'),
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
    createPoll(`quiz${index}`, 'Choose', 'A) Yes\nB) No', '1', dataDirectory);
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
  createPoll('quiz1', 'Choose', 'A) Yes\nB) No', '1', dataDirectory);
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
