import {
  COLD_CALL_COMPONENT_PREFIX,
  handleComponent as handleColdcallComponent,
} from './commands/coldcall.js';

const componentHandlers = {
  [COLD_CALL_COMPONENT_PREFIX]: handleColdcallComponent,
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
