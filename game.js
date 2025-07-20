const { Chess } = require('chess.js');

class Game {
    constructor() {
        this.chess = new Chess();
        this.players = {}; // Store players by socket ID
        this.turn = 'w';
    }

    addPlayer(socketId) {
        const colors = ['w', 'b'];
        const existingColors = Object.values(this.players);
        const availableColor = colors.find(c => !existingColors.includes(c));
        if (availableColor) {
            this.players[socketId] = availableColor;
            return availableColor;
        }
        return null;
    }

    move(move) {
        const result = this.chess.move(move);
        if (result) {
            this.turn = this.chess.turn();
        }
        return result;
    }
}

module.exports = Game;