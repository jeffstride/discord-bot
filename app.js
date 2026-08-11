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

import 'dotenv/config';
import express from 'express';
import {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { handleCommand } from './command-handler.js';
import { handleComponent } from './component-handler.js';
import { loadAndScheduleReminders } from './services/reminders.js';

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

// The Reminders feature needs intialization
loadAndScheduleReminders();

// Handy for confirming the app is up when you visit the forwarded Codespaces
// URL in a browser (Discord never hits this route -- it only calls /interactions).
app.get('/', (req, res) => {
  res.send('Discord bot is running. Use /interactions for Discord callbacks.');
});

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 * Parse request body and verifies incoming requests using discord-interactions package
 */
app.post('/interactions', verifyKeyMiddleware(PUBLIC_KEY), async function (req, res) {
  // Discord uses the interaction type to distinguish pings, slash commands,
  // component clicks, modal submissions, and other interaction payloads.
  const { type } = req.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    return handleCommand(req, res);
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    return handleComponent(req, res);
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
