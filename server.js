
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Game = require('./game.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

const games = {};

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('createGame', () => {
        const gameId = Math.random().toString(36).substr(2, 9);
        console.log(`Game created with ID: ${gameId}`);
        games[gameId] = new Game();
        const color = games[gameId].addPlayer(socket.id);
        socket.join(gameId);
        socket.emit('gameCreated', { gameId, color });
        console.log('Current games:', Object.keys(games));
    });

    socket.on('joinGame', (gameId) => {
        console.log(`Attempting to join game with ID: ${gameId}`);
        console.log('Current games:', Object.keys(games));
        const game = games[gameId];
        if (game && Object.keys(game.players).length < 2) {
            if (Object.keys(game.players).includes(socket.id)) {
                socket.emit('error', 'You are already in this game.');
                return;
            }
            const color = game.addPlayer(socket.id);
            console.log(`Player ${socket.id} joined game ${gameId}. Players in game: ${Object.keys(game.players).length}`);
            socket.join(gameId);
            io.to(gameId).emit('startGame', { gameId: gameId, fen: game.chess.fen(), players: game.players });
        } else {
            socket.emit('error', 'Game not found or full');
        }
    });

    socket.on('move', (data) => {
        console.log('Server: Received move event:', data);
        const { gameId, move } = data;
        const game = games[gameId];
        if (game && Object.keys(game.players).includes(socket.id)) {
            const result = game.move(move);
            if (result) {
                io.to(gameId).emit('move', game.chess.fen());
            }
        }
    });

    socket.on('chatMessage', (data) => {
        const { gameId, message } = data;
        const game = games[gameId];
        if (game) {
            const senderColor = game.players[socket.id];
            const displayColor = senderColor === 'w' ? 'White' : 'Black';
            io.to(gameId).emit('chatMessage', { sender: displayColor, message: message });
        }
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
        for (const gameId in games) {
            const game = games[gameId];
            if (Object.keys(game.players).includes(socket.id)) {
                // Remove the disconnected player from the game
                delete game.players[socket.id];
                console.log(`Player ${socket.id} disconnected from game ${gameId}. Remaining players: ${Object.keys(game.players).length}`);

                // Notify the other player if they exist
                if (Object.keys(game.players).length > 0) {
                    const otherPlayerSocketId = Object.keys(game.players)[0];
                    io.to(otherPlayerSocketId).emit('opponentDisconnected');
                } else {
                    // If no players left, delete the game
                    delete games[gameId];
                    console.log(`Game ${gameId} deleted due to no players.`);
                }
                break; // Exit loop once the game is found and handled
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
