var express = require("express");
var http = require("http");
var { Server } = require("socket.io");
const { intersects, attackArea, createDungeonSimulation, ATTACK_COOLDOWN, WORLD_WIDTH, WORLD_HEIGHT } = require("./client/dungeon");
const { createRooms } = require("./client/world");
var app = express();
var server = http.createServer(app);
var io = new Server(server);

app.use("/client", express.static(__dirname + "/client"));
app.get("/", (req, res) => res.redirect("/client/index.html"));

const rooms = createRooms();
const dungeonSimulation = createDungeonSimulation(rooms.dungeon);
dungeonSimulation.reset();

function transferPlayer(socket, roomName, newPos) {
	const previousRoom = socket.data.roomName;
	const player = socket.data.player;
	if (previousRoom) {
		socket.to(previousRoom).emit("playerDisconnect", socket.id);
		socket.leave(previousRoom);
		delete rooms[previousRoom].players[socket.id];
	}
	if (roomName === "dungeon" && !Object.keys(rooms.dungeon.players).length) {
		dungeonSimulation.reset();
	}
	if (newPos) {
		player.x = newPos.x;
		player.y = newPos.y;
	}
	socket.data.roomName = roomName;
	rooms[roomName].players[socket.id] = player;
	socket.join(roomName);
	socket.emit("currentGame", { ...rooms[roomName], roomName });
	socket.to(roomName).emit("newPlayer", { id: socket.id, obj: player });
}

function returnToLobby(socket) {
	const spawn = rooms.dungeon.doors.find((door) => door.to === "lobby").newPos;
	transferPlayer(socket, "lobby", spawn);
}

setInterval(() => {
	const hitPlayers = dungeonSimulation.update(0.05);
	if (!Object.keys(rooms.dungeon.players).length) return;
	for (const id of hitPlayers) {
		const socket = io.sockets.sockets.get(id);
		if (socket?.data.roomName === "dungeon") returnToLobby(socket);
	}
	io.to("dungeon").emit("zombiesUpdated", rooms.dungeon.enemies);
}, 50).unref();

io.on("connection", (socket) => {
	socket.data.roomName = null;
	let lastAttack = 0;
	const playerData = {
		x: 65 + Math.floor(Math.random() * 160) * 5,
		y: 80 + Math.floor(Math.random() * 120) * 5,
		speed: 5,
		name: "",
		w: 64,
		h: 64,
		score: 0,
		spriteState: 1,
		id: socket.id,
	};
	socket.data.player = playerData;

	socket.on("joinGame", (data) => {
		const currentRoom = socket.data.roomName;
		if (currentRoom) return socket.emit("currentGame", { ...rooms[currentRoom], roomName: currentRoom });
		const name = typeof data?.name === "string" ? data.name.trim().replace(/\s+/g, " ") : "";
		if (!name || name.length > 20 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)) {
			return socket.emit("joinError", "Choose a name between 1 and 20 characters.");
		}
		playerData.name = name;
		transferPlayer(socket, "lobby");
		io.to(Object.keys(rooms)).emit("playerMessage", { name: "Server", msg: `${name} joined the game` });
	});

	socket.on("newSprite", (data) => {
		const currentRoom = socket.data.roomName;
		if (currentRoom && [1, 2, 3, 4].includes(data)) {
			playerData.spriteState = data;
			io.to(currentRoom).emit("playerNewSprite", { id: socket.id, new: data });
		}
	});

	socket.on("message", (data) => {
		if (!socket.data.roomName || typeof data?.msg !== "string" || !data.msg.trim()) return;
		io.to(Object.keys(rooms)).emit("playerMessage", { name: playerData.name, msg: data.msg.trim().slice(0, 300) });
	});

	socket.on("joinRoom", (data) => {
		const currentRoom = socket.data.roomName;
		if (!currentRoom || typeof data?.r !== "string" || !Object.hasOwn(rooms, data.r)) return;
		if (data.r === currentRoom) return;
		const door = rooms[currentRoom].doors.find((door) => door.to === data.r);
		if (!door && data.r !== "lobby") return;
		transferPlayer(socket, data.r, door?.newPos);
	});

	socket.on("move", (data) => {
		const currentRoom = socket.data.roomName;
		if (data?.roomName !== undefined && data.roomName !== currentRoom) return;
		if (!currentRoom || !Number.isFinite(data?.x) || !Number.isFinite(data?.y)) return;
		playerData.x = Math.max(0, Math.min(WORLD_WIDTH - playerData.w, data.x));
		playerData.y = Math.max(0, Math.min(WORLD_HEIGHT - playerData.h, data.y));
		if (currentRoom === "dungeon" && rooms.dungeon.enemies.some((enemy) => intersects(enemy, playerData))) {
			return returnToLobby(socket);
		}
		io.to(currentRoom).emit("playerMoved", { x: playerData.x, y: playerData.y, id: socket.id });
	});

	socket.on("attack", () => {
		if (socket.data.roomName !== "dungeon" || Date.now() - lastAttack < ATTACK_COOLDOWN) return;
		lastAttack = Date.now();
		const killedId = dungeonSimulation.attack(playerData);
		io.to("dungeon").emit("playerAttacked", { id: socket.id, area: attackArea(playerData), killedId });
		if (killedId) {
			io.to("dungeon").emit("zombiesUpdated", rooms.dungeon.enemies);
		}
	});

	socket.on("disconnecting", () => {
		const currentRoom = socket.data.roomName;
		if (currentRoom) {
			delete rooms[currentRoom].players[socket.id];
			socket.to(currentRoom).emit("playerDisconnect", socket.id);
		}
	});
});

const port = process.env.PORT || 5767;
server.listen(port, () => {
	console.log(`[Server] Listening on http://localhost:${server.address().port}`);
});
