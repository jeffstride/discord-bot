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

test('paginates up to 50 students in groups of 25', () => {
  const students = Array.from({ length: 50 }, (_, rowIndex) => ({
    name: `Student ${rowIndex + 1}`,
    rowIndex,
  }));

  const firstPage = createCreditResponse(students, 'students-B.csv', 0);
  const secondPage = createCreditResponse(students, 'students-B.csv', 1);
  const firstMenu = firstPage.data.components[0].components[0];
  const secondMenu = secondPage.data.components[0].components[0];

  assert.equal(firstMenu.options.length, 25);
  assert.equal(firstMenu.options[0].label, 'Student 1');
  assert.equal(firstMenu.options[24].label, 'Student 25');
  assert.equal(secondMenu.options.length, 25);
  assert.equal(secondMenu.options[0].label, 'Student 26');
  assert.equal(secondMenu.options[24].label, 'Student 50');
  assert.match(firstPage.data.content, /Page 1 of 2/);
  assert.match(secondPage.data.content, /Page 2 of 2/);
});

test('rejects rosters larger than 50 students', () => {
  const students = Array.from({ length: 51 }, (_, rowIndex) => ({
    name: `Student ${rowIndex + 1}`,
    rowIndex,
  }));

  const response = createCreditResponse(students);

  assert.equal(response.data.content, 'The /credit menu supports at most 50 students.');
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
