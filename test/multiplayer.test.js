const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");
const { io } = require("socket.io-client");

let server;
let url;

before(async () => {
	server = spawn(process.execPath, [path.join(__dirname, "../app.js")], {
		env: { ...process.env, PORT: "0" },
		stdio: ["ignore", "pipe", "pipe"],
	});
	url = await new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Server did not start")), 5000);
		let output = "";
		server.stdout.on("data", (chunk) => {
			output += chunk;
			const match = output.match(/http:\/\/localhost:\d+/);
			if (match) {
				clearTimeout(timer);
				resolve(match[0]);
			}
		});
		server.once("error", (error) => { clearTimeout(timer); reject(error); });
		server.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
	});
});

after(async () => {
	if (server && server.exitCode === null) {
		const exited = once(server, "exit");
		server.kill();
		await exited;
	}
});

function nextEvent(socket, event, trigger, matches = () => true, timeoutMs = 3000) {
	return new Promise((resolve, reject) => {
		const handler = (data) => {
			if (!matches(data)) return;
			socket.off(event, handler);
			clearTimeout(timer);
			resolve(data);
		};
		const timer = setTimeout(() => {
			socket.off(event, handler);
			reject(new Error(`Timed out waiting for ${event}`));
		}, timeoutMs);
		socket.on(event, handler);
		trigger?.();
	});
}

async function connect(t) {
	const socket = io(url, { autoConnect: false, reconnection: false, transports: ["websocket"] });
	t.after(() => socket.disconnect());
	await nextEvent(socket, "connect", () => socket.connect());
	return socket;
}

function join(socket, name) {
	return nextEvent(socket, "currentGame", () => socket.emit("joinGame", { name }));
}

test("joining requires a valid name and no account", async (t) => {
	const socket = await connect(t);
	for (const data of [null, {}, { name: 123 }, { name: "   " }, { name: "x".repeat(21) }, { name: "bad\u0000name" }, { name: "bad\u202ename" }]) {
		const error = await nextEvent(socket, "joinError", () => socket.emit("joinGame", data));
		assert.match(error, /1 and 20/);
	}
	const game = await join(socket, "  First   Player  ");
	assert.equal(game.players[socket.id].name, "First Player");
	assert.equal(game.roomName, "lobby");
	assert.ok(game.players[socket.id].x >= 0);
	assert.ok(game.players[socket.id].x + 64 <= 1000);
	assert.ok(game.players[socket.id].y + 64 <= 800);
	const repeated = await join(socket, "A different name");
	assert.equal(repeated.players[socket.id].name, "First Player");
});

test("names can be shared, chat uses the joined name, and disconnect removes only that player", async (t) => {
	const first = await connect(t);
	const second = await connect(t);
	await join(first, "Same name");
	const arriving = nextEvent(first, "newPlayer");
	const game = await join(second, "Same name");
	assert.equal((await arriving).id, second.id);
	assert.notEqual(first.id, second.id);
	assert.equal(game.players[first.id].name, "Same name");
	assert.equal(game.players[second.id].name, "Same name");
	const chat = await nextEvent(second, "playerMessage", () => first.emit("message", { name: "Impersonated", msg: " hello " }), (data) => data.msg === "hello");
	assert.deepEqual(chat, { name: "Same name", msg: "hello" });
	const moved = await nextEvent(second, "playerMoved", () => first.emit("move", { x: 300, y: 400 }));
	assert.deepEqual(moved, { id: first.id, x: 300, y: 400 });
	const oldId = first.id;
	assert.equal(await nextEvent(second, "playerDisconnect", () => first.disconnect()), oldId);
	const remaining = await join(second, "Same name");
	assert.equal(remaining.players[oldId], undefined);
	assert.ok(remaining.players[second.id]);
	await nextEvent(first, "connect", () => first.connect());
	assert.notEqual(first.id, oldId);
	assert.equal((await join(first, "Same name")).players[first.id].name, "Same name");
});

test("unjoined and malformed events cannot add a player or broadcast chat", async (t) => {
	const player = await connect(t);
	const visitor = await connect(t);
	await join(player, "Observer");
	const messages = [];
	player.on("playerMessage", (message) => messages.push(message));
	visitor.emit("joinRoom", { r: "lobby", username: "Bypass" });
	visitor.emit("message", { name: "Bypass", msg: "Should not arrive" });
	visitor.emit("move", { x: 1, y: 2 });
	visitor.emit("newSprite", 2);
	visitor.emit("login", { username: "Old login", password: "unused" });
	visitor.emit("createAccount", { username: "Old account", password: "unused" });
	for (const event of ["joinRoom", "message", "move", "newSprite", "attack"]) player.emit(event, null);
	player.emit("joinRoom", { r: "__proto__" });
	// A response on the visitor's socket confirms its preceding events were processed.
	await nextEvent(visitor, "joinError", () => visitor.emit("joinGame", {}));
	const state = await join(player, "Observer");
	assert.equal(state.players[visitor.id], undefined);
	assert.deepEqual(messages.filter((message) => message.name !== "Server"), []);
});

test("room changes retain the display name and use the configured doorway", async (t) => {
	const player = await connect(t);
	const observer = await connect(t);
	await join(player, "Explorer");
	await join(observer, "Observer");
	const departure = nextEvent(observer, "playerDisconnect");
	const dungeon = await nextEvent(player, "currentGame", () => player.emit("joinRoom", {
		r: "dungeon", username: "Wrong name", d: { newPos: { x: -999, y: -999 } },
	}));
	assert.equal(await departure, player.id);
	assert.equal(dungeon.roomName, "dungeon");
	assert.equal(dungeon.players[player.id].name, "Explorer");
	assert.equal(dungeon.players[player.id].x, 450);
	assert.equal(dungeon.players[player.id].y, 675);
	const arrival = nextEvent(observer, "newPlayer");
	const lobby = await nextEvent(player, "currentGame", () => player.emit("joinRoom", { r: "lobby" }));
	assert.equal((await arrival).obj.name, "Explorer");
	assert.equal(lobby.roomName, "lobby");
	assert.equal(lobby.players[player.id].name, "Explorer");
	assert.equal(lobby.players[player.id].y, 51);
});

test("the start screen and assets are served without exposing account data", async () => {
	const response = await fetch(url);
	assert.equal(response.status, 200);
	const html = await response.text();
	assert.match(html, /id="join-form"/);
	assert.doesNotMatch(html, /type="password"/);
	for (const asset of ["/client/style.css", "/client/script.js", "/client/dungeon.js", "/client/world.js", "/client/socket.io.min.js", "/client/sprites/player.png", "/client/icons/arrow-right.svg"]) {
		assert.equal((await fetch(url + asset)).status, 200);
	}
	assert.equal((await fetch(url + "/data/accounts.json")).status, 404);
});

async function enterDungeon(socket, name) {
	await join(socket, name);
	return nextEvent(socket, "currentGame", () => socket.emit("joinRoom", { r: "dungeon" }));
}

test("two dungeon players receive identical zombie movement, kills, and respawns", async (t) => {
	const first = await connect(t);
	const second = await connect(t);
	const initial = await enterDungeon(first, "Hunter");
	await enterDungeon(second, "Witness");
	assert.equal(initial.enemies.length, 3);
	const [firstFrame, secondFrame] = await Promise.all([
		nextEvent(first, "zombiesUpdated"), nextEvent(second, "zombiesUpdated"),
	]);
	assert.deepEqual(firstFrame, secondFrame);
	assert.ok(firstFrame.some((enemy, index) => enemy.x !== initial.enemies[index].x || enemy.y !== initial.enemies[index].y));
	const target = firstFrame[0];
	const firstKill = nextEvent(first, "playerAttacked");
	const secondKill = nextEvent(second, "playerAttacked");
	const firstEnemies = nextEvent(first, "zombiesUpdated", null, (enemies) => enemies.length === 2);
	const secondEnemies = nextEvent(second, "zombiesUpdated", null, (enemies) => enemies.length === 2);
	first.emit("move", { x: target.x - 94, y: target.y, roomName: "dungeon" });
	first.emit("newSprite", 2);
	first.emit("attack", { killedId: "zombie-3", spriteState: 4 });
	const kill = await firstKill;
	assert.equal(kill.killedId, target.id);
	assert.deepEqual(await secondKill, kill);
	assert.deepEqual(await firstEnemies, await secondEnemies);
	const current = await join(first, "Hunter");
	assert.equal(current.enemies.length, 2);
	assert.ok(current.enemies.every((enemy) => enemy.id !== target.id));
	first.emit("move", { x: 900, y: 675, roomName: "dungeon" });
	const [firstRespawn, secondRespawn] = await Promise.all([
		nextEvent(first, "zombiesUpdated", null, (enemies) => enemies.length === 3, 6000),
		nextEvent(second, "zombiesUpdated", null, (enemies) => enemies.length === 3, 6000),
	]);
	assert.deepEqual(firstRespawn, secondRespawn);
	assert.equal(new Set(firstRespawn.map((enemy) => enemy.id)).size, 3);
	const respawned = firstRespawn.find((enemy) => enemy.id === target.id);
	assert.equal(respawned.x, 160);
	assert.equal(respawned.y, 160);
});

test("contact returns only the touched player to the lobby and rejects stale dungeon movement", async (t) => {
	const player = await connect(t);
	const witness = await connect(t);
	await enterDungeon(player, "Touched");
	await enterDungeon(witness, "Safe");
	const enemies = await nextEvent(player, "zombiesUpdated");
	const removed = nextEvent(witness, "playerDisconnect");
	const lobby = await nextEvent(player, "currentGame", () => player.emit("move", {
		x: enemies[0].x, y: enemies[0].y, roomName: "dungeon",
	}));
	assert.equal(await removed, player.id);
	assert.equal(lobby.roomName, "lobby");
	assert.equal(lobby.players[player.id].name, "Touched");
	assert.equal(lobby.players[player.id].x, 450);
	assert.equal(lobby.players[player.id].y, 51);
	player.emit("move", { x: 160, y: 160, roomName: "dungeon" });
	player.emit("attack");
	const stillLobby = await join(player, "Touched");
	assert.equal(stillLobby.players[player.id].x, 450);
	assert.equal(stillLobby.players[player.id].y, 51);
	const dungeon = await join(witness, "Safe");
	assert.equal(dungeon.roomName, "dungeon");
	assert.equal(dungeon.players[player.id], undefined);
	assert.equal(dungeon.enemies.length, 3);
});

test("an empty dungeon resets to three zombies when the next player enters", async (t) => {
	const player = await connect(t);
	const state = await enterDungeon(player, "Returning");
	const target = state.enemies[0];
	player.emit("move", { x: target.x - 94, y: target.y, roomName: "dungeon" });
	player.emit("newSprite", 2);
	await nextEvent(player, "zombiesUpdated", () => player.emit("attack"), (enemies) => enemies.length === 2);
	await nextEvent(player, "currentGame", () => player.emit("joinRoom", { r: "lobby" }));
	const fresh = await nextEvent(player, "currentGame", () => player.emit("joinRoom", { r: "dungeon" }));
	assert.equal(fresh.enemies.length, 3);
	assert.deepEqual(fresh.enemies.map((enemy) => enemy.id), ["zombie-1", "zombie-2", "zombie-3"]);
	// The previous encounter's pending respawn must not add a fourth zombie.
	await new Promise((resolve) => setTimeout(resolve, 3200));
	const afterOldRespawn = await join(player, "Returning");
	assert.equal(afterOldRespawn.enemies.length, 3);
	assert.equal(new Set(afterOldRespawn.enemies.map((enemy) => enemy.id)).size, 3);
});
