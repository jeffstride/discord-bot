import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createSetSectionResponse } from '../commands/setsection.js';
import {
  clearActiveSections,
  discoverSectionFiles,
  resolveActiveSection,
  setActiveSection,
} from '../services/sections.js';

function createSections(...filenames) {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sections-'));
  filenames.forEach((filename) => {
    fs.writeFileSync(path.join(dataDirectory, filename), 'name,answered,absent,passed\n');
  });
  return dataDirectory;
}

test('automatically uses the only CSV file', () => {
  clearActiveSections();
  const dataDirectory = createSections('students-B.csv');
  const request = { body: { guild_id: 'guild-1' } };

  assert.equal(resolveActiveSection(request, dataDirectory).filename, 'students-B.csv');
});

test('requires a section when multiple CSV files exist', () => {
  clearActiveSections();
  const dataDirectory = createSections('students-B.csv', 'students-C.csv');
  const request = { body: { guild_id: 'guild-1' } };

  assert.equal(resolveActiveSection(request, dataDirectory).status, 'required');
});

test('remembers the selected section for each Discord server', () => {
  clearActiveSections();
  const dataDirectory = createSections('students-B.csv', 'students-C.csv');
  const firstServer = { body: { guild_id: 'guild-1' } };
  const secondServer = { body: { guild_id: 'guild-2' } };

  setActiveSection(firstServer, 'students-C.csv', dataDirectory);

  assert.equal(resolveActiveSection(firstServer, dataDirectory).filename, 'students-C.csv');
  assert.equal(resolveActiveSection(secondServer, dataDirectory).status, 'required');
});

test('lists CSV files in the section selection menu', () => {
  const dataDirectory = createSections('students-C.csv', 'students-B.csv');
  const files = discoverSectionFiles(dataDirectory);
  const response = createSetSectionResponse(files);
  const options = response.data.components[0].components[0].options;

  assert.deepEqual(options, [
    { label: 'students-B.csv', value: 'students-B.csv' },
    { label: 'students-C.csv', value: 'students-C.csv' },
  ]);
});
