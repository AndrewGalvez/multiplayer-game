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

app.get("/favicon.ico", (req, res) =>
	res.sendFile(path.join(__dirname, "client", "favicon.png"))
);
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

let game;

init_game = () => {
	game = {
		players: {},
		banana: {
			x: 0,
			y: 0,
			w: 15 * 4,
			h: 12 * 4,
			img: "/client/banana.png",
			render(ctx, image) {
				ctx.drawImage(image, this.x, this.y, this.w, this.h);
			},
		},
	};
};

init_game();

// when a player joins
io.on("connection", (socket) => {
	// generate player object
	if (Object.keys(game.players).length > 8) {
		socket.emit("disconnectMe", {
			reason: "Tried to join with too many players",
		});
	}
	game.players[socket.id] = {
		x: Math.floor(Math.floor(Math.random() * 975) / 5) * 5,
		y: Math.floor(Math.floor(Math.random() * 775) / 5) * 5,
		speed: 5,
		name: "",
		w: 25,
		h: 25,
		score: 0,
		spriteState: 1,
	};
	const possibleNames = JSON.parse(fs.readFileSync("names.json", "utf8"));

	socket.on("name", (data) => {
		const names = Object.values(game.players).map((player) => player.name);

		if (data.trim() === "blank") {
			let randomName;
			do {
				randomName =
					possibleNames[Math.floor(Math.random() * possibleNames.length)];
			} while (names.includes(randomName));

			game.players[socket.id].name = randomName;
		} else {
			game.players[socket.id].name = data;
		}

		console.log(
			`[Connections] ${game.players[socket.id].name} (${socket.id}) connected`
		);
		socket.emit("currentGame", game);
		socket.broadcast.emit("newPlayer", {
			id: socket.id,
			obj: game.players[socket.id],
		});
	});

	// player position change
	socket.on("move", (data) => {
		game.players[socket.id].x = data.x;
		game.players[socket.id].y = data.y;
		io.emit("playerMoved", {
			x: data.x,
			y: data.y,
			id: socket.id,
		});
	});
	socket.on("newSprite", (data) => {
		game.players[socket.id].spriteState = data;
		io.emit("playerNewSprite", { id: socket.id, new: data });
	});
	socket.on("gotBanana", (data) => {
		game.players[socket.id].score += 1;
		console.log(
			`[Server] ${game.players[socket.id].name} got a banana: ${
				game.players[socket.id].score
			}`
		);
		game.banana.x = Math.random() * (1000 - game.banana.w);
		game.banana.y = Math.random() * (800 - game.banana.h);
		io.emit("playerGotBanana", {
			id: socket.id,
			newX: game.banana.x,
			newY: game.banana.y,
		});
	});

	// when player leaves the game
	socket.on("disconnect", () => {
		console.log(
			`[Connections] ${game.players[socket.id].name} (${
				socket.id
			}) disconnected`
		);
		io.emit("playerDisconnect", socket.id);
		delete game.players[socket.id];
	});
});

// run server

server.listen(5767, () => {
	console.log("[Server] Listening on PORT 5767");
});
