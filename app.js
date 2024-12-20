var fs = require("fs");
var express = require("express");
var http = require("http");
var { Server } = require("socket.io");
var app = express();
var server = http.createServer(app);
var io = new Server(server);

app.use("/client", express.static(__dirname + "/client"));

app.get("/", (req, res) => {
	res.sendFile(__dirname + "/client/index.html");
});

let rooms = JSON.parse(fs.readFileSync("rooms.json", "utf8"));

io.on("connection", (socket) => {
	var passwordAttempts = 0;
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

	socket.on("login", (data) => {
		console.log("login");
		if (data.username.trim() == "") {
			return socket.emit("accountDoesNotExist");
		}

		let accounts;
		try {
			accounts = JSON.parse(fs.readFileSync("data/accounts.json", "utf8"));
		} catch (err) {
			console.error("Error reading accounts file:", err);
			return socket.emit("accountDoesNotExist");
		}

		if (
			accounts[data.username] &&
			data.password === accounts[data.username].password
		) {
			playerData.name = data.username;
			socket.join("lobby");
			rooms["lobby"].players[socket.id] = playerData;
			io.to("lobby").emit("newPlayer", { id: socket.id, obj: playerData });
			socket.emit("currentGame", rooms["lobby"]);
			socket.emit("username", { id: socket.id, username: data.username });
			console.log("joined successfully");
			io.emit("playerMessage", {
				sender: "Server",
				msg: `${data.username} joined the game`,
			});
		} else {
			if (
				accounts[data.username] &&
				data.password != accounts[data.username].password
			) {
				socket.emit("wrongPassword");
			} else {
				socket.emit("accountDoesNotExist");
			}
		}
	});

	socket.on("createAccount", (data) => {
		var accounts = JSON.parse(fs.readFileSync("data/accounts.json"));
		if (accounts[data.username]) {
			console.log("account exists");
			socket.emit("accountExists");
		} else {
			accounts[data.username] = { password: data.password }; // Corrected account assignment
			fs.writeFileSync("data/accounts.json", JSON.stringify(accounts, null, 2)); // Pretty-print JSON
			console.log("created account");
			socket.emit("createdAccount");
		}
	});
	socket.on("newSprite", (data) => {
		const currentRoom = [...socket.rooms][1];
		if (rooms[currentRoom]) {
			rooms[currentRoom].players[socket.id].spriteState = data;
			io.to(currentRoom).emit("playerNewSprite", { id: socket.id, new: data });
		}
	});
	socket.on("message", (data) => {
		io.emit("playerMessage", {
			name: data.name,
			msg: data.msg,
		});
	});
	socket.on("joinRoom", (data) => {
		const currentRoom = [...socket.rooms][1]; // current room
		if (currentRoom) {
			io.to(currentRoom).emit("playerDisconnect", socket.id); // Remove from the previous room
			socket.leave(currentRoom);
			delete rooms[currentRoom].players[socket.id];
		}
		rooms[data.r].players[socket.id] = {
			...playerData,
			name: playerData.name || data.username,
		}; // Preserve name if already set

		if (data.d != null && data.d.newPos != undefined) {
			rooms[data.r].players[socket.id].x = data.d.newPos.x;
			rooms[data.r].players[socket.id].y = data.d.newPos.y;
		}
		socket.join(data.r);
		io.to(data.r).emit("currentGame", rooms[data.r]);
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
	console.log("[Server] Listening on PORT http://localhost:5767");
});
