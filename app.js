var fs = require("fs");
var express = require("express");
var http = require("http");
var { Server } = require("socket.io");
var readline = require("readline");
var app = express();
var server = http.createServer(app);
var io = new Server(server);

app.use("/client", express.static(__dirname + "/client"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/client/index.html");
});

const rl = readline.createInterface({
	input: process.stdin,
});

const handleCommand = (command) => {
	const args = command.split(" ");
	const cmd = args[0];

	if (cmd == "disconnect") {
		const playerName = args[1];
		for (const id in game.players) {
			if (game.players[id].name === playerName) {
				const socket = io.sockets.sockets.get(id);
				if (socket) {
					socket.emit("disconnectMe", {
						reason: "Manually disconnected by server owner",
					});
					socket.disconnect();
				}
				break;
			}
		}
	} else if (cmd == "quit") {
		io.close();
		process.exit();
	} else {
		console.log("[Commands] unknown command");
	}
};

rl.on("line", (input) => {
	handleCommand(input);
});

let rooms = JSON.parse(fs.readFileSync("rooms.json", "utf8"));

io.on("connection", (socket) => {
	const playerData = {
		x: Math.floor(Math.random() * 196) * 5,
		y: Math.floor(Math.random() * 155) * 5,
		speed: 5,
		name: "",
		w: 64,
		h: 64,
		score: 0,
		spriteState: 1,
		id: socket.id,
	};

	socket.join("lobby");
	rooms["lobby"].players[socket.id] = playerData;

	socket.on("name", (data) => {
		rooms["lobby"].players[socket.id].name = data || "Guest";
		io.to("lobby").emit("newPlayer", { id: socket.id, obj: playerData });
		socket.emit("currentGame", rooms["lobby"]);
	});
	socket.on("newSprite", (data) => {
		const currentRoom = [...socket.rooms][1];
		if (rooms[currentRoom]) {
			rooms[currentRoom].players[socket.id].spriteState = data;
			io.to(currentRoom).emit("playerNewSprite", { id: socket.id, new: data });
		}
	});
	socket.on("joinRoom", (data) => {
		const currentRoom = [...socket.rooms][1]; // current room
		if (currentRoom) {
			io.to(currentRoom).emit("playerDisconnect", socket.id); // Remove from the previous room
			socket.leave(currentRoom);
			delete rooms[currentRoom].players[socket.id];
		}
		socket.join(data);
		rooms[data].players[socket.id] = playerData;
		setTimeout(() => {
			io.to(data).emit("currentGame", rooms[data]);
		}, 1000);
	});

	socket.on("move", (data) => {
		const currentRoom = [...socket.rooms][1];
		if (rooms[currentRoom]) {
			rooms[currentRoom].players[socket.id].x = data.x;
			rooms[currentRoom].players[socket.id].y = data.y;
			io.to(currentRoom).emit("playerMoved", {
				x: data.x,
				y: data.y,
				id: socket.id,
			});
		}
	});

	socket.on("disconnecting", () => {
		const currentRoom = [...socket.rooms][1]; // get the room the player is in (ignoring socket.id)
		if (rooms[currentRoom]) {
			delete rooms[currentRoom].players[socket.id];
			console.log("Player removed from room:", currentRoom);
		}
	});

	socket.on("disconnect", () => {
		io.emit("playerDisconnect", socket.id);
	});
});

// run server
server.listen(5767, () => {
	console.log("[Server] Listening on PORT 5767");
});
