import test from 'node:test';
import assert from 'node:assert/strict';

import { command } from '../commands/score.js';

test('score command has one optional reset action', () => {
  assert.equal(command.options.length, 1);
  assert.equal(command.options[0].name, 'action');
  assert.equal(command.options[0].required, false);
  assert.deepEqual(command.options[0].choices, [
    { name: 'reset', value: 'reset' },
  ]);
});
