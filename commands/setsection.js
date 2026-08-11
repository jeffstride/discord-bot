import {
  InteractionResponseFlags,
  InteractionResponseType,
  MessageComponentTypes,
} from 'discord-interactions';

import { isAuthorizedUser } from './coldcall.js';
import { discoverSectionFiles, setActiveSection } from '../services/sections.js';

export const SET_SECTION_COMPONENT_ID = 'set_section';

export const command = {
  name: 'setsection',
  description: 'Select the student section used by class commands',
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

export function createSetSectionResponse(files) {
  if (files.length === 0) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'No CSV files were found in the data directory.' },
    };
  }

  if (files.length > 25) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: 'The /setsection menu supports at most 25 CSV files.' },
    };
  }

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: 'Select the active student section.',
      flags: InteractionResponseFlags.EPHEMERAL,
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.STRING_SELECT,
              custom_id: SET_SECTION_COMPONENT_ID,
              placeholder: 'Select a CSV file',
              options: files.map((filename) => ({
                label: filename,
                value: filename,
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

  return createSetSectionResponse(discoverSectionFiles());
}

export function handleComponent(req) {
  if (!isAuthorizedUser(req)) {
    return unauthorizedResponse();
  }

  try {
    const filename = req.body.data.values?.[0];
    setActiveSection(req, filename);
    return {
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: `${filename} is now the active section.`,
        components: [],
      },
    };
  } catch (error) {
    console.error('Failed to set section:', error.message);
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Unable to set that section.',
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    };
  }
}
