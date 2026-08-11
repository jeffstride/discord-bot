import {
  ButtonStyleTypes,
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
export const CREDIT_PAGE_COMPONENT_PREFIX = 'credit_page:';
const STUDENTS_PER_PAGE = 25;
const MAX_STUDENTS = 50;

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

export function createCreditResponse(
  students,
  sectionFilename = 'students.csv',
  page = 0,
) {
  if (students.length === 0) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'No students were found in data/students.csv.' },
    };
  }

  if (students.length > MAX_STUDENTS) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `The /credit menu supports at most ${MAX_STUDENTS} students.`,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }

  const pageCount = Math.ceil(students.length / STUDENTS_PER_PAGE);
  const currentPage = Math.min(Math.max(page, 0), pageCount - 1);
  const pageStudents = students.slice(
    currentPage * STUDENTS_PER_PAGE,
    (currentPage + 1) * STUDENTS_PER_PAGE,
  );
  const encodedSection = encodeURIComponent(sectionFilename);

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `Select a student to receive answer credit. Page ${currentPage + 1} of ${pageCount}.`,
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.STRING_SELECT,
              custom_id: `${CREDIT_COMPONENT_PREFIX}${encodedSection}:${currentPage}`,
              placeholder: 'Select a student',
              min_values: 1,
              max_values: 1,
              options: pageStudents.map((student) => ({
                label: student.name,
                value: String(student.rowIndex),
              })),
            },
          ],
        },
        ...(pageCount > 1 ? [{
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.BUTTON,
              custom_id: `${CREDIT_PAGE_COMPONENT_PREFIX}${encodedSection}:${currentPage - 1}`,
              label: 'Previous',
              style: ButtonStyleTypes.SECONDARY,
              disabled: currentPage === 0,
            },
            {
              type: MessageComponentTypes.BUTTON,
              custom_id: `${CREDIT_PAGE_COMPONENT_PREFIX}${encodedSection}:${currentPage + 1}`,
              label: 'Next',
              style: ButtonStyleTypes.SECONDARY,
              disabled: currentPage === pageCount - 1,
            },
          ],
        }] : []),
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
    const componentValue = componentId.slice(CREDIT_COMPONENT_PREFIX.length);
    const separatorIndex = componentValue.lastIndexOf(':');
    const sectionFilename = decodeURIComponent(componentValue.slice(0, separatorIndex));
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

export function handlePageComponent(componentId, req) {
  if (!isAuthorizedUser(req)) {
    return unauthorizedResponse();
  }

  try {
    const componentValue = componentId.slice(CREDIT_PAGE_COMPONENT_PREFIX.length);
    const separatorIndex = componentValue.lastIndexOf(':');
    const sectionFilename = decodeURIComponent(componentValue.slice(0, separatorIndex));
    const page = Number.parseInt(componentValue.slice(separatorIndex + 1), 10);
    const studentsPath = getSectionPath(sectionFilename);
    const response = createCreditResponse(
      loadStudents(studentsPath),
      sectionFilename,
      page,
    );

    return {
      ...response,
      type: InteractionResponseType.UPDATE_MESSAGE,
    };
  } catch (error) {
    console.error('Failed to change credit page:', error.message);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Unable to load that student page.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }
}
