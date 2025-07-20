const socket = io();
let board = null;
const game = new Chess();
const statusEl = $('#status');
const turnEl = $('#turn');
const playerColorEl = $('#playerColor');
let gameId = null;
let playerColor = null;
let selectedSquare = null;
const isMobile = () => {
  const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const smallScreen = window.innerWidth <= 768;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Manual override for testing - you can add ?mobile=true to URL
  const urlParams = new URLSearchParams(window.location.search);
  const forceMode = urlParams.get('mobile');
  if (forceMode === 'true') return true;
  if (forceMode === 'false') return false;
  const mobile = touchCapable || smallScreen || mobileUserAgent;
  console.log('isMobile check:', {
    mobile,
    touchCapable,
    smallScreen,
    mobileUserAgent,
    userAgent: navigator.userAgent,
    width: window.innerWidth
  });
  return mobile;
};
const highlightLegalMoves = square => {
  console.log('highlightLegalMoves called for square:', square);
  const moves = game.moves({
    square,
    verbose: true
  });
  console.log('Legal moves found:', moves.length);
  // Clear previous highlights
  $('.square-55d63').removeClass('highlight-legal');

  // Highlight destination squares
  moves.forEach(move => {
    $(`.square-${move.to}`).addClass('highlight-legal');
  });
};
const canMovePiece = piece => {
  console.log('canMovePiece check:', piece, 'gameOver:', game.game_over(), 'turn:', game.turn(), 'playerColor:', playerColor);
  if (game.game_over()) return false;
  if (game.turn() !== playerColor) return false;
  if (playerColor === 'w' && piece.search(/^b/) !== -1) return false;
  if (playerColor === 'b' && piece.search(/^w/) !== -1) return false;
  return true;
};
const setupMobileClickHandlers = () => {
  console.log('🔧 Setting up custom mobile click handlers...');

  // Remove any existing click handlers first
  $('.square-55d63').off('click.mobile');

  // Add our custom click handler
  $('.square-55d63').on('click.mobile', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const square = $(this).attr('data-square');
    const piece = board.position()[square] || null;
    console.log('🖱️ Custom mobile click:', {
      square,
      piece
    });

    // Call our click handler directly
    handleSquareClick(square, piece);
  });
};
const handleSquareClick = (square, piece) => {
  console.log('🎯 handleSquareClick called:', {
    square,
    piece,
    selectedSquare,
    isMobile: isMobile()
  });
  if (selectedSquare) {
    console.log('Attempting move from', selectedSquare, 'to', square);
    const move = game.move({
      from: selectedSquare,
      to: square,
      promotion: 'q'
    });
    if (move) {
      console.log('Move successful:', move);
      socket.emit('move', {
        gameId,
        move
      });
    } else {
      console.log('Move failed');
    }
    selectedSquare = null;
    $('.square-55d63').removeClass('highlight-legal');
  } else {
    if (piece && canMovePiece(piece)) {
      console.log('Selecting piece:', piece, 'on square:', square);
      selectedSquare = square;
      highlightLegalMoves(square);
    } else {
      console.log('Cannot select piece:', piece);
    }
  }
};
const onSquareClick = (square, piece) => {
  // This is the chessboard.js callback - keep for desktop compatibility
  console.log('🎯 onSquareClick FIRED!', {
    square,
    piece,
    selectedSquare,
    isMobile: isMobile()
  });
  handleSquareClick(square, piece);
};
const onDragStart = (source, piece, position, orientation) => {
  console.log('onDragStart called:', {
    source,
    piece,
    isMobile: isMobile()
  });
  if (isMobile()) {
    console.log('Preventing drag on mobile');
    return false;
  }
  return canMovePiece(piece);
};
const onDrop = (source, target) => {
  const move = game.move({
    from: source,
    to: target,
    promotion: 'q'
  });
  if (move === null) return 'snapback';
  socket.emit('move', {
    gameId,
    move
  });
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
  const mobile = isMobile();
  console.log('Setting up board - mobile:', mobile);
  const config = {
    draggable: !mobile,
    position: game.fen(),
    orientation: playerColor === 'w' ? 'white' : 'black',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    onSquareClick: mobile ? undefined : onSquareClick,
    // disable for mobile, use custom handler
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
  };
  console.log('Board config:', {
    draggable: config.draggable,
    hasSquareClick: !!config.onSquareClick
  });
  board = Chessboard('chessboard', config);
  console.log('🏁 Board created with config:', config);

  // Set up custom mobile click handlers
  if (mobile) {
    setTimeout(() => {
      setupMobileClickHandlers();
    }, 500); // Give the board time to render
  }
};
const initGame = color => {
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
socket.on('gameCreated', data => {
  gameId = data.gameId;
  $('#gameIdDisplay').text(gameId);
  $('#gameRoomIdDisplay').text(gameId);
  $('#waitingMessage').show();
});
socket.on('startGame', data => {
  $('#waitingMessage').hide();
  gameId = data.gameId;
  game.load(data.fen);
  const myColor = data.players[socket.id];
  initGame(myColor);
  board.position(data.fen);
  updateStatus();
});
socket.on('move', fen => {
  game.load(fen);
  board.position(fen);
  updateStatus();
});
socket.on('error', msg => {
  alert(msg);
});
$('#send-chat').on('click', () => {
  const message = $('#chat-input').val();
  if (message) {
    socket.emit('chatMessage', {
      gameId,
      message
    });
    $('#chat-input').val('');
  }
});
$('#chat-input').on('keypress', e => {
  if (e.which === 13) {
    $('#send-chat').click();
  }
});
socket.on('chatMessage', data => {
  $('#chat-messages').append(`<div><strong>${data.sender}:</strong> ${data.message}</div>`);
  $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
});
socket.on('opponentDisconnected', () => {
  alert('Your opponent has disconnected. The game has ended.');
  location.reload();
});
