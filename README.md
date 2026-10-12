This is (or is going to be) a small multiplayer game.

It is a proof of concept using socket.io hosted on a nodejs server.

## Play locally

Run `npm ci`, then `npm start`, and open http://localhost:5767.
Enter a display name to join. Names are remembered in your browser; no account or password is needed.
Players can share a name and are identified separately for each connection.

If the multiplayer server cannot be reached for 20 seconds, the game shows "Using offline mode" and switches to solo play. A name submitted while connecting joins automatically when either mode becomes ready. Offline play includes dungeon zombies, attacks, and respawns; refresh to try multiplayer again.

You can also open `client/index.html` directly or serve the `client` folder as a static archive. Its scripts, room data, and sprites are local. The server and browser both load `client/dungeon.js` for dungeon rules and `client/world.js` for room definitions.

Move with WASD, arrow keys, or the on-screen touch controls. Press L to return to the lobby.
The dungeon has three green zombies that chase players. Contact sends you back to the lobby.
Press F to kill the closest zombie within two player tiles ahead of your facing direction.
Zombie movement, hits, kills, and respawns are shared through the server. Killed zombies respawn after three seconds at their starting positions. Entering an empty dungeon starts a fresh set of three.
Use `PORT=5768 npm start` to choose another port, `npm run dev` while editing, and `npm test` for multiplayer regression tests.

The old `data/accounts.json` file is unused and is never served to players. It is not needed to run or deploy the game.

EDITING:
When you edit this repository, please thoroughly, THOROUGHLY, test it for errors. Then, send me the updated code so I can test it and maybe push it to the repo.

Thanks to OrTheSnowJames, who helped a lot with this.
