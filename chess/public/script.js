const newGameButton = document.getElementById('newGameButton');
const moveForm = document.getElementById('moveForm');
const moveInput = document.getElementById('moveInput');
const boardElement = document.getElementById('board');

let board;
let game;

function renderBoard(fen) {
  game = new Chess(fen);
  board = ChessBoard(boardElement, {
    position: fen,
    
    pieceTheme: chess24_piece_theme,
    boardTheme: chess24_board_theme,
    
    draggable: true,
    dropOffBoard: 'trash',
    sparePieces: true,

    onDrop: function(source, target) {
      return makeMove(source, target);
    }
  });
}

async function newGame() {
  const response = await fetch('/new');
  if (response.ok) {
    const gameId = await response.text();
    localStorage.setItem('gameId', gameId);
    const stateResponse = await fetch(`/state?gameId=${gameId}`);
    if (stateResponse.ok) {
      const state = await stateResponse.json();
      const { fen, engine } = state;
      renderBoard(fen);
    } else {
      console.error(`Error getting game state: ${stateResponse.statusText}`);
    }
  } else {
    console.error(`Error creating new game: ${response.statusText}`);
  }
}


async function makeMove(from, to) {
  const gameId = localStorage.getItem('gameId');
  if (!gameId) {
    console.error('No game ID found');
    return false;
  }
  const move = game.move({ from, to });
  if (move === null) {
    console.error('Invalid move');
    return false;
  }

  const response = await fetch(`/move?gameId=${gameId}&from=${from}&to=${to}`);
  if (response.ok) {
    const computerMove = await response.text();
    game.move(computerMove);
    board.position(game.fen());
    return true;
  } else {
    console.error(`Error making move: ${response.statusText}`);
  }

  return false;
}

newGameButton.addEventListener('click', newGame);
moveForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = moveInput.value;
  game.move(input);
  board.position(game.fen());
  moveInput.value = '';
});
