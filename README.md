# Discord Bot Starter (JavaScript)

A minimal Discord bot built with **Express** and Discord's **HTTP
Interactions** model, developed in **VS Code connected to a GitHub
Codespace**. This mirrors [Discord's official quick-start
guide](https://docs.discord.com/developers/quick-start/getting-started),
but swaps their local-machine + ngrok setup for a Codespace, since that's
what you'll eventually use for the class project.

## The mental model, in plain terms

- **Discord's servers** are where a person types `/hello` in a channel.
- Discord doesn't run your code for you -- it sends an **HTTP request** to a
  URL you provide, and waits for your code to respond. This is different
  from bots you may have seen elsewhere that stay constantly connected over
  a websocket (the "gateway" model) -- this one is request/response, like a
  tiny web API.
- That means your bot **only works while your server is running and its URL
  is reachable**. If you stop the app or close the Codespace, `/hello` will
  fail until you start it again.
- **discord-interactions** (the npm package this project uses) handles the
  security handshake for you: verifying that a request really came from
  Discord, and answering Discord's periodic "are you alive?" (`PING`) check.

## What's in this repo

| File | Purpose |
|---|---|
| `app.js` | The Express server that receives and answers Discord interactions |
| `commands.js` | Defines what slash commands exist (just `/hello` to start) |
| `register-commands.js` | One-time script that tells Discord about the commands in `commands.js` |
| `utils.js` | Small helper for calling Discord's API with your bot token |
| `.devcontainer/devcontainer.json` | Tells Codespaces what to install and which port to expose |
| `.vscode/launch.json` | Lets you press **F5** in VS Code to run the bot with the debugger attached |

## Setup

### 1. Create a Discord Application
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**, give it a name.
2. On **General Information**, note the **Application ID** and **Public Key**. Keep these in some text file for a bit. In step #3 below, you'll create and paste these into `.env`.
> **If your repo is public:** don't type real secrets into `.env` before pushing anything. Create the Codespace first, then create/edit `.env` inside it. It's already git-ignored, but it's safer not to have typed secrets into any file until you're inside the Codespace.
3. Go to **Bot** (left sidebar) → **Reset Token** → copy it immediately -- Discord won't show it to you again.
4. Go to **Installation** (left sidebar):
   - Under **Installation Contexts**, leave both **User Install** and **Guild Install** checked.
   - Under **Default Install Settings**, add scope `applications.commands` for both, and also add scope `bot` for Guild Install. When `bot` appears, also check the **Send Messages** permission.
5. Copy the **Install Link** shown on that page. Paste it into your browser, hit enter, and choose **Add to Server** to install the bot to your personal test server (create one first if you don't have one: Discord's server list `+` button → **Create My Own**).

### 2. Open this repo in a Codespace, from VS Code
1. Push this repo to GitHub (or open it from wherever your class template lives).
2. In VS Code, install the **GitHub Codespaces** extension if you don't have it.
3. Command Palette (`Cmd/Ctrl+Shift+P`) → **Codespaces: Create New Codespace** → pick this repo/branch. VS Code will connect to it like a remote window; `npm install` runs automatically via `devcontainer.json`.

### 3. Configure your secrets  
You can manually create and copy the contents over, or you can use the command line to copy the contents of `.env.example`. 
```bash
# Copy the .env.example file to the .env file
cp .env.example .env
```
Then open `.env` and paste in your Application ID, Public Key, and Bot Token.  
> `Dotenv Official + Vault` is an extension that my applied in Codespaces. This will hide your *secrets* in the `.env` file. To disable it, take note of the small grey text at the top: "Toggle auto-cloaking".  

### 4. Register your slash command
```bash
npm run register
```
You should see `Registered 1 command(s): hello`. Global commands can take up to an hour to show up the first time — see the note in `register-commands.js` if you want a faster, test-server-only alternative.

### 5. Run the bot
```bash
npm start
```
Or press **F5** in VS Code to run it with the debugger attached (breakpoints will work).

### 6. Make the port reachable and copy the URL
If you're using GitHub Codespaces, open the **Ports** tab at the bottom of VS Code. Port `3000` should already be listed and set to **Public** by `.devcontainer/devcontainer.json`. If it still shows **Private**, right-click it → **Port Visibility → Public**.

If you're using a local Dev Container instead of Codespaces, the forwarded port cannot be made public from the dev container itself. In that case, use a public tunnel such as **ngrok** or **Cloudflare Tunnel**, then paste that public URL into Discord. Copy the forwarded address, which looks like:
```
https://your-codespace-name-3000.app.github.dev
```

### 7. Tell Discord where to send interactions
Back in the Developer Portal, on **General Information**, paste your URL **followed by `/interactions`** into the **Interactions Endpoint URL** field:
```
https://your-codespace-name-3000.app.github.dev/interactions
```
Click **Save Changes**. Discord immediately sends a test `PING` — if `app.js` is running, this succeeds automatically (handled by `verifyKeyMiddleware`). If it fails, confirm the app is running and the port is public, then try saving again.

### 8. Test it
In your Discord test server, type `/hello`. The bot should reply "Hello from your Codespaces-hosted bot! 👋".

## Adding your own commands
1. Add a new command object to `ALL_COMMANDS` in `commands.js`, then re-run `npm run register`.
2. Add a matching `if (name === '...')` branch inside the `/interactions` handler in `app.js`.
3. Restart the server (or just let `npm run dev` auto-restart it on save).

## Troubleshooting
- **Interactions Endpoint URL won't save** → the app isn't running, or the port isn't public. Check both.
- **401 / invalid signature errors** → double-check `DISCORD_PUBLIC_KEY` in `.env` matches the Developer Portal exactly, and make sure no other middleware (like `express.json()`) runs before `verifyKeyMiddleware` on the `/interactions` route.
- **Command doesn't show up in Discord** → global commands can take up to an hour on first registration; register to a single guild for near-instant testing (see the commented note in `register-commands.js`).
- **Bot stopped responding after a while** → your Codespace probably went idle/stopped. Reopen it and run `npm start` again.

## Next steps for learning more
- [Discord's official quick-start](https://docs.discord.com/developers/quick-start/getting-started) extends this exact pattern into a full rock-paper-scissors game with buttons and select menus -- good next step once `/hello` is working.
- [Interactions Overview docs](https://docs.discord.com/developers/interactions/overview) explain the security model in more depth.
- [discord-interactions-js on GitHub](https://github.com/discord/discord-interactions-js) has more usage examples.
