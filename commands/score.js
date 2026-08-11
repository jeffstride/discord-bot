import {
  InteractionResponseFlags,
  InteractionResponseType,
} from 'discord-interactions';

import { isAuthorizedUser } from './coldcall.js';
import { getInvokingUser } from './poll.js';
import {
  getTopScores,
  getUserScoreRecord,
  resetScores,
} from '../services/polls.js';

export const command = {
  name: 'score',
  description: 'View quiz scores or reset them',
  type: 1,
  options: [
    {
      name: 'action',
      description: 'Optional score action',
      type: 3,
      required: false,
      choices: [{ name: 'reset', value: 'reset' }],
    },
  ],
};

function response(content) {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      flags: InteractionResponseFlags.EPHEMERAL,
    },
  };
}

function getAction(req) {
  return req.body.data.options?.find((option) => option.name === 'action')?.value;
}

export function handleCommand(req) {
  const action = getAction(req);

  if (action !== undefined && action !== 'reset') {
    return response('Invalid score action.');
  }

  if (action === 'reset') {
    if (!isAuthorizedUser(req)) {
      return response('You are not authorized to reset quiz scores.');
    }

    resetScores();
    return response('All quiz scores were reset.');
  }

  const invokingUser = getInvokingUser(req);

  if (isAuthorizedUser(req)) {
    const topScores = getTopScores();
    return response(topScores.length === 0
      ? 'No quiz scores have been recorded.'
      : [
        'Top quiz scores:',
        ...topScores.map((user, index) => (
          `${index + 1}. ${user.username}: ${user.score} `
          + `(${user.correct} correct, ${user.incorrect} incorrect)`
        )),
      ].join('\n'));
  }

  const score = getUserScoreRecord(invokingUser.userId);
  return response(
    `${invokingUser.username || 'Your'} score: ${score.score} `
    + `(${score.correct} correct, ${score.incorrect} incorrect)`,
  );
}
