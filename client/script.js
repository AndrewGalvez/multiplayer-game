// lol
console.log("if u hack ur a loser");
var currentRoom = "lobby";
function getSocketIdByName(name) {
	const player = Object.values(rooms["lobby"].players).find(
		(player) => player.name === name
	);
	return player ? player.id : null;
}
//const door1dat = { x: cnv.x + cnv.width / 2, y: cnv.y, width: 50, height: 100 };
function moveTowards(obj, targetx, targety, incrementTravel) {
	for (var i = 0; !obj.x === targetx && !obj.y == targety; i++) {
		if (obj.x !== targetx) {
			if (obj.y !== targety) {
				if (obj.x < targetx) {
					//move right
					obj.x = obj.x += incrementTravel;
				} else {
					//move left
					obj.x = obj.x += -incrementTravel;
				}
			} else if (obj.y !== targety) {
				if (obj.x !== targetx) {
					if (obj.x !== targetx) {
						if (obj.y < targety) {
							//move up
							obj.y = obj.y += -incrementTravel;
						} else {
							//move down
							obj.y = obj.y += incrementTravel;
						}
					}
				}
				//reminder: you still have to update the position outside of function; this is just to give you a position to set to
			} else {
				if (obj.x < targetx) {
					//move right
					obj.x = obj.x += incrementTravel;
				} else {
					//move left
					obj.x = obj.x += -incrementTravel;
				}
				if (obj.y < targety) {
					//move up
					obj.y = obj.y += -incrementTravel;
				} else {
					//move down
					obj.x = obj.x += incrementTravel;
				}
			}
		}
	}
}
function findCenter(obj) {
	var centeredX;
	var centeredY;
	centeredX = obj.x + obj.width / 2;
	centeredY = obj.y + obj.height / 2;
	return { x: centeredX, y: centeredY };
}
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
	bgImg.src = "/client/sprites/bananaValley.png";
	ctx.drawImage(bgImg, 0, 0, cnv.width, cnv.height);
}
function Dbackground() {
	//background
	let DbgImg = new Image();
	bgImg.src = "/client/sprites/dungeonBackground.png";
	ctx.drawImage(DbgImg, 0, 0, cnv.width, cnv.height);
}

function changeRoom(room) {
	socket.emit("leaveRoom");
	socket.emit("joinRoom", room);
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

const socket = io();

socket.emit("name", name);

socket.on("newPlayer", (data) => {
	game.players[data.id] = data.obj;
});
socket.on("currentGame", (data) => {
	game = data;
	if (currentRoom === "lobby") {
		lobbyLoop();
	}
	if (currentRoom === "dungeon") {
		dungeonLoop()
	}
	updateServer();
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

const cnv = document.getElementById("lobbyCanvas");
const ctx = cnv.getContext("2d");
function lobbyLoop() {
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
	function lobbyLoop() {
		var a = game.players[socket.id];
		resetMove();

		background();

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
			if (id === socket.id) continue; // skip checking collision with self
			var p = game.players[id];
			let player = game.players[socket.id];
			if (
				checkCollision(
					{ x: player.x, y: player.y - player.speed, w: player.w, h: player.h },
					p
				)
			)
				canMove["w"] = false;

			if (
				checkCollision(
					{ x: player.x - player.speed, y: player.y, w: player.w, h: player.h },
					p
				)
			)
				canMove["a"] = false;

			if (
				checkCollision(
					{ x: player.x, y: player.y + player.speed, w: player.w, h: player.h },
					p
				)
			)
				canMove["s"] = false;

			if (
				checkCollision(
					{ x: player.x + player.speed, y: player.y, w: player.w, h: player.h },
					p
				)
			)
				canMove["d"] = false;
		}
		for (var id in game.players) {
			p = game.players[id];
			ctx.fillStyle = "red";
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
			ctx.fillText(
				p.name + ` (${p.score})`,
				p.x + p.w / 2 - ctx.measureText(p.name + ` (${p.score})`).width / 2,
				p.y - 12
			);
			ctx.fillStyle = "white";
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
	}
}
function returnToLobby() {
	// returns to lobby
	changeRoom("lobby");
}
function dungeonLoop() {
	var a = game.players[socket.id];
	resetMove();

	Dbackground();

	for (var enemy of game.enemies) {
		if (checkCollision(enemy, a)) {
			ctx.fillStyle = "Red";
			ctx.font = "40px Papyrus";
			findCenter(cnv);
			for (va currentRoom === "lobby"){ // ??? what
			ctx.fillText("L BOZO ACTUALLY DIED");
			canMove["W"] = false;
			canMove["A"]
			}
			setTimeout(returnToLobby, 5000);
		}
		enemy.update();
		enemy.render(ctx);
	}
	// player logic
	ctx.fillStyle = "white";
	ctx.font = "16px Arial";
	for (var id in game.players) {
		if (id === socket.id) continue; // skip checking collision with self
		var p = game.players[id];
		let player = game.players[socket.id];
		if (
			checkCollision(
				{ x: player.x, y: player.y - player.speed, w: player.w, h: player.h },
				p
			)
		)
			canMove["w"] = false;

		if (
			checkCollision(
				{ x: player.x - player.speed, y: player.y, w: player.w, h: player.h },
				p
			)
		)
			canMove["a"] = false;

		if (
			checkCollision(
				{ x: player.x, y: player.y + player.speed, w: player.w, h: player.h },
				p
			)
		)
			canMove["s"] = false;

		if (
			checkCollision(
				{ x: player.x + player.speed, y: player.y, w: player.w, h: player.h },
				p
			)
		)
			canMove["d"] = false;
	}
	for (var id in game.players) {
		p = game.players[id];
		ctx.fillStyle = "red";
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
		ctx.fillText(
			p.name + ` (${p.score})`,
			p.x + p.w / 2 - ctx.measureText(p.name + ` (${p.score})`).width / 2,
			p.y - 12
		);
		ctx.fillStyle = "white";
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
			game.players[socket.id].x + 25 + game.players[socket.id].speed < cnv.width
		) {
			game.players[socket.id].x += game.players[socket.id].speed;
			game.players[socket.id].spriteState = 2;
			socket.emit("newSprite", 2);
		}
	}
	requestAnimationFrame(dungeonLoop)
}
function updateServer() {
	// send updates to server
	if (
		Date.now() - lastUpdate >= updateDelay &&
		game.players[socket.id] &&
		[game.players[socket.id].x, game.players[socket.id].y] != prevPos
	) {
		socket.emit("move", {
			x: game.players[socket.id].x,
			y: game.players[socket.id].y,
		});
		prevPos = [game.players[socket.id].x, game.players[socket.id].y];

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
