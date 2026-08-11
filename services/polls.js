import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const servicesDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDirectory = path.join(servicesDirectory, '..', 'data');
const POLL_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

export function validatePollName(name) {
  return typeof name === 'string' && POLL_NAME_PATTERN.test(name);
}

export function getPollPath(name, dataDirectory = defaultDataDirectory) {
  if (!validatePollName(name)) {
    throw new Error('Poll names may contain only letters, numbers, hyphens, and underscores');
  }

  return path.join(dataDirectory, `poll-${name}.json`);
}

export function loadPoll(name, dataDirectory = defaultDataDirectory) {
  const pollPath = getPollPath(name, dataDirectory);

  if (!fs.existsSync(pollPath)) {
    throw new Error(`Poll "${name}" does not exist`);
  }

  return JSON.parse(fs.readFileSync(pollPath, 'utf8'));
}

export function savePoll(poll, dataDirectory = defaultDataDirectory) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(getPollPath(poll.name, dataDirectory), JSON.stringify(poll, null, 2));
  return poll;
}

export function createPoll(name, prompt, answerLines, dataDirectory = defaultDataDirectory) {
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

  return savePoll({
    name,
    prompt: normalizedPrompt,
    options: answers.map((text) => ({ text, count: 0 })),
  }, dataDirectory);
}

export function deletePoll(name, dataDirectory = defaultDataDirectory) {
  const pollPath = getPollPath(name, dataDirectory);

  if (!fs.existsSync(pollPath)) {
    throw new Error(`Poll "${name}" does not exist`);
  }

  fs.unlinkSync(pollPath);
}

export function resetPoll(name, dataDirectory = defaultDataDirectory) {
  const poll = loadPoll(name, dataDirectory);
  poll.options.forEach((option) => {
    option.count = 0;
  });
  return savePoll(poll, dataDirectory);
}

export function recordPollVotes(name, selectedIndexes, dataDirectory = defaultDataDirectory) {
  const poll = loadPoll(name, dataDirectory);
  const uniqueIndexes = new Set(selectedIndexes.map((value) => Number.parseInt(value, 10)));

  uniqueIndexes.forEach((index) => {
    if (!Number.isInteger(index) || !poll.options[index]) {
      throw new Error('Invalid poll selection');
    }
    poll.options[index].count += 1;
  });

  savePoll(poll, dataDirectory);
  return poll;
}
