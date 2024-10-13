// lol
console.log("if u hack ur a loser");

function checkCollision(player1, player2) {
	return (
		player1.x < player2.x + player2.w &&
		player1.x + player1.w > player2.x &&
		player1.y < player2.y + player2.h &&
		player1.y + player1.h > player2.y
	);
}

var name = prompt("Pick a name: ").substring(0, 8).trim() || "blank";
if (name.trim() === "") name = "blank";

let game = {
	players: {},
	banana: {
		x: 0,
		y: 0,
		w: 0,
		h: 0,
		img: new Image(),
	},
};

const socket = io();

socket.emit("name", name);

socket.on("newPlayer", (data) => {
	game.players[data.id] = data.obj;
});
socket.on("currentGame", (data) => {
	game = data;
	var a = game.banana.img;
	game.banana.img = new Image();
	game.banana.img.src = a;
	loop();
});
socket.on("playerDisconnect", (data) => {
	delete game.players[data];
});
socket.on("playerMoved", (data) => {
	if (data.id == socket.id) return;
	game.players[data.id].x = data.x;
	game.players[data.id].y = data.y;
});
socket.on("playerGotBanana", (data) => {
	game.players[data.id].score += 1;
	game.banana.x = data.newX;
	game.banana.y = data.newY;
});
socket.on("disconnectMe", (data) => {
	window.location.assign("/client/disconnect.html");
});
socket.on("disconnect", () => {
	window.alert(
		"You have lost connection to the server. Continue to attempt to reconnect."
	);
	window.location.reload();
});

const cnv = document.querySelector("canvas");
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
function loop() {
	var a = game.players[socket.id] || {
		x: 0,
		y: 0,
	};
	// reset move variables
	canMove["w"] = true;
	canMove["a"] = true;
	canMove["s"] = true;
	canMove["d"] = true;
	// background
	ctx.clearRect(0, 0, cnv.width, cnv.height);
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, cnv.width, cnv.height);

	// Banana
	if (checkCollision(game.banana, a)) {
		socket.emit("gotBanana");
		game.banana.x = -10000; // move banana away so you cant collide with it multiple times
		game.banana.y = -10000; // when you wait for the new position of the banana from the server
	}
	ctx.drawImage(
		game.banana.img,
		game.banana.x,
		game.banana.y,
		game.banana.w,
		game.banana.h
	);

	// player logic
	ctx.fillStyle = "white";
	ctx.font = "16px Arial";
	for (var id in game.players) {
		if (id === socket.id) continue; // skip checking collision with self
		var p = game.players[id];

		if (checkCollision({ x: a.x, y: a.y - a.speed }, p)) canMove["w"] = false;
		if (checkCollision({ x: a.x - a.speed, y: a.y }, p)) canMove["a"] = false;
		if (checkCollision({ x: a.x, y: a.y + a.speed }, p)) canMove["s"] = false;
		if (checkCollision({ x: a.x + a.speed, y: a.y }, p)) canMove["d"] = false;
	}
	for (var id in game.players) {
		p = game.players[id];
		ctx.fillRect(p.x, p.y, 25, 25);
		ctx.fillText(
			p.name + ` (${p.score})`,
			p.x + 12.5 - ctx.measureText(p.name + ` (${p.score})`).width / 2,
			p.y - 12
		);
	}
	// move
	if (keys["w"] || keys["a"] || keys["s"] || keys["d"]) {
		if (
			keys["w"] &&
			canMove["w"] &&
			game.players[socket.id].y - game.players[socket.id].speed > 0
		) {
			game.players[socket.id].y -= game.players[socket.id].speed;
		}
		if (
			keys["a"] &&
			canMove["a"] &&
			game.players[socket.id].x - game.players[socket.id].speed > 0
		) {
			game.players[socket.id].x -= game.players[socket.id].speed;
		}
		if (
			keys["s"] &&
			canMove["s"] &&
			game.players[socket.id].y + 25 + game.players[socket.id].speed <
				cnv.height
		) {
			game.players[socket.id].y += game.players[socket.id].speed;
		}
		if (
			keys["d"] &&
			canMove["d"] &&
			game.players[socket.id].x + 25 + game.players[socket.id].speed < cnv.width
		) {
			game.players[socket.id].x += game.players[socket.id].speed;
		}
	}
	// send updates to server
	if (Date.now() - lastUpdate >= updateDelay && game.players[socket.id]) {
		socket.emit("move", {
			x: game.players[socket.id].x,
			y: game.players[socket.id].y,
		});

		lastUpdate = Date.now();
	}
	requestAnimationFrame(loop);
}

document.onkeydown = (e) => {
	keys[e.key] = true;
};
document.onkeyup = (e) => {
	keys[e.key] = false;
};
