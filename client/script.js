
// lol
let game = {
	players: {},
	enemies: [],
};
function moveTowards(obj, targetX, targetY, durationInSeconds) {
    // Cancel any existing movement
    if (obj.currentMovement) {
        cancelAnimationFrame(obj.currentMovement);
    }

    // Calculate the total distance to move
    const dx = targetX - obj.x;
    const dy = targetY - obj.y;
    
    // Store the starting position
    const startX = obj.x;
    const startY = obj.y;
    
    // Store start time
    const startTime = Date.now();
    
    function update() {
        // Calculate how much time has passed
        const elapsedTime = (Date.now() - startTime) / 1000;
        
        if (elapsedTime < durationInSeconds) {
            // Calculate new position based on elapsed time
            obj.x = startX + (dx * (elapsedTime / durationInSeconds));
            obj.y = startY + (dy * (elapsedTime / durationInSeconds));
            
            // Store the animation frame ID so we can cancel it if needed
            obj.currentMovement = requestAnimationFrame(update);
        } else {
            // Ensure final position is exact
            obj.x = targetX;
            obj.y = targetY;
            obj.currentMovement = null;
        }
    }
    
    // Start the movement
    obj.currentMovement = requestAnimationFrame(update);
}
console.log("if u hack ur a loser");
const querySearch = window.location.search;
function sendMessage() {
	var i = document.getElementById("chatInput");
	socket.emit("message", {
		name: game.players[socket.id].name,
		msg: i.value,
	});
	i.value = "";
}
function isMobile() {
	return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
		navigator.userAgent
	);
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

let bgImg = new Image();

function background() {
	// background
	ctx.clearRect(0, 0, cnv.width, cnv.height);
	//ctx.fillStyle = "black";
	//ctx.fillRect(0, 0, cnv.width, cnv.height);
	bgImg.src = game.backgroundImage;
	ctx.drawImage(bgImg, 0, 0, cnv.width, cnv.height);
}
var currentRoom = "lobby";
function changeRoom(room, door) {
	socket.emit("joinRoom", { r: room, d: door });
	currentRoom = room;
}

function getName(p) {
	return prompt(p + "Enter Username");
}

function getPass() {
	return prompt("Password: ");
}
function renderIMG(obj, img) {
	ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
}

let playerImage = new Image();
playerImage.src = "/client/sprites/player.png";
let doorImage = new Image();
doorImage.src = "/client/sprites/door.png";
const socket = io();

var a = getName("");
var b = getPass();
socket.emit("login", { username: a, password: b });

socket.on("currentGame", (data) => {
	game = data;
	if (!game.players[socket.id]) {
		console.warn("Player not found in game data.");
		return;
	}
});
socket.on("newPlayer", (data) => {
	game.players[data.id] = data.obj;
});

const shield = {x: 0, y: 0, w: 25, h: 25, lastX: 0, lastY: 0, visible: false}
socket.on("sendShieldData", (data) => {
	shield = data;
});

socket.on("playerDisconnect", (data) => {
	delete game.players[data];
});

socket.on("username", (data) => {
	if (!game.players[data.id]) game.players[data.id] = {};
	game.players[data.id].name = data.username;
});

socket.on("playerMessage", (data) => {
	if (data.name === undefined) return
	var a = document.getElementById("chat-messages");
	var b = document.createElement("p");
	b.textContent = data.name.toString() + ": " + data.msg.toString();
	a.appendChild(b);
	if (a.childElementCount >= 16) {
		a.removeChild(a.firstElementChild);
	}
});

socket.on("wrongPassword", (data) => {
	var a = getName("Wrong Password, ");
	var b = getPass();
	socket.emit("login", { username: a, password: b });
});

socket.on("accountDoesNotExist", () => {
	while (true) {
		var a = confirm("Account Not found. Create new Account?");
		if (a) {
			var c = getName("Choose: ");
			var d = getPass();
			socket.emit("createAccount", { username: c, password: d });
			break;
		} else {
			window.location.reload();
		}
	}
});

socket.on("accountExists", () => {
	alert("Account already exists.");
	while (true) {
		var a = confirm("Create new Account?");
		if (a) {
			var c = getName("Choose: ");
			var d = getPass();
			socket.emit("createAccount", { username: c, password: d });
			break;
		} else {
			window.location.reload();
		}
	}
});

socket.on("createdAccount", () => {
	alert("Account successfully created. Please login now.");
	var a = getName("");
	var b = getPass();
	socket.emit("login", { username: a, password: b });
});

socket.on("playerMoved", (data) => {
	if (data.id == socket.id) return;
	if (!game) return;
	game.players[data.id].x = data.x;
	game.players[data.id].y = data.y;
});

var immunity = false;
var enemyImage = new Image(25, 25)
enemyImage.src = "/client/sprites/wierdEnemy.png"

socket.on("enemyMoved", (data) => {
	for(var mID of game.enemies){
		if (mID == data.id){
			mID.x = data.x;
			mID.y = data.y;
		}
	}
});
socket.on("getEnemy", (data) => {
	if (!game.enemies.some(enemy => enemy.id === data.id)){
	game.enemies.push(data);
	console.log("enemy added");
}});
socket.on("playerNewSprite", (data) => {
	game.players[data.id].spriteState = data.new;
});

socket.on("currentDEnemies", (data) => {
	game.enemies = data;
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

socket.on("enemyDelete", (data) => {
	for (var mID of game.enemies){
		if (mID == data){
			delete game.enemies[mID];
		}
	}
});
const cnv = document.getElementById("canvas");
const ctx = cnv.getContext("2d");
cnv.width = 1000;
cnv.height = 800;
socket.emit("getCnvData", cnv);

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
	if (keys["l"]) changeRoom("lobby", null);
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
		if (game.doors) {
			for (var d of game.doors) {
				if (checkCollision(a, d)) {
					console.log(`going to ${d.to}`);
					changeRoom(d.to, d);
				}
				ctx.fillStyle = "black";
				ctx.fillRect(d.x, d.y, d.w, d.h);
				ctx.fillStyle = "white";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(d.to, d.x + d.w / 2, d.y + d.h / 2);
			}
		}
		// shield
		var shieldImage = new Image(25, 25)
		shieldImage.src = "/client/sprites/shield.png"
		if (shield.visible){ctx.drawImage(shieldImage, shield.x, shield.y, shield.w, shield.h);};
		// enemies
		if (game.enemies !== undefined) {
			for (var enemy of game.enemies) {
				let renderEState = true;
				if (checkCollision(enemy, a)) {
					if (immunity === false){
					if (a.shield === false){
					returnToLobby(5);

					ctx.font = '40px Papyrus'
					ctx.fillStyle = 'Red'
					ctx.fillText("You died.", 0, 0);

					canMove["w"] = false;
					canMove["a"] = false;
					canMove["s"] = false;
					canMove["d"] = false;
					}
					else {
						socket.emit("createShield", null);
						a.shield = false;
						socket.emit("defended", {id: enemy.id, path: currentRoom});
						renderEState = false;
					}
				}
				if (renderEState === true){renderIMG(enemy, enemyImage);};
				}
			}
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
	} catch (error) {
		console.log("Error in game loop:", Error);
	}
	requestAnimationFrame(loop);
}
if (isMobile()) {
	document.getElementById("W").addEventListener("mousedown", () => {
		keys["w"] = true;
	});
	document.getElementById("A").addEventListener("mousedown", () => {
		keys["a"] = true;
	});
	document.getElementById("S").addEventListener("mousedown", () => {
		keys["s"] = true;
	});
	document.getElementById("D").addEventListener("mousedown", () => {
		keys["d"] = true;
	});
	document.getElementById("W").addEventListener("mouseup", () => {
		keys["w"] = false;
	});
	document.getElementById("A").addEventListener("mouseup", () => {
		keys["a"] = false;
	});
	document.getElementById("S").addEventListener("mouseup", () => {
		keys["s"] = false;
	});
	document.getElementById("D").addEventListener("mouseup", () => {
		keys["d"] = false;
	});
} else {
	document.getElementById("W").style.opacity = 0;
	document.getElementById("A").style.opacity = 0;
	document.getElementById("S").style.opacity = 0;
	document.getElementById("D").style.opacity = 0;
}

function returnToLobby(sec){
	setTimeout( () => {
		changeRoom("lobby", null);
	}, sec * 1000)
}

loop();

document.onkeydown = (e) => {
	keys[e.key] = true;
};
document.onkeyup = (e) => {
	keys[e.key] = false;
};
