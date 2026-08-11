import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createCreditResponse, recordCredit } from '../commands/credit.js';

test('creates a student selection menu', () => {
  const response = createCreditResponse([
    { name: 'Ada', rowIndex: 0 },
    { name: 'Grace', rowIndex: 1 },
  ]);
  const menu = response.data.components[0].components[0];

  assert.deepEqual(menu.options, [
    { label: 'Ada', value: '0' },
    { label: 'Grace', value: '1' },
  ]);
});

test('increments the selected student answered count', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'students-'));
  const studentsPath = path.join(tempDirectory, 'students.csv');
  fs.writeFileSync(
    studentsPath,
    'name,answered,absent,passed\nAda,1,0,0\nGrace,3,1,0\n',
  );

  assert.equal(recordCredit(1, studentsPath), 'Grace');
  assert.equal(
    fs.readFileSync(studentsPath, 'utf8'),
    'name,answered,absent,passed\nAda,1,0,0\nGrace,4,1,0\n',
  );
});
