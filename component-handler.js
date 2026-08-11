import {
  COLD_CALL_COMPONENT_PREFIX,
  handleComponent as handleColdcallComponent,
} from './commands/coldcall.js';
import {
  CREDIT_COMPONENT_PREFIX,
  CREDIT_PAGE_COMPONENT_PREFIX,
  handleComponent as handleCreditComponent,
  handlePageComponent as handleCreditPageComponent,
} from './commands/credit.js';
import {
  handleComponent as handleSetSectionComponent,
  SET_SECTION_COMPONENT_ID,
} from './commands/setsection.js';
import {
  handleOpenComponent as handlePollOpenComponent,
  handleVoteComponent as handlePollVoteComponent,
  POLL_OPEN_COMPONENT_PREFIX,
  POLL_VOTE_COMPONENT_PREFIX,
} from './commands/poll.js';

const componentHandlers = {
  [COLD_CALL_COMPONENT_PREFIX]: handleColdcallComponent,
  [CREDIT_COMPONENT_PREFIX]: handleCreditComponent,
  [CREDIT_PAGE_COMPONENT_PREFIX]: handleCreditPageComponent,
  [SET_SECTION_COMPONENT_ID]: (_componentId, req) => handleSetSectionComponent(req),
  [POLL_OPEN_COMPONENT_PREFIX]: handlePollOpenComponent,
  [POLL_VOTE_COMPONENT_PREFIX]: handlePollVoteComponent,
};

export function handleComponent(req, res) {
  const componentId = req.body.data.custom_id;
  const handlerKey = Object.keys(componentHandlers)
    .find((key) => componentId.startsWith(key));
  const componentHandler = componentHandlers[handlerKey];

  if (componentHandler) {
    return res.send(componentHandler(componentId, req));
  }

  console.error(`Unknown component: ${componentId}`);
  return res.status(400).json({ error: 'Unknown component' });
}
