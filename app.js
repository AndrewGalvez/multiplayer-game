const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const readline = require("readline");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use("/client", express.static(__dirname + "/client"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/client/index.html");
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
						reason: "manually disconnected",
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

let game = {
	players: {},
};
// when a player joins
io.on("connection", (socket) => {
	// generate player object
	game.players[socket.id] = {
		x: Math.floor(Math.floor(Math.random() * 975) / 5) * 5,
		y: Math.floor(Math.floor(Math.random() * 775) / 5) * 5,
		speed: 5,
		name: "",
	};
	// sends stuff to clients letting them know they joined when server recieves client name
	socket.on("name", (data) => {
		game.players[socket.id].name = data;
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
