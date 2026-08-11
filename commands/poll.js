import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  MessageComponentTypes,
} from 'discord-interactions';

import { isAuthorizedUser } from './coldcall.js';
import {
  createPoll,
  deletePoll,
  getTopScores,
  getUserScore,
  hasVoted,
  loadPoll,
  recordPollVotes,
  resetPoll,
  validatePollName,
} from '../services/polls.js';

export const POLL_CREATE_MODAL_PREFIX = 'poll_create:';
export const POLL_OPEN_COMPONENT_PREFIX = 'poll_open:';
export const POLL_VOTE_COMPONENT_PREFIX = 'poll_vote:';
const PROMPT_INPUT_ID = 'poll_prompt';
const ANSWERS_INPUT_ID = 'poll_answers';
const CORRECT_ANSWER_INPUT_ID = 'poll_correct_answer';
const POLL_ACTIONS = ['create', 'send', 'delete', 'reset', 'results', 'score'];

export const command = {
  name: 'poll',
  description: 'Create, send, manage, or view a poll',
  type: 1,
  options: [
    {
      name: 'name',
      description: 'Poll name, such as quiz1',
      type: 3,
      required: true,
    },
    {
      name: 'action',
      description: 'Action to perform',
      type: 3,
      required: true,
      choices: POLL_ACTIONS.map((action) => ({ name: action, value: action })),
    },
  ],
};

function message(content, ephemeral = false) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      ...(ephemeral ? { flags: InteractionResponseFlags.EPHEMERAL } : {}),
    },
  };
}

function getOption(req, name) {
  return req.body.data.options?.find((option) => option.name === name)?.value;
}

function createModal(name) {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `${POLL_CREATE_MODAL_PREFIX}${name}`,
      title: `Create poll: ${name}`.slice(0, 45),
      components: [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [{
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: PROMPT_INPUT_ID,
            style: 1,
            label: 'Prompt text',
            required: true,
            max_length: 1000,
          }],
        },
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [{
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: ANSWERS_INPUT_ID,
            style: 2,
            label: 'Answers (one per line)',
            required: true,
            max_length: 4000,
          }],
        },
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [{
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: CORRECT_ANSWER_INPUT_ID,
            style: 1,
            label: 'Correct answer prefix (optional)',
            required: false,
            max_length: 100,
          }],
        },
      ],
    },
  };
}

function createSendResponse(name) {
  loadPoll(name);
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `Poll: ${name}`,
      components: [{
        type: MessageComponentTypes.ACTION_ROW,
        components: [{
          type: MessageComponentTypes.BUTTON,
          custom_id: `${POLL_OPEN_COMPONENT_PREFIX}${name}`,
          label: `Poll: ${name}`.slice(0, 80),
          style: ButtonStyleTypes.PRIMARY,
        }],
      }],
    },
  };
}

function formatResults(poll) {
  return [
    `Results for poll ${poll.name}:`,
    ...poll.options.map((option) => `${option.text}: ${option.count}`),
  ].join('\n');
}

function getInvokingUser(req) {
  const user = req.body.member?.user || req.body.user;
  return {
    userId: user?.id,
    username: req.body.member?.nick || user?.global_name || user?.username,
  };
}

function formatScoreResponse(req) {
  const invokingUser = getInvokingUser(req);

  if (isAuthorizedUser(req)) {
    const topScores = getTopScores();
    return topScores.length === 0
      ? 'No quiz scores have been recorded.'
      : [
        'Top quiz scores:',
        ...topScores.map((user, index) => `${index + 1}. ${user.username}: ${user.score}`),
      ].join('\n');
  }

  return `${invokingUser.username || 'Your'} score: ${getUserScore(invokingUser.userId)}`;
}

export function handleCommand(req) {
  const name = getOption(req, 'name');
  const action = getOption(req, 'action');

  if (!validatePollName(name)) {
    return message('Poll names may contain only letters, numbers, hyphens, and underscores.', true);
  }

  if (!POLL_ACTIONS.includes(action)) {
    return message('Invalid poll action.', true);
  }

  if (action === 'score') {
    return message(formatScoreResponse(req), true);
  }

  if (!isAuthorizedUser(req)) {
    return message('You are not authorized to use this command.', true);
  }

  if (action === 'create') {
    return createModal(name);
  }

  try {
    if (action === 'send') {
      return createSendResponse(name);
    }
    if (action === 'delete') {
      deletePoll(name);
      return message(`Poll ${name} was deleted.`, true);
    }
    if (action === 'reset') {
      resetPoll(name);
      return message(`Poll ${name} was reset.`, true);
    }
    return message(formatResults(loadPoll(name)));
  } catch (error) {
    return message(error.message, true);
  }
}

function modalInputValue(req, inputId) {
  return req.body.data.components
    .flatMap((row) => row.components)
    .find((input) => input.custom_id === inputId)?.value;
}

export function handleModalSubmit(modalId, req) {
  if (!isAuthorizedUser(req)) {
    return message('You are not authorized to create polls.', true);
  }

  try {
    const name = modalId.slice(POLL_CREATE_MODAL_PREFIX.length);
    createPoll(
      name,
      modalInputValue(req, PROMPT_INPUT_ID),
      modalInputValue(req, ANSWERS_INPUT_ID),
      modalInputValue(req, CORRECT_ANSWER_INPUT_ID),
    );
    return message(`Poll ${name} was created.`, true);
  } catch (error) {
    return message(error.message, true);
  }
}

export function handleOpenComponent(componentId, req) {
  try {
    const name = componentId.slice(POLL_OPEN_COMPONENT_PREFIX.length);
    const poll = loadPoll(name);
    const { userId } = getInvokingUser(req);

    if (hasVoted(name, userId)) {
      return message('You have already answered this poll.', true);
    }

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: poll.prompt,
        flags: InteractionResponseFlags.EPHEMERAL,
        components: [{
          type: MessageComponentTypes.ACTION_ROW,
          components: [{
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: `${POLL_VOTE_COMPONENT_PREFIX}${name}`,
            placeholder: 'Select one or more answers',
            min_values: 1,
            max_values: poll.options.length,
            options: poll.options.map((option, index) => ({
              label: option.text,
              value: String(index),
            })),
          }],
        }],
      },
    };
  } catch (error) {
    return message(error.message, true);
  }
}

export function handleVoteComponent(componentId, req) {
  try {
    const name = componentId.slice(POLL_VOTE_COMPONENT_PREFIX.length);
    recordPollVotes(name, req.body.data.values || [], getInvokingUser(req));
    return {
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: 'Your response was recorded.',
        components: [],
      },
    };
  } catch (error) {
    return message(error.message, true);
  }
}
