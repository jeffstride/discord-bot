import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { command, drawDadJoke, loadDadJokes } from '../commands/dad.js';

function createJokeFiles(jokes) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dad-jokes-'));
  const jokesPath = path.join(directory, 'jokes.json');
  const statePath = path.join(directory, 'state.json');
  fs.writeFileSync(jokesPath, JSON.stringify(jokes));
  return { jokesPath, statePath };
}

test('defines the dad slash command', () => {
  assert.equal(command.name, 'dad');
  assert.equal(command.type, 1);
});

test('draws every joke once before starting a new cycle', () => {
  const files = createJokeFiles([
    { id: 'dad-001', text: 'First joke' },
    { id: 'dad-002', text: 'Second joke' },
    { id: 'dad-003', text: 'Third joke' },
  ]);

  const firstCycle = [
    drawDadJoke(files.jokesPath, files.statePath, () => 0.99),
    drawDadJoke(files.jokesPath, files.statePath, () => 0.99),
    drawDadJoke(files.jokesPath, files.statePath, () => 0.99),
  ];

  assert.deepEqual(firstCycle.map((joke) => joke.id), [
    'dad-003',
    'dad-002',
    'dad-001',
  ]);
  assert.equal(drawDadJoke(files.jokesPath, files.statePath, () => 0).id, 'dad-001');
});

test('adds a new joke to the current cycle and drops removed joke IDs', () => {
  const files = createJokeFiles([
    { id: 'dad-001', text: 'First joke' },
    { id: 'dad-002', text: 'Second joke' },
  ]);

  drawDadJoke(files.jokesPath, files.statePath, () => 0);
  fs.writeFileSync(files.jokesPath, JSON.stringify([
    { id: 'dad-001', text: 'First joke' },
    { id: 'dad-003', text: 'New joke' },
  ]));

  assert.equal(drawDadJoke(files.jokesPath, files.statePath, () => 0).id, 'dad-003');
});

test('loads the configured joke collection', () => {
  const files = createJokeFiles([{ id: 'dad-001', text: 'A joke' }]);
  assert.deepEqual(loadDadJokes(files.jokesPath), [
    { id: 'dad-001', text: 'A joke' },
  ]);
});
