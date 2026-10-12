const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createZombies, movePlayer, attackZombie, updateZombies, createDungeonSimulation, ZOMBIE_RESPAWN_DELAY } = require("../client/dungeon");

const player = { id: "player", x: 400, y: 400, w: 64, h: 64, spriteState: 1 };
const zombie = (id, x, y) => ({ id, x, y, w: 64, h: 64, speed: 72, spriteState: 3 });

test("player movement covers the same distance at 30, 60, 144, and 240 fps", () => {
	for (const fps of [30, 60, 144, 240]) {
		const moving = { ...player, x: 100, speed: 5 };
		for (let frame = 0; frame < fps; frame++) movePlayer(moving, { d: true }, 1 / fps);
		assert.ok(Math.abs(moving.x - 400) < 1e-8, `Incorrect distance at ${fps} fps`);
		assert.equal(moving.y, player.y);
		assert.equal(moving.spriteState, 2);
	}
});

test("diagonal movement stays at the same speed and opposing keys cancel", () => {
	const diagonal = { ...player, x: 100, y: 100, speed: 5 };
	for (let frame = 0; frame < 60; frame++) movePlayer(diagonal, { d: true, s: true }, 1 / 60);
	assert.ok(Math.abs(Math.hypot(diagonal.x - 100, diagonal.y - 100) - 300) < 1e-8);
	const before = { ...diagonal };
	movePlayer(diagonal, { w: true, a: true, s: true, d: true }, 0.1);
	assert.deepEqual(diagonal, before);
});

test("movement keeps the entire player inside the world and caps long frame stalls", () => {
	const moving = { ...player, x: 930, y: 730, speed: 5 };
	movePlayer(moving, { d: true, s: true }, 0.1);
	assert.equal(moving.x, 936);
	assert.equal(moving.y, 736);
	moving.x = 100;
	movePlayer(moving, { d: true }, 10);
	assert.equal(moving.x, 130);
	movePlayer(moving, { d: true }, -1);
	assert.equal(moving.x, 130);
});

test("each dungeon starts with three independent zombies", () => {
	const first = createZombies();
	const second = createZombies();
	assert.equal(first.length, 3);
	assert.equal(new Set(first.map((enemy) => enemy.id)).size, 3);
	first[0].x = -1;
	assert.ok(second[0].x >= 0);
});

for (const [direction, x, y] of [[1, 400, 273], [2, 591, 400], [3, 400, 591], [4, 273, 400]]) {
	test(`attacks reach two tiles in facing direction ${direction}`, () => {
		const enemies = [zombie("target", x, y)];
		assert.equal(attackZombie(enemies, { ...player, spriteState: direction }), "target");
		assert.equal(enemies.length, 0);
	});
}

test("attacks miss zombies behind, beside, and beyond their range", () => {
	const enemies = [zombie("behind", 400, 480), zombie("beside", 464, 300), zombie("far", 400, 208)];
	assert.equal(attackZombie(enemies, player), null);
	assert.equal(enemies.length, 3);
	assert.equal(attackZombie(enemies, { ...player, spriteState: 99 }), null);
});

test("a strike kills only the nearest zombie", () => {
	const enemies = [zombie("far", 400, 280), zombie("near", 400, 330)];
	assert.equal(attackZombie(enemies, player), "near");
	assert.deepEqual(enemies.map((enemy) => enemy.id), ["far"]);
});

test("zombies pursue the nearest player at their server speed", () => {
	const enemy = zombie("chaser", 100, 100);
	const room = { enemies: [enemy], players: {
		far: { ...player, id: "far", x: 800, y: 800 },
		near: { ...player, id: "near", x: 300, y: 100 },
	} };
	assert.equal(updateZombies(room, 0.5).size, 0);
	assert.equal(enemy.x, 136);
	assert.equal(enemy.y, 100);
	assert.equal(enemy.spriteState, 2);
});

test("zombie contact reports every touched player and empty rooms stay still", () => {
	const enemy = zombie("chaser", 400, 400);
	const room = { enemies: [enemy], players: { one: { ...player, id: "one" }, two: { ...player, id: "two", x: 410 } } };
	assert.deepEqual([...updateZombies(room, 0.05)].sort(), ["one", "two"]);
	room.players = {};
	const before = { ...enemy };
	assert.equal(updateZombies(room, 1).size, 0);
	assert.deepEqual(enemy, before);
});

test("the shared simulation respawns each zombie after its own three-second deadline", () => {
	const room = { players: {}, enemies: [] };
	const simulation = createDungeonSimulation(room);
	simulation.reset();
	assert.equal(simulation.attack({ ...player, x: 66, y: 160, spriteState: 2 }, 1000), "zombie-1");
	assert.equal(simulation.attack({ ...player, x: 356, y: 240, spriteState: 2 }, 1500), "zombie-2");
	simulation.update(0.05, 1000 + ZOMBIE_RESPAWN_DELAY - 1);
	assert.equal(room.enemies.length, 1);
	simulation.update(0.05, 1000 + ZOMBIE_RESPAWN_DELAY);
	assert.equal(room.enemies.length, 2);
	assert.equal(room.enemies.find((enemy) => enemy.id === "zombie-1").x, 160);
	simulation.update(0.05, 1500 + ZOMBIE_RESPAWN_DELAY);
	assert.equal(room.enemies.length, 3);
	simulation.update(0.05, 10000);
	assert.equal(room.enemies.length, 3);
});

test("resetting the shared simulation cancels old respawns", () => {
	const room = { players: {}, enemies: [] };
	const simulation = createDungeonSimulation(room);
	simulation.reset();
	simulation.attack({ ...player, x: 66, y: 160, spriteState: 2 }, 0);
	simulation.reset();
	simulation.update(0.05, 10000);
	assert.equal(room.enemies.length, 3);
	assert.equal(new Set(room.enemies.map((enemy) => enemy.id)).size, 3);
});

test("the same dungeon file runs identically as a Node module and browser script", () => {
	const browser = {};
	vm.runInNewContext(fs.readFileSync(require.resolve("../client/dungeon"), "utf8"), browser);
	const nodeApi = require("../client/dungeon");
	assert.deepEqual(Object.keys(browser.Dungeon).sort(), Object.keys(nodeApi).sort());
	function play(api) {
		const localPlayer = { ...player, x: 66, y: 160, spriteState: 2 };
		const room = { enemies: [], players: { player: localPlayer } };
		const simulation = api.createDungeonSimulation(room);
		simulation.reset();
		const killed = simulation.attack(localPlayer, 0);
		const hits = [...simulation.update(0.05, 3000)];
		return JSON.parse(JSON.stringify({ killed, hits, enemies: room.enemies }));
	}
	assert.deepEqual(play(browser.Dungeon), play(nodeApi));
});

test("shared room definitions create isolated online and offline worlds", () => {
	const { createRooms } = require("../client/world");
	const online = createRooms();
	const offline = createRooms();
	online.lobby.players.player = player;
	assert.deepEqual(offline.lobby.players, {});
	assert.equal(offline.dungeon.backgroundImage, "sprites/dungeonBackground.png");
});
