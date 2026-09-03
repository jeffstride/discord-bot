import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const servicesDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDirectory = path.join(servicesDirectory, '..', 'data');
const POLL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;
const SCORES_FILENAME = 'poll_scores.json';
export const POLL_TIMEOUT_VALUES = [0, 20000, 30000, 40000, 60000];

export function validatePollName(name) {
  return typeof name === 'string' && POLL_NAME_PATTERN.test(name);
}

// The definition (prompt/options/answer key) is meant to be committed to git.
export function getPollPath(name, dataDirectory = defaultDataDirectory) {
  if (!validatePollName(name)) {
    throw new Error('Poll names may contain only letters, numbers, hyphens, and underscores');
  }
  return path.join(dataDirectory, `poll-${name}.json`);
}

// The results (votes/voters) change on every response, so they're git-ignored.
export function getResultsPath(name, dataDirectory = defaultDataDirectory) {
  if (!validatePollName(name)) {
    throw new Error('Poll names may contain only letters, numbers, hyphens, and underscores');
  }
  return path.join(dataDirectory, `poll-results-${name}.json`);
}

export function getScoresPath(dataDirectory = defaultDataDirectory) {
  return path.join(dataDirectory, SCORES_FILENAME);
}

function loadResults(name, dataDirectory) {
  const resultsPath = getResultsPath(name, dataDirectory);
  if (!fs.existsSync(resultsPath)) {
    return { voters: [], counts: [] };
  }
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  return {
    voters: results.voters || [],
    counts: results.counts || [],
  };
}

function saveResults(name, { voters, counts }, dataDirectory) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(
    getResultsPath(name, dataDirectory),
    JSON.stringify({ voters, counts }, null, 2),
  );
}

export function loadPoll(name, dataDirectory = defaultDataDirectory) {
  const pollPath = getPollPath(name, dataDirectory);
  if (!fs.existsSync(pollPath)) {
    throw new Error(`Poll "${name}" does not exist`);
  }

  const definition = JSON.parse(fs.readFileSync(pollPath, 'utf8'));
  const results = loadResults(name, dataDirectory);

  return {
    name: definition.name,
    prompt: definition.prompt,
    options: definition.options.map((option, index) => ({
      text: option.text,
      count: results.counts[index] || 0,
    })),
    correctOptionIndexes: definition.correctOptionIndexes || [],
    timeoutMs: definition.timeoutMs || 0,
    voters: results.voters,
  };
}

function saveDefinition(poll, dataDirectory) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(getPollPath(poll.name, dataDirectory), JSON.stringify({
    name: poll.name,
    prompt: poll.prompt,
    options: poll.options.map((option) => ({ text: option.text })),
    correctOptionIndexes: poll.correctOptionIndexes,
    timeoutMs: poll.timeoutMs,
  }, null, 2));
  return poll;
}

function savePollResults(poll, dataDirectory) {
  saveResults(poll.name, {
    voters: poll.voters,
    counts: poll.options.map((option) => option.count),
  }, dataDirectory);
  return poll;
}

export function createPoll(
  name,
  prompt,
  answerLines,
  correctAnswerIndexes = '',
  dataDirectory = defaultDataDirectory,
  timeoutMs = 0,
) {
  if (!validatePollName(name)) {
    throw new Error('Invalid poll name');
  }

  const normalizedPrompt = prompt?.trim();
  const answers = answerLines
    .split(/\r?\n/)
    .map((answer) => answer.trim())
    .filter(Boolean);

  if (!normalizedPrompt) {
    throw new Error('A poll prompt is required');
  }
  if (answers.length < 2 || answers.length > 25) {
    throw new Error('A poll must have between 2 and 25 answers');
  }
  if (answers.some((answer) => answer.length > 100)) {
    throw new Error('Poll answers must be 100 characters or fewer');
  }

  const normalizedIndexes = correctAnswerIndexes?.trim() || '';
  const oneBasedIndexes = normalizedIndexes
    ? normalizedIndexes.split(',').map((value) => value.trim())
    : [];

  if (oneBasedIndexes.some((value) => !/^\d+$/.test(value))) {
    throw new Error('Correct answers must be comma-separated option numbers');
  }

  const correctOptionIndexes = [...new Set(
    oneBasedIndexes.map((value) => Number.parseInt(value, 10) - 1),
  )].toSorted((left, right) => left - right);

  if (correctOptionIndexes.some((index) => index < 0 || index >= answers.length)) {
    throw new Error(`Correct answer numbers must be between 1 and ${answers.length}`);
  }

  const normalizedTimeout = Number(timeoutMs);
  if (!POLL_TIMEOUT_VALUES.includes(normalizedTimeout)) {
    throw new Error('Invalid poll timeout');
  }

  return saveDefinition({
    name,
    prompt: normalizedPrompt,
    options: answers.map((text) => ({ text, count: 0 })),
    correctOptionIndexes,
    voters: [],
    timeoutMs: normalizedTimeout,
  }, dataDirectory);
}

export function deletePoll(name, dataDirectory = defaultDataDirectory) {
  const pollPath = getPollPath(name, dataDirectory);
  if (!fs.existsSync(pollPath)) {
    throw new Error(`Poll "${name}" does not exist`);
  }
  fs.unlinkSync(pollPath);
  const resultsPath = getResultsPath(name, dataDirectory);
  if (fs.existsSync(resultsPath)) {
    fs.unlinkSync(resultsPath);
  }
}

export function resetPoll(name, dataDirectory = defaultDataDirectory) {
  const poll = loadPoll(name, dataDirectory);
  poll.options.forEach((option) => {
    option.count = 0;
  });
  poll.voters = [];
  return savePollResults(poll, dataDirectory);
}

export function hasVoted(name, userId, dataDirectory = defaultDataDirectory) {
  return loadPoll(name, dataDirectory).voters.includes(userId);
}

export function loadScores(dataDirectory = defaultDataDirectory) {
  const scoresPath = getScoresPath(dataDirectory);
  if (!fs.existsSync(scoresPath)) {
    return { users: [] };
  }
  const scores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
  return {
    users: Array.isArray(scores.users)
      ? scores.users.map((user) => {
        const correct = Number.isInteger(user.correct) ? user.correct : Number(user.score) || 0;
        const incorrect = Number.isInteger(user.incorrect) ? user.incorrect : 0;
        return {
          userId: user.userId,
          username: user.username,
          correct,
          incorrect,
          score: (3 * correct) - incorrect,
        };
      })
      : [],
  };
}

function saveScores(scores, dataDirectory = defaultDataDirectory) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(getScoresPath(dataDirectory), JSON.stringify(scores, null, 2));
}

function updateUserScore(voter, isCorrect, dataDirectory) {
  const scores = loadScores(dataDirectory);
  let user = scores.users.find((candidate) => candidate.userId === voter.userId);

  if (!user) {
    user = {
      userId: voter.userId,
      username: voter.username,
      correct: 0,
      incorrect: 0,
      score: 0,
    };
    scores.users.push(user);
  }

  user.username = voter.username;
  if (isCorrect) {
    user.correct += 1;
  } else {
    user.incorrect += 1;
  }
  user.score = (3 * user.correct) - user.incorrect;
  saveScores(scores, dataDirectory);
}

export function getUserScoreRecord(userId, dataDirectory = defaultDataDirectory) {
  return loadScores(dataDirectory).users.find((user) => user.userId === userId) || {
    userId,
    correct: 0,
    incorrect: 0,
    score: 0,
  };
}

export function getUserScore(userId, dataDirectory = defaultDataDirectory) {
  return getUserScoreRecord(userId, dataDirectory).score;
}

export function getTopScores(limit = 5, dataDirectory = defaultDataDirectory) {
  return loadScores(dataDirectory).users
    .toSorted((left, right) => right.score - left.score || left.username.localeCompare(right.username))
    .slice(0, limit);
}

export function resetScores(dataDirectory = defaultDataDirectory) {
  saveScores({ users: [] }, dataDirectory);
}

export function recordPollVotes(
  name,
  selectedIndexes,
  voter,
  dataDirectory = defaultDataDirectory,
) {
  const poll = loadPoll(name, dataDirectory);
  if (!voter?.userId || !voter?.username) {
    throw new Error('Unable to identify the poll respondent');
  }
  if (poll.voters.includes(voter.userId)) {
    throw new Error('You have already answered this poll');
  }

  const uniqueIndexes = [...new Set(
    selectedIndexes.map((value) => Number.parseInt(value, 10)),
  )].toSorted((left, right) => left - right);

  if (uniqueIndexes.length !== 1) {
    throw new Error('Select exactly one poll answer');
  }

  uniqueIndexes.forEach((index) => {
    if (!Number.isInteger(index) || !poll.options[index]) {
      throw new Error('Invalid poll selection');
    }
    poll.options[index].count += 1;
  });

  poll.voters.push(voter.userId);
  const isQuiz = poll.correctOptionIndexes.length > 0;
  const isCorrect = isQuiz && poll.correctOptionIndexes.includes(uniqueIndexes[0]);

  savePollResults(poll, dataDirectory);
  if (isQuiz) {
    updateUserScore(voter, isCorrect, dataDirectory);
  }

  return { poll, isQuiz, isCorrect };
}
