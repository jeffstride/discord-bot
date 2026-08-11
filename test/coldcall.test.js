import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createColdcallResponse,
  incrementStudentResult,
  isAuthorizedUser,
  loadStudentNames,
  selectRandomStudent,
} from '../commands/coldcall.js';

test('loads names and ignores other CSV columns', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'students-'));
  const studentsPath = path.join(tempDirectory, 'students.csv');
  fs.writeFileSync(studentsPath, 'id,name,email\n1,Ada,ada@example.com\n2,"Grace Hopper",grace@example.com\n');

  assert.deepEqual(loadStudentNames(studentsPath), ['Ada', 'Grace Hopper']);
});

test('selects a student using the supplied random value', () => {
  assert.equal(selectRandomStudent(['Ada', 'Grace'], () => 0.75), 'Grace');
});

test('returns the selected student in the command response', () => {
  const response = createColdcallResponse(['Ada', 'Grace'], () => 0);

  assert.equal(response.data.content, 'Ada has been selected');
  assert.equal(response.data.components[0].components[0].options.length, 3);
  assert.deepEqual(
    response.data.components[0].components[0].options.map((option) => option.value),
    ['answered', 'absent', 'passed'],
  );
});

test('increments a student result and preserves other CSV columns', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'students-'));
  const studentsPath = path.join(tempDirectory, 'students.csv');
  fs.writeFileSync(
    studentsPath,
    'name,email,answered,absent,passed\nAda,ada@example.com,1,0,2\nGrace,grace@example.com,0,0,0\n',
  );

  assert.equal(incrementStudentResult(0, 'answered', studentsPath), 'Ada');
  assert.equal(
    fs.readFileSync(studentsPath, 'utf8'),
    'name,email,answered,absent,passed\nAda,ada@example.com,2,0,2\nGrace,grace@example.com,0,0,0\n',
  );
});

test('authorizes the configured user in a server interaction', () => {
  const request = { body: { member: { user: { id: 'instructor-id' } } } };

  assert.equal(isAuthorizedUser(request, 'instructor-id'), true);
  assert.equal(isAuthorizedUser(request, 'another-id'), false);
});

test('authorizes the configured user in a direct-message interaction', () => {
  const request = { body: { user: { id: 'instructor-id' } } };

  assert.equal(isAuthorizedUser(request, 'instructor-id'), true);
});
