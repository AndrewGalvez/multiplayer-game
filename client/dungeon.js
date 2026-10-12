(function (root) {
const TILE_SIZE = 64;
const WORLD_WIDTH = 1000;
const WORLD_HEIGHT = 800;

function createZombies() {
	return [{ x: 160, y: 160 }, { x: 450, y: 240 }, { x: 760, y: 160 }].map((position, index) => ({
		...position,
		id: `zombie-${index + 1}`,
		w: TILE_SIZE,
		h: TILE_SIZE,
		speed: 72,
		spriteState: 3,
	}));
}

function intersects(first, second) {
	return first.x < second.x + second.w && first.x + first.w > second.x &&
		first.y < second.y + second.h && first.y + first.h > second.y;
}

function movePlayer(player, keys, seconds) {
	if (!Number.isFinite(seconds) || seconds <= 0) return;
	const horizontal = Number(Boolean(keys.d)) - Number(Boolean(keys.a));
	const vertical = Number(Boolean(keys.s)) - Number(Boolean(keys.w));
	const length = Math.hypot(horizontal, vertical);
	if (!length) return;
	// Preserve the original speed value's 60 Hz baseline.
	const distance = player.speed * 60 * Math.min(seconds, 0.1);
	player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x + horizontal / length * distance));
	player.y = Math.max(0, Math.min(WORLD_HEIGHT - player.h, player.y + vertical / length * distance));
	player.spriteState = horizontal > 0 ? 2 : vertical > 0 ? 3 : horizontal < 0 ? 4 : 1;
}

function attackArea(player) {
	const range = TILE_SIZE * 2;
	switch (player.spriteState) {
		case 1: return { x: player.x, y: player.y - range, w: player.w, h: range };
		case 2: return { x: player.x + player.w, y: player.y, w: range, h: player.h };
		case 3: return { x: player.x, y: player.y + player.h, w: player.w, h: range };
		case 4: return { x: player.x - range, y: player.y, w: range, h: player.h };
		default: return null;
	}
}

function attackZombie(enemies, player) {
	const area = attackArea(player);
	if (!area) return null;
	const targets = enemies.filter((enemy) => intersects(area, enemy));
	targets.sort((first, second) => Math.hypot(first.x - player.x, first.y - player.y) - Math.hypot(second.x - player.x, second.y - player.y));
	const target = targets[0];
	if (!target) return null;
	enemies.splice(enemies.indexOf(target), 1);
	return target.id;
}

function updateZombies(room, seconds) {
	const players = Object.values(room.players);
	const hitPlayers = new Set();
	if (!players.length) return hitPlayers;
	for (const enemy of room.enemies) {
		const target = players.reduce((closest, player) => {
			return Math.hypot(player.x - enemy.x, player.y - enemy.y) < Math.hypot(closest.x - enemy.x, closest.y - enemy.y) ? player : closest;
		});
		const dx = target.x - enemy.x;
		const dy = target.y - enemy.y;
		const distance = Math.hypot(dx, dy);
		if (distance) {
			const step = Math.min(enemy.speed * seconds, distance);
			enemy.x = Math.max(0, Math.min(WORLD_WIDTH - enemy.w, enemy.x + dx / distance * step));
			enemy.y = Math.max(0, Math.min(WORLD_HEIGHT - enemy.h, enemy.y + dy / distance * step));
			enemy.spriteState = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : (dy > 0 ? 3 : 1);
		}
		for (const player of players) {
			if (intersects(enemy, player)) hitPlayers.add(player.id);
		}
	}
	return hitPlayers;
}


const ZOMBIE_RESPAWN_DELAY = 3000;
const ATTACK_COOLDOWN = 250;

function createDungeonSimulation(room) {
	const respawns = new Map();
	return {
		reset() {
			respawns.clear();
			room.enemies = createZombies();
		},
		attack(player, now = Date.now()) {
			const killedId = attackZombie(room.enemies, player);
			if (killedId) respawns.set(killedId, now + ZOMBIE_RESPAWN_DELAY);
			return killedId;
		},
		update(seconds, now = Date.now()) {
			const hitPlayers = updateZombies(room, seconds);
			for (const [id, deadline] of respawns) {
				if (now < deadline) continue;
				respawns.delete(id);
				room.enemies.push(createZombies().find((enemy) => enemy.id === id));
			}
			return hitPlayers;
		},
	};
}

const api = { createZombies, intersects, movePlayer, attackArea, attackZombie, updateZombies, createDungeonSimulation, WORLD_WIDTH, WORLD_HEIGHT, ZOMBIE_RESPAWN_DELAY, ATTACK_COOLDOWN };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.Dungeon = api;
})(globalThis);
