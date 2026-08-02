// Minimal Discord bot using HTTP Interactions (not the gateway/websocket
// model). Discord sends an HTTP POST to this app every time a user runs a
// slash command in a server (or DM) where the bot is installed.
//
// verifyKeyMiddleware (from discord-interactions) does two things for us on
// every request to /interactions:
//   1. Verifies the request really came from Discord (Ed25519 signature check)
//   2. Automatically answers Discord's "PING" check with a "PONG"
// If a request passes both, it calls next() with req.body already parsed as JSON.
//
// IMPORTANT: don't put express.json() (or any other body-parsing middleware)
// in front of the /interactions route -- verifyKeyMiddleware needs the raw,
// untouched request body to check the signature correctly.

require('dotenv').config();
const express = require('express');
const {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} = require('discord-interactions');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), (req, res) => {
  const { type, data } = req.body;

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'hello') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: 'Hello from your Codespaces-hosted bot! 👋' },
      });
    }

    // Unknown command name -- shouldn't normally happen if
    // register-commands.js is the only thing registering commands.
    console.error(`Unrecognized command: ${name}`);
    return res.status(400).send({ error: 'Unknown command' });
  }

  console.error('Unhandled interaction type:', type);
  return res.status(400).send({ error: 'Unknown interaction type' });
});

// Handy for confirming the app is up when you visit the forwarded Codespaces
// URL in a browser (Discord never hits this route -- it only calls /interactions).
app.get('/', (req, res) => {
  res.send('Bot is running. POST /interactions is the Discord endpoint.');
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
