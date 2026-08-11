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
  verifyKeyMiddleware,
} = require('discord-interactions');
const { handleCommand } = require('./command-handler');
const { loadAndScheduleReminders } = require('./reminder-delivery');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

loadAndScheduleReminders();

app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), async (req, res) => {
  const { type } = req.body;

  if (type === InteractionType.APPLICATION_COMMAND) {
    return handleCommand(req, res);
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
