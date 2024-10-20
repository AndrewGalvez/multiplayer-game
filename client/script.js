// lol
var spriteState = 4;
console.log("if u hack ur a loser");

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

function setScoreText() {
	scoreText.textContent = "Score: " + game.players[socket.id].score.toString();
}
function background() {
	// background
	//ctx.clearRect(0, 0, cnv.width, cnv.height);
	//ctx.fillStyle = "black";
	//ctx.fillRect(0, 0, cnv.width, cnv.height);
	let bgImg = new Image();
	bgImg.src = "/client/sprites/bananaValley.png"
	ctx.drawImage(bgImg, 0, 0, cnv.width, cnv.height);
}
function updateLeaderBoard(leaderBoard) {
	let scores = {};
	for (let id in game.players) {
		scores[game.players[id].name] = game.players[id].score;
	}
	let sortedScores = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
	let leaderboardText = sortedScores
		.map((name) => `${name}: ${scores[name]} \n`)
		.join("\n");
	leaderBoard.textContent = leaderboardText; // Assuming leaderboard is a DOM element
}

try {
	var name =
		prompt("Pick a name: ").substring(0, 14).trim().replaceAll(" ", "-") ||
		"blank";
} catch {
	var name = "blank";
}

if (name == null || name == undefined) name = "blank";
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

const spriteSheet = {1:"/client/sprites/n.png", 2:"/client/sprites/e.png", 3:"/client/sprites/s.png", 4:"/client/sprites/w.png"};

const socket = io();

socket.emit("name", name);

socket.on("newPlayer", (data) => {
	game.players[data.id] = data.obj;
});
socket.on("currentGame", (data) => {
	game = data;
	var a = game.banana.img;
	game.banana.render = function (ctx, image) {
		ctx.drawImage(
			image,
			game.banana.x,
			game.banana.y,
			game.banana.w,
			game.banana.h
		);
	};

	game.banana.img = new Image();
	game.banana.img.src = a;
	document.getElementById("pname").innerText = game.players[socket.id].name;
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
	window.location.assign(`/client/disconnect.html?reason=${data.reason}`);
});
socket.on("disconnect", () => {
	window.alert(
		"You have lost connection to the server for an unknown reason. Continue to attempt to reconnect."
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
let scoreText = document.getElementById("pscore");
let leaderBoard = document.getElementById("Leaderboard");
function loop() {
	try{
	var a = game.players[socket.id];
	setScoreText();
	updateLeaderBoard(leaderBoard);
	resetMove();

	background();

	// Banana
	if (checkCollision(game.banana, a)) {
		socket.emit("gotBanana");
		game.banana.x = -10000; // move banana away so you cant collide with it multiple times
		game.banana.y = -10000; // when you wait for the new position of the banana from the server
	}
	game.banana.render(ctx, game.banana.img);

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
		//ctx.fillRect(p.x, p.y, 25, 25);
		let newSprite = new Image();
		newSprite.src = spriteSheet[spriteState];
		ctx.drawImage(newSprite, p.x, p.y);
		ctx.fillStyle = 'red';
		ctx.fillText(
			p.name + ` (${p.score})`,
			p.x + 12.5 - ctx.measureText(p.name + ` (${p.score})`).width / 2,
			p.y - 12
		);
		ctx.fillStyle = 'white';
	}
	// move
	if (keys["w"] || keys["a"] || keys["s"] || keys["d"]) {
		if (
			keys["w"] &&
			canMove["w"] &&
			game.players[socket.id].y - game.players[socket.id].speed > 0
		) {
			game.players[socket.id].y -= game.players[socket.id].speed;
			spriteState = 1;
		}
		if (
			keys["a"] &&
			canMove["a"] &&
			game.players[socket.id].x - game.players[socket.id].speed > 0
		) {
			game.players[socket.id].x -= game.players[socket.id].speed;
			spriteState = 4;
		}
		if (
			keys["s"] &&
			canMove["s"] &&
			game.players[socket.id].y + 25 + game.players[socket.id].speed <
				cnv.height
		) {
			game.players[socket.id].y += game.players[socket.id].speed;
			spriteState = 3;
		}
		if (
			keys["d"] &&
			canMove["d"] &&
			game.players[socket.id].x + 25 + game.players[socket.id].speed < cnv.width
		) {
			game.players[socket.id].x += game.players[socket.id].speed;
			spriteState = 2;
		}
	}
	const test = 213/0;
		 console.log (testfshuio);
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
catch(error){
	console.error("An error occurred on line:", error.lineNumber, "in file:", error.fileName, "message reads:", error.message);
	window.location.href = "/client/disconnect.html";
	document.getElementById('errorsError').innerText = "An error occurred on line:", error.lineNumber, "in file:", error.fileName, "message reads:", error.message;
}
}

document.onkeydown = (e) => {
	keys[e.key] = true;
};
document.onkeyup = (e) => {
	keys[e.key] = false;
};
