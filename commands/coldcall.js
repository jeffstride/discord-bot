import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  InteractionResponseFlags,
  InteractionResponseType,
} from 'discord-interactions';

const commandsDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultStudentsPath = path.join(commandsDirectory, '..', 'data', 'students.csv');

export const command = {
  name: 'coldcall',
  description: 'Randomly select a student',
  type: 1,
};

function parseCsvRow(row) {
  const values = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (inQuotes && row[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

export function loadStudentNames(studentsPath = defaultStudentsPath) {
  const rows = fs.readFileSync(studentsPath, 'utf8')
    .split(/\r?\n/)
    .filter((row) => row.trim());

  if (rows.length === 0) {
    return [];
  }

  const headers = parseCsvRow(rows[0]).map((header) => header.trim().toLowerCase());
  const nameIndex = headers.indexOf('name');

  if (nameIndex === -1) {
    throw new Error('students.csv must contain a "name" column');
  }

  return rows.slice(1)
    .map((row) => parseCsvRow(row)[nameIndex]?.trim())
    .filter(Boolean);
}

export function selectRandomStudent(names, random = Math.random) {
  if (names.length === 0) {
    return undefined;
  }

  return names[Math.floor(random() * names.length)];
}

export function createColdcallResponse(names, random = Math.random) {
  const student = selectRandomStudent(names, random);

  if (!student) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'No students were found in data/students.csv.' },
    };
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: `${student} has been selected` },
  };
}

export function isAuthorizedUser(req, allowedUserId = process.env.COLD_CALL_USER_ID) {
  const invokingUserId = req.body.member?.user?.id || req.body.user?.id;
  return Boolean(allowedUserId) && invokingUserId === allowedUserId;
}

export function handleCommand(req) {
  if (!isAuthorizedUser(req)) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'You are not authorized to use this command.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }

  try {
    return createColdcallResponse(loadStudentNames());
  } catch (error) {
    console.error('Failed to select a student:', error.message);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Unable to load students from data/students.csv.' },
    };
  }
}
