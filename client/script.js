function sendMessage() {
	const i = document.getElementById("chatInput");
	if (offlineMode || !game?.players[playerId] || !socket?.connected || !i.value.trim()) return;
	sendGameEvent("message", { msg: i.value.trim() });
	i.value = "";
}
function checkCollision(player1, player2) {
	return Dungeon.intersects(player1, player2);
}

const backgrounds = new Map();
for (const room of Object.values(World.createRooms())) {
	const image = new Image();
	image.src = room.backgroundImage;
	backgrounds.set(room.backgroundImage, image);
}
function background() {
	ctx.clearRect(0, 0, cnv.width, cnv.height);
	if (!backgrounds.has(game.backgroundImage)) {
		const image = new Image();
		image.src = game.backgroundImage;
		backgrounds.set(game.backgroundImage, image);
	}
	const image = backgrounds.get(game.backgroundImage);
	if (image.complete && image.naturalWidth) ctx.drawImage(image, 0, 0, cnv.width, cnv.height);
}

let changingRoom = false;
function changeRoom(room, door) {
	if (!game?.players[playerId] || (!offlineMode && !socket?.connected) || changingRoom) return;
	if (room === game.roomName) return;
	if (offlineMode) {
		if (!Object.hasOwn(offlineRooms, room)) return;
		const previousRoom = offlineRooms[game.roomName];
		const doorway = previousRoom.doors.find((door) => door.to === room);
		if (!doorway && room !== "lobby") return;
		delete previousRoom.players[playerId];
		if (room === "dungeon") offlineSimulation.reset();
		if (doorway?.newPos) Object.assign(offlinePlayer, doorway.newPos);
		offlineRooms[room].players[playerId] = offlinePlayer;
		setGameState({ ...offlineRooms[room], roomName: room }, playerId);
		return;
	}
	changingRoom = true;
	sendGameEvent("joinRoom", { r: room, d: door });
}

let game;
let playerId;
let offlineMode = false;
let offlineRooms;
let offlineSimulation;
let offlinePlayer;
let connectionTimer;
let pendingName = null;
let lastJoinedName = null;
let lastOfflineAttack = 0;
let playerImage = new Image();
const zombieImage = document.createElement("canvas");
playerImage.addEventListener("load", () => {
	zombieImage.width = playerImage.naturalWidth;
	zombieImage.height = playerImage.naturalHeight;
	const zombieContext = zombieImage.getContext("2d");
	zombieContext.filter = "grayscale(1) sepia(1) hue-rotate(50deg) saturate(4)";
	zombieContext.drawImage(playerImage, 0, 0);
});
playerImage.src = "sprites/player.png";
const attacks = new Map();

function drawCharacter(character, image) {
	const sourceX = [1, 2].includes(character.spriteState) ? 64 : 0;
	const sourceY = [1, 3].includes(character.spriteState) ? 64 : 0;
	ctx.drawImage(image, sourceX, sourceY, 64, 64, character.x, character.y, character.w, character.h);
}

function attack() {
	const player = game?.players[playerId];
	if (!player || game.roomName !== "dungeon" || changingRoom || (!offlineMode && !socket?.connected)) return;
	if (offlineMode) {
		if (game.enemies.some((enemy) => Dungeon.intersects(enemy, player))) {
			changeRoom("lobby");
			return;
		}
		const now = Date.now();
		if (now - lastOfflineAttack < Dungeon.ATTACK_COOLDOWN) return;
		lastOfflineAttack = now;
		offlineSimulation.attack(player, now);
		attacks.set(playerId, { area: Dungeon.attackArea(player), until: performance.now() + 400 });
		return;
	}
	// Flush the local pose before the server evaluates the strike.
	sendGameEvent("newSprite", player.spriteState);
	sendGameEvent("move", { x: player.x, y: player.y, roomName: game.roomName });
	sendGameEvent("attack");
}
const socket = typeof io === "function" && ["http:", "https:"].includes(location.protocol)
	? io({ autoConnect: false, timeout: 5000 }) : null;
const entryScreen = document.getElementById("entry-screen");
const gameScreen = document.getElementById("game-screen");
const nameInput = document.getElementById("player-name");
const joinError = document.getElementById("join-error");
let joining = false;
let joinTimer;

function sendGameEvent(event, data) {
	if (!offlineMode && socket?.connected) socket.emit(event, data);
}

function onServerEvent(event, handler) {
	socket?.on(event, (data) => {
		if (!offlineMode) handler(data);
	});
}

function waitForServer() {
	if (offlineMode || connectionTimer) return;
	connectionTimer = setTimeout(startOfflineMode, 20000);
}

function startOfflineMode() {
	if (offlineMode) return;
	const name = pendingName || lastJoinedName;
	offlineMode = true;
	clearTimeout(connectionTimer);
	connectionTimer = null;
	socket?.disconnect();
	offlineRooms = World.createRooms();
	offlineSimulation = Dungeon.createDungeonSimulation(offlineRooms.dungeon);
	offlineSimulation.reset();
	game = null;
	keys = {};
	attacks.clear();
	finishJoining();
	document.getElementById("mode-status").hidden = false;
	document.getElementById("chat-panel").hidden = true;
	gameScreen.dataset.offline = "true";
	if (name) startOfflineGame(name);
}

function startOfflineGame(name) {
	offlinePlayer = {
		id: "offline-player", name,
		x: 65 + Math.floor(Math.random() * 160) * 5,
		y: 80 + Math.floor(Math.random() * 120) * 5,
		w: 64, h: 64, speed: 5, score: 0, spriteState: 1,
	};
	offlineRooms.lobby.players[offlinePlayer.id] = offlinePlayer;
	setGameState({ ...offlineRooms.lobby, roomName: "lobby" }, offlinePlayer.id);
}

function joinOnline(name) {
	joining = true;
	nameInput.disabled = true;
	joinError.textContent = "Joining...";
	clearTimeout(joinTimer);
	joinTimer = setTimeout(() => {
		pendingName = null;
		finishJoining("Couldn't join. Please try again.");
	}, 8000);
	sendGameEvent("joinGame", { name });
}

function finishJoining(error = "") {
	clearTimeout(joinTimer);
	joining = false;
	nameInput.disabled = false;
	joinError.textContent = error;
}

function showEntry(message) {
	game = null;
	keys = {};
	changingRoom = false;
	gameScreen.hidden = true;
	entryScreen.hidden = false;
	finishJoining(message);
	nameInput.focus({ preventScroll: true });
}

try {
	nameInput.value = (localStorage.getItem("multiplayer-player-name") || "").slice(0, 20);
} catch {
	// Storage can be unavailable in private or embedded browsers.
}
nameInput.addEventListener("input", () => {
	nameInput.removeAttribute("aria-invalid");
	joinError.textContent = "";
});

document.getElementById("join-form").addEventListener("submit", (event) => {
	event.preventDefault();
	if (joining) return;
	const name = nameInput.value.trim().replace(/\s+/g, " ");
	if (!name || name.length > 20 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)) {
		joinError.textContent = "Choose a name between 1 and 20 characters.";
		nameInput.setAttribute("aria-invalid", "true");
		nameInput.focus();
		return;
	}
	pendingName = name;
	nameInput.value = name;
	if (offlineMode) {
		startOfflineGame(name);
		return;
	}
	if (!socket?.connected) {
		joining = true;
		nameInput.disabled = true;
		joinError.textContent = "Connecting...";
		waitForServer();
		return;
	}
	joinOnline(name);
});

onServerEvent("connect", () => {
	clearTimeout(connectionTimer);
	connectionTimer = null;
	if (pendingName) joinOnline(pendingName);
	else finishJoining();
});
onServerEvent("connect_error", () => {
	joinError.textContent = "Can't reach the game yet. Trying to reconnect...";
});
onServerEvent("joinError", (message) => {
	pendingName = null;
	finishJoining(message);
	nameInput.setAttribute("aria-invalid", "true");
	nameInput.focus();
});

onServerEvent("newPlayer", (data) => {
	if (game) game.players[data.id] = data.obj;
});
onServerEvent("currentGame", (data) => {
	setGameState(data, socket.id);
});

function setGameState(data, id) {
	if (!data.players?.[id]) return;
	playerId = id;
	const entering = !game;
	const changingWorld = game?.roomName !== data.roomName;
	game = data;
	if (changingWorld) {
		keys = {};
		attacks.clear();
	}
	changingRoom = false;
	finishJoining();
	const name = game.players[playerId].name;
	lastJoinedName = name;
	pendingName = null;
	try {
		localStorage.setItem("multiplayer-player-name", name);
	} catch {
		// Remembering a name is optional; joining is not.
	}
	entryScreen.hidden = true;
	gameScreen.hidden = false;
	if (entering) {
		document.getElementById("chat-messages").replaceChildren();
		keys = {};
		cnv.focus({ preventScroll: true });
	}
}

onServerEvent("playerDisconnect", (data) => {
	if (game) delete game.players[data];
});

onServerEvent("playerMessage", (data) => {
	if (!game) return;
	const a = document.getElementById("chat-messages");
	const b = document.createElement("p");
	const sender = document.createElement("strong");
	sender.textContent = `${data.name}: `;
	b.append(sender, document.createTextNode(data.msg));
	a.appendChild(b);
	if (a.childElementCount > 16) {
		a.removeChild(a.firstElementChild);
	}
	a.scrollTop = a.scrollHeight;
});
onServerEvent("playerMoved", (data) => {
	if (data.id == playerId) return;
	if (!game?.players[data.id]) return;
	game.players[data.id].x = data.x;
	game.players[data.id].y = data.y;
});
onServerEvent("playerNewSprite", (data) => {
	if (!game?.players[data.id]) return;
	game.players[data.id].spriteState = data.new;
});
onServerEvent("zombiesUpdated", (enemies) => {
	if (game?.roomName === "dungeon") game.enemies = enemies;
});
onServerEvent("playerAttacked", (data) => {
	if (game?.roomName === "dungeon" && data.area) {
		attacks.set(data.id, { area: data.area, until: performance.now() + 400 });
	}
});
onServerEvent("playerGotBanana", (data) => {
	if (!game?.players[data.id] || !game.banana) return;
	game.players[data.id].score += 1;
	game.banana.x = data.newX;
	game.banana.y = data.newY;
});
onServerEvent("disconnectMe", (data) => {
	socket.disconnect();
	showEntry(data.reason || "You have been disconnected.");
});
onServerEvent("disconnect", () => {
	pendingName = pendingName || lastJoinedName;
	showEntry("Connection lost. Reconnecting...");
	waitForServer();
	if (!socket.active) socket.connect();
});

const cnv = document.getElementById("canvas");
const ctx = cnv.getContext("2d");
cnv.width = 1000;
cnv.height = 800;
ctx.imageSmoothingEnabled = false;

let keys = {};
let lastFrameTime;
let lastUpdate = Date.now();
let updateDelay = 5;
function loop(timestamp = performance.now()) {
	const seconds = lastFrameTime === undefined ? 0 : (timestamp - lastFrameTime) / 1000;
	lastFrameTime = timestamp;
	try {
		if (!game || !game.players || !game.players[playerId]) {
			requestAnimationFrame(loop);
			return;
		}
		var a = game.players[playerId];

		background();
		ctx.font = "16px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		// doors
		for (var d of game.doors) {
			if (checkCollision(a, d)) {
				changeRoom(d.to, d);
			}
			ctx.fillStyle = "black";
			ctx.fillRect(d.x, d.y, d.w, d.h);
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(d.to, d.x + d.w / 2, d.y + d.h / 2);
		}

		// enemies
		for (var enemy of game.enemies) {
			if (zombieImage.width) drawCharacter(enemy, zombieImage);
		}
		for (const [id, effect] of attacks) {
			if (performance.now() > effect.until) {
				attacks.delete(id);
				continue;
			}
			ctx.fillStyle = "rgba(235, 255, 200, 0.2)";
			ctx.strokeStyle = "#efffc8";
			ctx.lineWidth = 2;
			ctx.fillRect(effect.area.x, effect.area.y, effect.area.w, effect.area.h);
			ctx.strokeRect(effect.area.x, effect.area.y, effect.area.w, effect.area.h);
		}
		// player logic
		ctx.fillStyle = "white";
		ctx.font = "16px Arial";
		for (var id in game.players) {
			const p = game.players[id];
			if (!p) break;
			ctx.fillStyle = "black";
			//ctx.fillRect(p.x, p.y, p.w, p.h); // <- delete this later, for testing

			if (!playerImage.complete || !playerImage.naturalWidth) continue;
			drawCharacter(p, playerImage);
			ctx.fillRect(
				p.x + p.w / 2 - ctx.measureText(p.name).width / 2 - 4,
				p.y - (12 + 16) - 2,
				ctx.measureText(p.name).width + 8,
				16 + 8
			);
			ctx.fillStyle = "white";
			ctx.fillText(p.name, p.x + p.w / 2, p.y - 16);
			ctx.fillStyle = "white";
		}
		// move
		if (!changingRoom) {
			const previousFacing = a.spriteState;
			Dungeon.movePlayer(a, keys, seconds);
			if (a.spriteState !== previousFacing) sendGameEvent("newSprite", a.spriteState);
		}
		// send move updates
		if (!changingRoom && Date.now() - lastUpdate > updateDelay) {
			sendGameEvent("move", {
				x: game.players[playerId].x,
				y: game.players[playerId].y,
				roomName: game.roomName,
			});
			lastUpdate = Date.now();
		}
	} catch (Error) {
		console.log(Error);
	}
	requestAnimationFrame(loop);
}
document.querySelectorAll("[data-key]").forEach((button) => {
	button.addEventListener("pointerdown", (event) => {
		event.preventDefault();
		cnv.focus({ preventScroll: true });
		button.setPointerCapture(event.pointerId);
		keys[button.dataset.key] = true;
	});
	for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
		button.addEventListener(event, () => { keys[button.dataset.key] = false; });
	}
});

document.getElementById("chat-form").addEventListener("submit", (event) => {
	event.preventDefault();
	sendMessage();
});

loop();

const movementKeys = { ArrowUp: "w", ArrowLeft: "a", ArrowDown: "s", ArrowRight: "d" };
document.addEventListener("keydown", (event) => {
	if (!game || event.target.matches("input, textarea, button") || event.target.isContentEditable || event.ctrlKey || event.metaKey || event.altKey) return;
	const key = movementKeys[event.key] || event.key.toLowerCase();
	if (key === "f") {
		event.preventDefault();
		if (!event.repeat) attack();
		return;
	}
	if (["w", "a", "s", "d", "l"].includes(key)) {
		event.preventDefault();
		keys[key] = true;
		if (key === "l" && !event.repeat) changeRoom("lobby", null);
	}
});
document.addEventListener("keyup", (event) => {
	keys[movementKeys[event.key] || event.key.toLowerCase()] = false;
});
document.addEventListener("focusin", (event) => {
	if (event.target.matches("input, textarea")) keys = {};
});
window.addEventListener("blur", () => { keys = {}; });
document.addEventListener("visibilitychange", () => {
	lastFrameTime = undefined;
	if (document.hidden) keys = {};
});

setInterval(() => {
	if (!offlineMode || !offlineSimulation || !game) return;
	const hitPlayers = offlineSimulation.update(0.05);
	if (game.roomName === "dungeon" && hitPlayers.has(playerId)) changeRoom("lobby");
}, 50);

waitForServer();
socket?.connect();
