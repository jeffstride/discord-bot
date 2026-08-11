import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  InteractionResponseFlags,
  InteractionResponseType,
  MessageComponentTypes,
} from 'discord-interactions';

const commandsDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultStudentsPath = path.join(commandsDirectory, '..', 'data', 'students.csv');
export const COLD_CALL_COMPONENT_PREFIX = 'coldcall_result:';
const RESULT_COLUMNS = ['answered', 'absent', 'passed'];

export const command = {
  name: 'coldcall',
  description: 'Randomly select a student',
  type: 1,
};

export function parseCsvRow(row) {
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

function loadStudentsCsv(studentsPath = defaultStudentsPath) {
  const rows = fs.readFileSync(studentsPath, 'utf8')
    .split(/\r?\n/)
    .filter((row) => row.trim());

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvRow(rows[0]).map((header) => header.trim());
  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const nameIndex = normalizedHeaders.indexOf('name');

  if (nameIndex === -1) {
    throw new Error('students.csv must contain a "name" column');
  }

  return {
    headers,
    rows: rows.slice(1).map((row) => parseCsvRow(row)),
    nameIndex,
    normalizedHeaders,
  };
}

export function loadStudentNames(studentsPath = defaultStudentsPath) {
  return loadStudents(studentsPath).map((student) => student.name);
}

function loadStudents(studentsPath = defaultStudentsPath) {
  const studentsCsv = loadStudentsCsv(studentsPath);
  return studentsCsv.rows
    .map((row, rowIndex) => ({
      name: row[studentsCsv.nameIndex]?.trim(),
      rowIndex,
    }))
    .filter((student) => student.name);
}

export function selectRandomStudent(names, random = Math.random) {
  if (names.length === 0) {
    return undefined;
  }

  return names[Math.floor(random() * names.length)];
}

export function createColdcallResponse(names, random = Math.random) {
  const selectableStudents = names
    .map((student, rowIndex) => (
      typeof student === 'string' ? { name: student, rowIndex } : student
    ))
    .filter((student) => student.name);
  const student = selectableStudents[Math.floor(random() * selectableStudents.length)];

  if (!student) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'No students were found in data/students.csv.' },
    };
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `${student.name} has been selected`,
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.STRING_SELECT,
              custom_id: `${COLD_CALL_COMPONENT_PREFIX}${student.rowIndex}`,
              placeholder: 'Record the result',
              min_values: 1,
              max_values: 1,
              options: RESULT_COLUMNS.map((result) => ({
                label: result,
                value: result,
              })),
            },
          ],
        },
      ],
    },
  };
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function incrementStudentResult(rowIndex, result, studentsPath = defaultStudentsPath) {
  if (!RESULT_COLUMNS.includes(result)) {
    throw new Error(`Unknown cold-call result: ${result}`);
  }

  const studentsCsv = loadStudentsCsv(studentsPath);
  const resultIndex = studentsCsv.normalizedHeaders.indexOf(result);
  const studentRow = studentsCsv.rows[rowIndex];

  if (resultIndex === -1) {
    throw new Error(`students.csv must contain an "${result}" column`);
  }

  if (!studentRow || !studentRow[studentsCsv.nameIndex]?.trim()) {
    throw new Error('The selected student no longer exists in students.csv');
  }

  const currentValue = Number.parseInt(studentRow[resultIndex] || '0', 10);
  studentRow[resultIndex] = String((Number.isNaN(currentValue) ? 0 : currentValue) + 1);

  const outputRows = [studentsCsv.headers, ...studentsCsv.rows]
    .map((row) => row.map(escapeCsvValue).join(','));
  fs.writeFileSync(studentsPath, `${outputRows.join('\n')}\n`);

  return studentRow[studentsCsv.nameIndex].trim();
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
    return createColdcallResponse(loadStudents());
  } catch (error) {
    console.error('Failed to select a student:', error.message);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Unable to load students from data/students.csv.' },
    };
  }
}

export function handleComponent(componentId, req) {
  if (!isAuthorizedUser(req)) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'You are not authorized to use this menu.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }

  try {
    const rowIndex = Number.parseInt(componentId.slice(COLD_CALL_COMPONENT_PREFIX.length), 10);
    const result = req.body.data.values?.[0];
    const studentName = incrementStudentResult(rowIndex, result);

    return {
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: `${studentName} has been selected\nResult recorded: ${result}`,
        components: [],
      },
    };
  } catch (error) {
    console.error('Failed to record cold-call result:', error.message);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Unable to update data/students.csv.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }
}
