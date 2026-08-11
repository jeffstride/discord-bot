import {
  InteractionResponseFlags,
  InteractionResponseType,
  MessageComponentTypes,
} from 'discord-interactions';

import {
  incrementStudentResult,
  isAuthorizedUser,
  loadStudents,
} from './coldcall.js';
import { getSectionPath, resolveActiveSection } from '../services/sections.js';

export const CREDIT_COMPONENT_PREFIX = 'credit_student:';

export const command = {
  name: 'credit',
  description: 'Give answer credit to a student',
  type: 1,
};

function unauthorizedResponse() {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'You are not authorized to use this command.',
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  };
}

export function createCreditResponse(students, sectionFilename = 'students.csv') {
  if (students.length === 0) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'No students were found in data/students.csv.' },
    };
  }

  if (students.length > 25) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'The /credit menu supports at most 25 students.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Select a student to receive answer credit.',
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.STRING_SELECT,
              custom_id: `${CREDIT_COMPONENT_PREFIX}${encodeURIComponent(sectionFilename)}`,
              placeholder: 'Select a student',
              min_values: 1,
              max_values: 1,
              options: students.map((student) => ({
                label: student.name,
                value: String(student.rowIndex),
              })),
            },
          ],
        },
      ],
    },
  };
}

export function handleCommand(req) {
  if (!isAuthorizedUser(req)) {
    return unauthorizedResponse();
  }

  try {
    const section = resolveActiveSection(req);

    if (section.status === 'required') {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '/setsection required before you can give credit' },
      };
    }

    if (section.status === 'missing') {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'No CSV files were found in the data directory.' },
      };
    }

    return createCreditResponse(loadStudents(section.path), section.filename);
  } catch (error) {
    console.error('Failed to load students for credit:', error.message);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'Unable to load students from data/students.csv.' },
    };
  }
}

export function recordCredit(rowIndex, studentsPath) {
  return incrementStudentResult(rowIndex, 'answered', studentsPath);
}

export function handleComponent(componentId, req) {
  if (!isAuthorizedUser(req)) {
    return unauthorizedResponse();
  }

  try {
    const sectionFilename = decodeURIComponent(
      componentId.slice(CREDIT_COMPONENT_PREFIX.length),
    );
    const rowIndex = Number.parseInt(req.body.data.values?.[0], 10);
    const studentName = recordCredit(rowIndex, getSectionPath(sectionFilename));

    return {
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: `${studentName} received answer credit.`,
        components: [],
      },
    };
  } catch (error) {
    console.error('Failed to record answer credit:', error.message);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Unable to update data/students.csv.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }
}
