function checkCollision(player1, player2) {
	return (
		player1.x < player2.x + player2.w &&
		player1.x + player1.w > player2.x &&
		player1.y < player2.y + player2.h &&
		player1.y + player1.h > player2.y
	);
}

function resetMove() {
	// reset move variables
	canMove["w"] = true;
	canMove["a"] = true;
	canMove["s"] = true;
	canMove["d"] = true;
}

function background() {
	// background
	//ctx.clearRect(0, 0, cnv.width, cnv.height);
	//ctx.fillStyle = "black";
	//ctx.fillRect(0, 0, cnv.width, cnv.height);
	let bgImg = new Image();
	bgImg.src = game.backgroundImage;
	ctx.drawImage(bgImg, 0, 0, cnv.width, cnv.height);
}

function changeRoom(room) {
	ctx.clearRect(0, 0, 1000, 800);
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, 1000, 800);
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.fillText("Loading...", 500, 400);

	requestAnimationFrame(() => {
		socket.emit("joinRoom", room);
	});
}

function getName() {
	var name = "";
	while (true) {
		try {
			name =
				prompt("Pick a name: ").substring(0, 14).trim().replaceAll(" ", "-") ||
				"blank";
		} catch {
			name = "blank";
		}

		if (name == null || name == undefined) name = "blank";
		else if (name.trim() === "") name = "blank";
		else break;
	}
	return name;
}
let name = getName();

let game;

let playerImage = new Image();
playerImage.src = "/client/sprites/player.png";
let doorImage = new Image();
doorImage.src = "/client/sprites/door.png";
const socket = io();

socket.emit("name", name);

socket.on("newPlayer", (data) => {
	game.players[data.id] = data.obj;
});
socket.on("currentGame", (data) => {
	game = data;
	if (!game.players[socket.id]) {
		console.warn("Player not found in game data.");
		return;
	}
});

socket.on("playerDisconnect", (data) => {
	delete game.players[data];
});
socket.on("playerMoved", (data) => {
	if (data.id == socket.id) return;
	if (!game) return;
	game.players[data.id].x = data.x;
	game.players[data.id].y = data.y;
});
socket.on("playerNewSprite", (data) => {
	game.players[data.id].spriteState = data.new;
});
socket.on("playerGotBanana", (data) => {
	game.players[data.id].score += 1;
	game.banana.x = data.newX;
	game.banana.y = data.newY;
});
socket.on("disconnectMe", (data) => {
	window.location.assign(`/client/disconnect.html?reason=${data.reason}`);
});
socket.on("disconnect", () => {
	window.alert(
		"You have lost connection to the server for an unknown reason. Continue to attempt to reconnect."
	);
	window.location.reload();
});

const cnv = document.getElementById("canvas");
const ctx = cnv.getContext("2d");
cnv.width = 1000;
cnv.height = 800;

let keys = {};
let canMove = {
	w: true,
	a: true,
	s: true,
	d: true,
};
let lastUpdate = Date.now();
let updateDelay = 5;
let prevPos = [0, 0];
function loop() {
	if (keys["l"]) changeRoom("lobby");
	try {
		if (!game || !game.players || !game.players[socket.id]) {
			console.log("Waiting for game state...");
			requestAnimationFrame(loop);
			return;
		}
		var a = game.players[socket.id];
		resetMove();

		background();
		// doors
		for (var d of game.doors) {
			if (checkCollision(a, d)) {
				console.log(`going to ${d.to}`);
				changeRoom(d.to);
			}
			ctx.drawImage(doorImage, d.x, d.y, d.w, d.h);
			ctx.fillStyle = "white";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(d.to, d.x + d.w / 2, d.y + d.h / 2);
		}

		// enemies
		for (var enemy of game.enemies) {
			if (checkCollision(enemy, a)) {
				// TODO: stuff
			}
			enemy.update();
			enemy.render(ctx);
		}
		// player logic
		ctx.fillStyle = "white";
		ctx.font = "16px Arial";
		for (var id in game.players) {
			p = game.players[id];
			if (!p) break;
			ctx.fillStyle = "black";
			//ctx.fillRect(p.x, p.y, p.w, p.h); // <- delete this later, for testing

			if (p.spriteState == 1)
				ctx.drawImage(playerImage, p.w, p.h, p.w, p.h, p.x, p.y, p.w, p.h);
			// w
			else if (p.spriteState == 2)
				ctx.drawImage(playerImage, p.w, 0, p.w, p.h, p.x, p.y, p.w, p.h);
			// d
			else if (p.spriteState == 3)
				ctx.drawImage(playerImage, 0, p.h, p.w, p.h, p.x, p.y, p.w, p.h);
			// s
			else if (p.spriteState == 4)
				ctx.drawImage(playerImage, 0, 0, p.w, p.h, p.x, p.y, p.w, p.h); // a
			ctx.fillRect(
				p.x + p.w / 2 - ctx.measureText(p.name).width / 2 - 4,
				p.y - (12 + 16) - 2,
				ctx.measureText(p.name).width + 8,
				16 + 8
			);
			ctx.fillStyle = "white";
			ctx.fillText(p.name, p.x + p.w / 2, p.y - 16);
			ctx.fillStyle = "white";
			if (id === socket.id) continue; // skip checking collision with self
			var p = game.players[id];
		}
		// move
		if (keys["w"] || keys["a"] || keys["s"] || keys["d"]) {
			if (
				keys["w"] &&
				canMove["w"] &&
				game.players[socket.id].y - game.players[socket.id].speed > 0
			) {
				game.players[socket.id].y -= game.players[socket.id].speed;
				if (game.players[socket.id].spriteState != 1) {
					socket.emit("newSprite", 1);
				}
				game.players[socket.id].spriteState = 1;
			}
			if (
				keys["a"] &&
				canMove["a"] &&
				game.players[socket.id].x - game.players[socket.id].speed > 0
			) {
				game.players[socket.id].x -= game.players[socket.id].speed;
				game.players[socket.id].spriteState = 4;
				socket.emit("newSprite", 4);
			}
			if (
				keys["s"] &&
				canMove["s"] &&
				game.players[socket.id].y + 25 + game.players[socket.id].speed <
					cnv.height
			) {
				game.players[socket.id].y += game.players[socket.id].speed;
				game.players[socket.id].spriteState = 3;
				socket.emit("newSprite", 3);
			}
			if (
				keys["d"] &&
				canMove["d"] &&
				game.players[socket.id].x + 25 + game.players[socket.id].speed <
					cnv.width
			) {
				game.players[socket.id].x += game.players[socket.id].speed;
				game.players[socket.id].spriteState = 2;
				socket.emit("newSprite", 2);
			}
		}
		// send move updates
		if (Date.now() - lastUpdate > updateDelay) {
			socket.emit("move", {
				x: game.players[socket.id].x,
				y: game.players[socket.id].y,
			});
			lastUpdate = Date.now();
		}
	} catch (Error) {
		console.log(Error);
	}
	requestAnimationFrame(loop);
}

loop();

document.onkeydown = (e) => {
	keys[e.key] = true;
};
document.onkeyup = (e) => {
	keys[e.key] = false;
};
