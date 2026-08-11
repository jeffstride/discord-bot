const DISCORD_API_BASE = 'https://discord.com/api/v10';

/**
 * Makes an authenticated request to Discord's HTTP API using the bot token.
 * Used for one-off setup tasks like registering slash commands.
 * Node 18+ has `fetch` built in globally, so no extra HTTP library is needed.
 *
 * @param {string} endpoint - path relative to DISCORD_API_BASE, e.g. "applications/123/commands"
 * @param {object} options - fetch options (method, body, etc). body is auto-JSON-encoded if it's an object.
 */
export async function DiscordRequest(endpoint, options = {}) {
  const url = `${DISCORD_API_BASE}/${endpoint}`;

  if (options.body) {
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API error ${response.status}: ${text}`);
  }

  return response;
}
