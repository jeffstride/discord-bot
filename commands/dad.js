import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { InteractionResponseType } from 'discord-interactions';

const commandsDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.join(commandsDirectory, '..', 'data');
const defaultJokesPath = path.join(dataDirectory, 'dad-jokes.json');
const defaultStatePath = path.join(dataDirectory, 'dad-jokes-state.json');

export const command = {
  name: 'dad',
  description: 'Tell a random dad joke',
  type: 1,
};

export function loadDadJokes(jokesPath = defaultJokesPath) {
  const jokes = JSON.parse(fs.readFileSync(jokesPath, 'utf8'));

  if (!Array.isArray(jokes)) {
    throw new Error('dad-jokes.json must contain an array');
  }

  const validJokes = jokes.filter((joke) => (
    typeof joke?.id === 'string'
    && joke.id
    && typeof joke.text === 'string'
    && joke.text.trim()
  ));
  const jokeIds = new Set(validJokes.map((joke) => joke.id));

  if (jokeIds.size !== validJokes.length) {
    throw new Error('dad-jokes.json must contain unique joke IDs');
  }

  return validJokes;
}

function loadState(statePath) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      remaining: Array.isArray(state.remaining) ? state.remaining : [],
      cycleIds: Array.isArray(state.cycleIds) ? state.cycleIds : [],
    };
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
      throw error;
    }

    return { remaining: [], cycleIds: [] };
  }
}

function saveState(state, statePath) {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

export function drawDadJoke(
  jokesPath = defaultJokesPath,
  statePath = defaultStatePath,
  random = Math.random,
) {
  const jokes = loadDadJokes(jokesPath);

  if (jokes.length === 0) {
    return undefined;
  }

  const jokesById = new Map(jokes.map((joke) => [joke.id, joke]));
  const allIds = [...jokesById.keys()];
  const state = loadState(statePath);
  const previousCycleIds = new Set(state.cycleIds);
  let remaining = [...new Set(state.remaining)]
    .filter((id) => jokesById.has(id));

  // Include jokes added while a cycle is in progress. Removed IDs are discarded.
  remaining.push(...allIds.filter((id) => !previousCycleIds.has(id)));

  if (remaining.length === 0) {
    remaining = [...allIds];
  }

  const selectedIndex = Math.floor(random() * remaining.length);
  const [selectedId] = remaining.splice(selectedIndex, 1);
  saveState({ remaining, cycleIds: allIds }, statePath);

  return jokesById.get(selectedId);
}

export function handleCommand() {
  try {
    const joke = drawDadJoke();

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: joke?.text || 'No dad jokes were found.' },
    };
  } catch (error) {
    console.error('Failed to tell a dad joke:', error.message);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Unable to load a dad joke.' },
    };
  }
}
