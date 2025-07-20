const socket = io();
let board = null;
const game = new Chess();
const statusEl = $('#status');
const turnEl = $('#turn');
const playerColorEl = $('#playerColor');
let gameId = null;
let playerColor = null;
let selectedSquare = null;

const isMobile = () => window.innerWidth <= 768;

const highlightLegalMoves = (square) => {
    const moves = game.moves({ square: square, verbose: true });
    $('.square-55d63').removeClass('highlight-legal');
    moves.forEach(move => {
        $(`.square-${move.to}`).addClass('highlight-legal');
    });
};

const onSquareClick = (square, piece) => {
    if (selectedSquare) {
        const move = game.move({ from: selectedSquare, to: square, promotion: 'q' });
        if (move) {
            socket.emit('move', { gameId, move });
        }
        selectedSquare = null;
        $('.square-55d63').removeClass('highlight-legal');
    } else {
        if (piece && game.turn() === playerColor &&
            ((game.turn() === 'w' && piece.search(/^w/) !== -1) ||
             (game.turn() === 'b' && piece.search(/^b/) !== -1))) {
            selectedSquare = square;
            highlightLegalMoves(square);
        }
    }
};

const onDragStart = (source, piece, position, orientation) => {
    if (isMobile()) return false;
    if (game.game_over() || (game.turn() !== playerColor) ||
        (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
};

const onDrop = (source, target) => {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';
    socket.emit('move', { gameId, move });
};

const onSnapEnd = () => {
    board.position(game.fen());
};

const updateStatus = () => {
    let status = '';
    const moveColor = game.turn() === 'b' ? 'Black' : 'White';

    if (game.in_checkmate()) {
        status = `Checkmate! ${moveColor === 'White' ? 'Black' : 'White'} wins!`;
    } else if (game.in_draw()) {
        status = 'Game Over: Draw!';
    } else {
        status = `${moveColor} to move`;
        if (game.in_check()) {
            status += `, ${moveColor} is in check`;
        }
    }

    statusEl.html(status);
    turnEl.html(moveColor);
};

const setupBoard = () => {
    const config = {
        draggable: !isMobile(),
        position: game.fen(),
        orientation: playerColor === 'w' ? 'white' : 'black',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        onSquareClick: isMobile() ? onSquareClick : undefined,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('chessboard', config);
};

const initGame = (color) => {
    playerColor = color;
    playerColorEl.text(playerColor === 'w' ? 'White' : 'Black');
    $('#lobby').hide();
    $('#game-room').show();

    setupBoard();
    updateStatus();

    $(window).on('resize', () => {
        if (board) {
            board.destroy();
            setupBoard();
        }
    });
};

$('#createGame').on('click', () => {
    socket.emit('createGame');
});

$('#joinGame').on('click', () => {
    const id = $('#gameIdInput').val();
    socket.emit('joinGame', id);
});

socket.on('gameCreated', (data) => {
    gameId = data.gameId;
    $('#gameIdDisplay').text(gameId);
    $('#gameRoomIdDisplay').text(gameId);
    $('#waitingMessage').show();
});

socket.on('startGame', (data) => {
    $('#waitingMessage').hide();
    gameId = data.gameId;
    game.load(data.fen);
    const myColor = data.players[socket.id];
    initGame(myColor);
    board.position(data.fen);
    updateStatus();
});

socket.on('move', (fen) => {
    game.load(fen);
    board.position(fen);
    updateStatus();
});

socket.on('error', (msg) => {
    alert(msg);
});

$('#send-chat').on('click', () => {
    const message = $('#chat-input').val();
    if (message) {
        socket.emit('chatMessage', { gameId, message });
        $('#chat-input').val('');
    }
});

$('#chat-input').on('keypress', (e) => {
    if (e.which === 13) {
        $('#send-chat').click();
    }
});

socket.on('chatMessage', (data) => {
    $('#chat-messages').append(`<div><strong>${data.sender}:</strong> ${data.message}</div>`);
    $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
});

socket.on('opponentDisconnected', () => {
    alert('Your opponent has disconnected. The game has ended.');
    location.reload();
});