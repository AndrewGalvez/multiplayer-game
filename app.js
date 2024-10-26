var fs = require("fs");
var pageError = "Error not defined.";
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const readline = require("readline");
const path = require("path");
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use("/client", express.static(__dirname + "/client"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/client/index.html");
	if (req.url !== "/") {
		res.redirect("/client/index.html");
	}
}); // send to client html page when connecting directly to the server
const rl = readline.createInterface({
	input: process.stdin,
}); // console
const handleCommand = (command) => {
	const args = command.split(" ");
	const cmd = args[0];

	if (cmd == "disconnect") {
		var a = args[1];
		for (const id in game.players) {
			if (game.players[id].name === a) {
				const socket = io.sockets.sockets.get(id);
				if (socket) {
					console.log(
						`[Commands] Disconnect: Manually disconnected ${game.players[id].name}`
					);
					socket.emit("disconnectMe", {
						reason: "Manually disconnected by server owner",
					});
					socket.disconnect();
				} else {
					console.log("[Commands] Disconnect: Socket not found for player");
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
}; // handle commands inputed to console

rl.on("line", (input) => {
	handleCommand(input);
}); // event listener for command in console

init_game = () => {
	game = {};
	return game;
};

let rooms = JSON.parse(fs.readFileSync("rooms.json", "utf8"));
//TODO: add more rooms

// when a player joins
io.on("connection", (socket) => {
	rooms["lobby"].players[socket.id] = {
		x: Math.floor(Math.floor(Math.random() * 975) / 5) * 5,
		y: Math.floor(Math.floor(Math.random() * 775) / 5) * 5,
		speed: 5,
		name: "",
		w: 64,
		h: 64,
		score: 0,
		spriteState: 1,
		id: socket.id,
	};
	let tempPlayer = rooms["lobby"].players[socket.id];
	socket.leave(socket.id);
	socket.join("lobby");

	const possibleNames = JSON.parse(fs.readFileSync("names.json", "utf8"));

	socket.on("name", (data) => {
		const names = Object.values(rooms["lobby"].players).map(
			(player) => player.name
		);

		if (data.trim() === "blank") {
			let randomName;
			do {
				randomName =
					possibleNames[Math.floor(Math.random() * possibleNames.length)];
			} while (names.includes(randomName));

			rooms["lobby"].players[socket.id].name = randomName;
		} else {
			rooms["lobby"].players[socket.id].name = data;
		}

		socket.emit("currentGame", rooms["lobby"]);
		io.to("lobby").emit("newPlayer", {
			id: socket.id,
			obj: rooms["lobby"].players[socket.id],
		});
	});

	socket.on("joinRoom", (data) => {
		socket.join(data);
		console.log(rooms);
		rooms[data].players[socket.id] = tempPlayer;
	});
	socket.on("leaveRoom", (data) => {
		tempPlayer = rooms[[...socket.rooms][0]].players[socket.id];
		socket.leave([...socket.rooms][0]);
	});

	// player position change
	socket.on("move", (data) => {
		rooms[[...socket.rooms][0]].players[socket.id].x = data.x;
		rooms[[...socket.rooms][0]].players[socket.id].y = data.y;
		io.to([...socket.rooms][0]).emit("playerMoved", {
			x: data.x,
			y: data.y,
			id: socket.id,
		});
	});
	socket.on("newSprite", (data) => {
		rooms[[...socket.rooms][0]].players[socket.id].spriteState = data;
		io.to([...socket.rooms][0]).emit("playerNewSprite", {
			id: socket.id,
			new: data,
		});
	});
	socket.on("gotBanana", (data) => {
		rooms[[...socket.rooms][0]].players[socket.id].score += 1;
		rooms[[...socket.rooms][0]].banana.x =
			Math.random() * (1000 - game.banana.w);
		rooms[[...socket.rooms][0]].banana.y =
			Math.random() * (800 - game.banana.h);
		io.to([...socket.rooms][0]).emit("playerGotBanana", {
			id: socket.id,
			newX: game.banana.x,
			newY: game.banana.y,
		});
	});

	// when player leaves the game
	socket.on("disconnect", () => {
		io.emit("playerDisconnect", socket.id);
		for (const roomName in rooms) {
			if (rooms[roomName].players && socket.id in rooms[roomName].players) {
				delete rooms[roomName].players[socket.id];
				break;
			}
		}
	});
});

// run server

server.listen(5767, () => {
	console.log("[Server] Listening on PORT 5767");
});
