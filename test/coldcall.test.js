import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createColdcallResponse,
  formatDate,
  incrementStudentResult,
  isAuthorizedUser,
  loadEligibleStudents,
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

test('randomly selects only among students with the lowest answered count', () => {
  const students = [
    { name: 'Ada', rowIndex: 0, answered: 5 },
    { name: 'Grace', rowIndex: 1, answered: 4 },
    { name: 'Linus', rowIndex: 2, answered: 4 },
    { name: 'Margaret', rowIndex: 3, answered: 6 },
  ];

  assert.equal(
    createColdcallResponse(students, () => 0).data.content,
    'Grace has been selected',
  );
  assert.equal(
    createColdcallResponse(students, () => 0.75).data.content,
    'Linus has been selected',
  );
});

test('selects the sole student with the lowest answered count', () => {
  const students = [
    { name: 'Ada', rowIndex: 0, answered: 5 },
    { name: 'Grace', rowIndex: 1, answered: 4 },
    { name: 'Linus', rowIndex: 2, answered: 5 },
  ];

  assert.equal(
    createColdcallResponse(students, () => 0.99).data.content,
    'Grace has been selected',
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

test('records today when a student is absent', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'students-'));
  const studentsPath = path.join(tempDirectory, 'students.csv');
  fs.writeFileSync(
    studentsPath,
    'name,answered,absent,passed\nAda,1,0,2\n',
  );

  incrementStudentResult(0, 'absent', studentsPath, '2026-08-11');

  assert.equal(
    fs.readFileSync(studentsPath, 'utf8'),
    'name,answered,absent,passed,last-absent\nAda,1,1,2,2026-08-11\n',
  );
});

test('excludes students who were already absent today', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'students-'));
  const studentsPath = path.join(tempDirectory, 'students.csv');
  fs.writeFileSync(
    studentsPath,
    'name,answered,absent,passed,last-absent\nAda,0,1,0,2026-08-11\nGrace,0,1,0,2026-08-10\nLinus,0,0,0,\n',
  );

  assert.deepEqual(
    loadEligibleStudents(studentsPath, '2026-08-11').map((student) => student.name),
    ['Grace', 'Linus'],
  );
});

test('formats dates for CSV storage', () => {
  assert.equal(formatDate(new Date(2026, 7, 11)), '2026-08-11');
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
