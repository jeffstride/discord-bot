import {
  COLD_CALL_COMPONENT_PREFIX,
  handleComponent as handleColdcallComponent,
} from './commands/coldcall.js';
import {
  CREDIT_COMPONENT_ID,
  handleComponent as handleCreditComponent,
} from './commands/credit.js';

const componentHandlers = {
  [COLD_CALL_COMPONENT_PREFIX]: handleColdcallComponent,
  [CREDIT_COMPONENT_ID]: (_componentId, req) => handleCreditComponent(req),
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
