import {
  handleModalSubmit as handlePollModalSubmit,
  POLL_CREATE_MODAL_PREFIX,
} from './commands/poll.js';

const modalHandlers = {
  [POLL_CREATE_MODAL_PREFIX]: handlePollModalSubmit,
};

export function handleModalSubmit(req, res) {
  const modalId = req.body.data.custom_id;
  const handlerKey = Object.keys(modalHandlers)
    .find((key) => modalId.startsWith(key));
  const modalHandler = modalHandlers[handlerKey];

  if (modalHandler) {
    return res.send(modalHandler(modalId, req));
  }

  console.error(`Unknown modal: ${modalId}`);
  return res.status(400).json({ error: 'Unknown modal' });
}
