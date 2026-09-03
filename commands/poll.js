import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  MessageComponentTypes,
} from 'discord-interactions';
import { DiscordRequest } from '../utils.js';

import { isAuthorizedUser } from './coldcall.js';
import {
  createPoll,
  deletePoll,
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
const TIMEOUT_INPUT_ID = 'poll_timeout';
const POLL_ACTIONS = ['create', 'send', 'delete', 'reset', 'results'];
const activeBallotTimers = new Map();

export function formatPollTimeout(timeoutMs) {
  if (timeoutMs === 60000) {
    return '1 minute';
  }
  return `${timeoutMs / 1000} seconds`;
}

export function addTimeoutNotice(content, timeoutMs) {
  return timeoutMs
    ? `${content}\nCloses in ${formatPollTimeout(timeoutMs)}`
    : content;
}

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

export function createModal(name) {
  return {
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `${POLL_CREATE_MODAL_PREFIX}${name}`,
      title: `Create poll: ${name}`.slice(0, 45),
      components: [
        {
          type: MessageComponentTypes.LABEL,
          label: 'Prompt text',
          component: {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: PROMPT_INPUT_ID,
            style: 1,
            required: true,
            max_length: 1000,
          },
        },
        {
          type: MessageComponentTypes.LABEL,
          label: 'Answers (one per line)',
          component: {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: ANSWERS_INPUT_ID,
            style: 2,
            required: true,
            max_length: 4000,
          },
        },
        {
          type: MessageComponentTypes.LABEL,
          label: 'Correct option numbers (optional)',
          component: {
            type: MessageComponentTypes.INPUT_TEXT,
            custom_id: CORRECT_ANSWER_INPUT_ID,
            style: 1,
            required: false,
            max_length: 100,
            placeholder: 'Example: 1,3',
          },
        },
        {
          type: MessageComponentTypes.LABEL,
          label: 'Timeout',
          component: {
            type: MessageComponentTypes.STRING_SELECT,
            custom_id: TIMEOUT_INPUT_ID,
            min_values: 1,
            max_values: 1,
            options: [
              { label: 'none', value: '0', default: true },
              { label: '20 seconds', value: '20000' },
              { label: '30 seconds', value: '30000' },
              { label: '40 seconds', value: '40000' },
              { label: '1 minute', value: '60000' },
            ],
          },
        },
      ],
    },
  };
}

function scheduleMessageTimeout(endpoint, timeoutMs, content, onExpire) {
  const timer = setTimeout(() => {
    onExpire?.();
    DiscordRequest(endpoint, {
      method: 'PATCH',
      body: { content, components: [] },
    }).catch((error) => {
      console.error('Failed to expire poll interaction:', error.message);
    });
  }, timeoutMs);
  timer.unref?.();
  return timer;
}

function getOriginalResponseEndpoint(req) {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  if (!applicationId || !req.body.token) {
    throw new Error('Unable to schedule the poll timeout');
  }
  return `webhooks/${applicationId}/${req.body.token}/messages/@original`;
}

function createSendResponse(name, req) {
  const poll = loadPoll(name);
  const response = {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: addTimeoutNotice(`Poll: ${name}`, poll.timeoutMs),
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

  if (!poll.timeoutMs) {
    return response;
  }

  const endpoint = getOriginalResponseEndpoint(req);
  return {
    response,
    afterResponse: () => {
      scheduleMessageTimeout(
        endpoint,
        poll.timeoutMs,
        `Poll: ${name}\nThis poll is closed.`,
      );
    },
  };
}

function formatResults(poll) {
  return [
    `Results for poll ${poll.name}:`,
    ...poll.questions.flatMap((question, index) => [
      `\nQuestion ${index + 1}: ${question.prompt}`,
      ...question.options.map((option) => `${option.text}: ${option.count}`),
    ]),
  ].join('\n');
}

function ballotContent(poll, questionIndex, prefix = '') {
  const question = poll.questions[questionIndex];
  const heading = poll.questions.length > 1
    ? `Question ${questionIndex + 1} of ${poll.questions.length}\n`
    : '';
  return addTimeoutNotice(`${prefix}${heading}${question.prompt}`, poll.timeoutMs);
}

function ballotComponents(name, question, questionIndex) {
  return [{
    type: MessageComponentTypes.ACTION_ROW,
    components: [{
      type: MessageComponentTypes.STRING_SELECT,
      custom_id: `${POLL_VOTE_COMPONENT_PREFIX}${name}:${questionIndex}`,
      placeholder: 'Select an answer',
      min_values: 1,
      max_values: 1,
      options: question.options.map((option, index) => ({
        label: option.text,
        value: String(index),
      })),
    }],
  }];
}

function scheduleBallotTimeout(endpoint, poll, questionIndex, ballotKey) {
  const question = poll.questions[questionIndex];
  const heading = poll.questions.length > 1
    ? `Question ${questionIndex + 1} of ${poll.questions.length}\n`
    : '';
  const timer = scheduleMessageTimeout(
    endpoint,
    poll.timeoutMs,
    `${heading}${question.prompt}\nTime expired. No response was recorded.`,
    () => {
      if (activeBallotTimers.get(ballotKey) === timer) {
        activeBallotTimers.delete(ballotKey);
      }
    },
  );
  activeBallotTimers.set(ballotKey, timer);
}

export function getInvokingUser(req) {
  const user = req.body.member?.user || req.body.user;
  return {
    userId: user?.id,
    username: req.body.member?.nick || user?.global_name || user?.username,
  };
}

export function handleCommand(req) {
  if (!isAuthorizedUser(req)) {
    return message('You are not authorized to use this command.', true);
  }

  const name = getOption(req, 'name');
  const action = getOption(req, 'action');

  if (!validatePollName(name)) {
    return message('Poll names may contain only letters, numbers, hyphens, and underscores.', true);
  }

  if (!POLL_ACTIONS.includes(action)) {
    return message('Invalid poll action.', true);
  }


  if (action === 'create') {
    return createModal(name);
  }

  try {
    if (action === 'send') {
      return createSendResponse(name, req);
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
    .flatMap((container) => (
      container.component ? [container.component] : container.components || []
    ))
    .find((input) => input.custom_id === inputId);
}

export function handleModalSubmit(modalId, req) {
  if (!isAuthorizedUser(req)) {
    return message('You are not authorized to create polls.', true);
  }

  try {
    const name = modalId.slice(POLL_CREATE_MODAL_PREFIX.length);
    createPoll(
      name,
      modalInputValue(req, PROMPT_INPUT_ID)?.value,
      modalInputValue(req, ANSWERS_INPUT_ID)?.value,
      modalInputValue(req, CORRECT_ANSWER_INPUT_ID)?.value,
      undefined,
      modalInputValue(req, TIMEOUT_INPUT_ID)?.values?.[0],
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
    const ballotKey = `${name}:${userId}`;
    const questionIndex = (poll.responses[userId] || []).length;

    if (hasVoted(name, userId)) {
      return message('You have already answered this poll.', true);
    }

    if (activeBallotTimers.has(ballotKey)) {
      return message('You already have an active ballot for this poll.', true);
    }

    const response = {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: ballotContent(poll, questionIndex),
        flags: InteractionResponseFlags.EPHEMERAL,
        components: ballotComponents(name, poll.questions[questionIndex], questionIndex),
      },
    };

    if (!poll.timeoutMs) {
      return response;
    }

    const endpoint = getOriginalResponseEndpoint(req);
    return {
      response,
      afterResponse: () => {
        scheduleBallotTimeout(endpoint, poll, questionIndex, ballotKey);
      },
    };
  } catch (error) {
    return message(error.message, true);
  }
}

export function handleVoteComponent(componentId, req) {
  try {
    const ballotId = componentId.slice(POLL_VOTE_COMPONENT_PREFIX.length);
    const separatorIndex = ballotId.lastIndexOf(':');
    const name = separatorIndex === -1 ? ballotId : ballotId.slice(0, separatorIndex);
    const questionIndex = separatorIndex === -1
      ? 0
      : Number.parseInt(ballotId.slice(separatorIndex + 1), 10);
    const applicationId = process.env.DISCORD_APPLICATION_ID;

    if (!applicationId || !req.body.token || !req.body.message?.id) {
      throw new Error('Unable to update the poll interaction');
    }

    const selectedIndexes = req.body.data.values || [];
    const result = recordPollVotes(
      name,
      selectedIndexes,
      getInvokingUser(req),
      undefined,
      questionIndex,
    );
    const ballotKey = `${name}:${getInvokingUser(req).userId}`;
    const ballotTimer = activeBallotTimers.get(ballotKey);
    if (ballotTimer) {
      clearTimeout(ballotTimer);
      activeBallotTimers.delete(ballotKey);
    }
    const selectedOption = result.question.options[Number.parseInt(selectedIndexes[0], 10)].text;
    const outcome = result.isQuiz
      ? (result.isCorrect ? '✅ Correct' : '❌ Incorrect')
      : 'Response recorded';
    const endpoint = `webhooks/${applicationId}/${req.body.token}/messages/${req.body.message.id}`;
    const nextQuestionIndex = questionIndex + 1;
    const feedback = `You selected: ${selectedOption}\n${outcome}`;
    const nextQuestion = result.poll.questions[nextQuestionIndex];
    return {
      response: {
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      },
      afterResponse: async () => {
        await DiscordRequest(endpoint, {
          method: 'PATCH',
          body: nextQuestion ? {
            content: ballotContent(result.poll, nextQuestionIndex, `${feedback}\n\n`),
            components: ballotComponents(name, nextQuestion, nextQuestionIndex),
          } : {
            content: `${feedback}\n\nPoll complete.`,
            components: [],
          },
        });
        if (nextQuestion && result.poll.timeoutMs) {
          scheduleBallotTimeout(endpoint, result.poll, nextQuestionIndex, ballotKey);
        }
      },
    };
  } catch (error) {
    return { response: message(error.message, true) };
  }
}
