import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const servicesDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDirectory = path.join(servicesDirectory, '..', 'data');
const POLL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;
const SCORES_FILENAME = 'poll_scores.json';
export const POLL_TIMEOUT_VALUES = [0, 20000, 30000, 40000, 60000];
export const MAX_POLL_QUESTIONS = 10;

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
    return { voters: [], counts: [], responses: {} };
  }
  const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
  return {
    voters: results.voters || [],
    counts: results.counts || [],
    responses: results.responses || {},
  };
}

function saveResults(name, { voters, counts, responses }, dataDirectory) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(
    getResultsPath(name, dataDirectory),
    JSON.stringify({ voters, counts, responses }, null, 2),
  );
}

function validateQuestion(question, questionIndex) {
  const prompt = question?.prompt?.trim();
  const options = Array.isArray(question?.options) ? question.options : [];
  const correctOptionIndexes = question?.correctOptionIndexes || [];
  const optionTexts = options.map((option) => (
    typeof option === 'string' ? option : option?.text
  ));

  if (!prompt) {
    throw new Error(`Question ${questionIndex + 1} requires a prompt`);
  }
  if (options.length < 2 || options.length > 25) {
    throw new Error(`Question ${questionIndex + 1} must have between 2 and 25 answers`);
  }
  if (optionTexts.some((option) => typeof option !== 'string'
    || !option.trim() || option.length > 100)) {
    throw new Error(`Question ${questionIndex + 1} answers must be 1 to 100 characters`);
  }
  if (!Array.isArray(correctOptionIndexes)
    || correctOptionIndexes.some((index) => !Number.isInteger(index)
      || index < 0 || index >= options.length)) {
    throw new Error(`Question ${questionIndex + 1} has an invalid correct answer index`);
  }

  return {
    prompt,
    options: optionTexts.map((option) => ({ text: option.trim() })),
    correctOptionIndexes: [...new Set(correctOptionIndexes)].toSorted((left, right) => left - right),
  };
}

function normalizeQuestions(definition) {
  const questions = Array.isArray(definition.questions)
    ? definition.questions
    : [{
      prompt: definition.prompt,
      options: definition.options,
      correctOptionIndexes: definition.correctOptionIndexes || [],
    }];

  if (questions.length < 1 || questions.length > MAX_POLL_QUESTIONS) {
    throw new Error(`A poll must have between 1 and ${MAX_POLL_QUESTIONS} questions`);
  }
  return questions.map(validateQuestion);
}

export function loadPoll(name, dataDirectory = defaultDataDirectory) {
  const pollPath = getPollPath(name, dataDirectory);
  if (!fs.existsSync(pollPath)) {
    throw new Error(`Poll "${name}" does not exist`);
  }

  const definition = JSON.parse(fs.readFileSync(pollPath, 'utf8'));
  const results = loadResults(name, dataDirectory);
  const timeoutMs = Number(definition.timeoutMs || 0);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new Error('Poll timeout must be a non-negative number');
  }

  const questions = normalizeQuestions(definition).map((question, questionIndex) => ({
    ...question,
    options: question.options.map((option, optionIndex) => ({
      ...option,
      count: Array.isArray(results.counts[questionIndex])
        ? (results.counts[questionIndex][optionIndex] || 0)
        // Compatibility with result files created by the single-question format.
        : (questionIndex === 0 ? results.counts[optionIndex] || 0 : 0),
    })),
  }));
  const poll = {
    name,
    questions,
    timeoutMs,
    voters: results.voters,
    responses: results.responses,
  };
  // Keep the original service API useful for callers handling one-question polls.
  poll.prompt = questions[0].prompt;
  poll.options = questions[0].options;
  poll.correctOptionIndexes = questions[0].correctOptionIndexes;
  return poll;
}

function saveDefinition(poll, dataDirectory) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(getPollPath(poll.name, dataDirectory), JSON.stringify({
    name: poll.name,
    questions: poll.questions.map((question) => ({
      prompt: question.prompt,
      options: question.options.map((option) => option.text),
      correctOptionIndexes: question.correctOptionIndexes,
    })),
    timeoutMs: poll.timeoutMs,
  }, null, 2));
  return poll;
}

function savePollResults(poll, dataDirectory) {
  saveResults(poll.name, {
    voters: poll.voters,
    counts: poll.questions.map((question) => question.options.map((option) => option.count)),
    responses: poll.responses,
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
    questions: [{
      prompt: normalizedPrompt,
      options: answers.map((text) => ({ text, count: 0 })),
      correctOptionIndexes,
    }],
    voters: [],
    responses: {},
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
  poll.questions.forEach((question) => {
    question.options.forEach((option) => {
      option.count = 0;
    });
  });
  poll.voters = [];
  poll.responses = {};
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
  questionIndex = 0,
) {
  const poll = loadPoll(name, dataDirectory);
  if (!voter?.userId || !voter?.username) {
    throw new Error('Unable to identify the poll respondent');
  }
  if (poll.voters.includes(voter.userId)) {
    throw new Error('You have already answered this poll');
  }

  const existingResponses = poll.responses[voter.userId] || [];
  if (questionIndex !== existingResponses.length || !poll.questions[questionIndex]) {
    throw new Error('This poll question is no longer active');
  }
  const question = poll.questions[questionIndex];

  const uniqueIndexes = [...new Set(
    selectedIndexes.map((value) => Number.parseInt(value, 10)),
  )].toSorted((left, right) => left - right);

  if (uniqueIndexes.length !== 1) {
    throw new Error('Select exactly one poll answer');
  }

  uniqueIndexes.forEach((index) => {
    if (!Number.isInteger(index) || !question.options[index]) {
      throw new Error('Invalid poll selection');
    }
    question.options[index].count += 1;
  });

  poll.responses[voter.userId] = [...existingResponses, uniqueIndexes[0]];
  const isComplete = poll.responses[voter.userId].length === poll.questions.length;
  if (isComplete) {
    poll.voters.push(voter.userId);
  }
  const isQuiz = question.correctOptionIndexes.length > 0;
  const isCorrect = isQuiz && question.correctOptionIndexes.includes(uniqueIndexes[0]);

  savePollResults(poll, dataDirectory);
  if (isQuiz) {
    updateUserScore(voter, isCorrect, dataDirectory);
  }

  return { poll, question, questionIndex, isQuiz, isCorrect, isComplete };
}
