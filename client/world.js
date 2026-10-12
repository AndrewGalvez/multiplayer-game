(function (root) {
const definitions = {
	"lobby": {
		"players": {},
		"enemies": [],
		"backgroundImage": "sprites/bananaValley.png",
		"doors": [
			{
				"x": 450,
				"y": 0,
				"w": 100,
				"h": 50,
				"to": "dungeon",
				"newPos": {
					"x": 450,
					"y": 675
				}
			}
		]
	},
	"dungeon": {
		"players": {},
		"enemies": [],
		"backgroundImage": "sprites/dungeonBackground.png",
		"doors": [
			{
				"x": 450,
				"y": 750,
				"w": 100,
				"h": 50,
				"to": "lobby",
				"newPos": {
					"x": 450,
					"y": 51
				}
			}
		]
	}
};
const api = { createRooms: () => JSON.parse(JSON.stringify(definitions)) };
if (typeof module !== "undefined" && module.exports) module.exports = api;
else root.World = api;
})(globalThis);

