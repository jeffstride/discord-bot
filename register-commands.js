// Run with `npm run register` any time you add or change a command in
// commands.js. This is a separate, one-time step from running the server --
// this script only tells Discord which commands exist; app.js is what
// answers them when a user actually runs one.

import 'dotenv/config';
import { DiscordRequest } from './utils.js';
import { ALL_COMMANDS } from './commands.js';

async function registerGlobalCommands() {
  const appId = process.env.DISCORD_APPLICATION_ID;

  if (!appId) {
    throw new Error('Missing DISCORD_APPLICATION_ID in .env');
  }

  try {
    // PUT bulk-overwrites ALL global commands with this list -- simplest way
    // to keep Discord in sync with commands.js as you add more commands.
    await DiscordRequest(`applications/${appId}/commands`, {
      method: 'PUT',
      body: ALL_COMMANDS,
    });
    console.log(
      `Registered ${ALL_COMMANDS.length} command(s): ${ALL_COMMANDS.map((c) => c.name).join(', ')}`
    );
    console.log(
      'Note: global commands can take up to an hour to appear the first time.'
    );
  } catch (err) {
    console.error('Failed to register commands:', err.message);
    process.exitCode = 1;
  }
}

registerGlobalCommands();
