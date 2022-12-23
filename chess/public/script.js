const newGameButton = document.getElementById('newGameButton');
const boardElement = document.getElementById('board');
const loadGameButton = document.getElementById('loadGameButton');

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
      // async!!!
      if (!makeMove(source, target)) {
        return 'snapback';
      }
    },
  });
}

async function newGame() {
  // Check if the error message element exists
  const errorMessage = document.getElementById('errorMessage');
  if (errorMessage) {
    // If the error message element exists, remove it from the DOM
    errorMessage.parentNode.removeChild(errorMessage);
  }

  const response = await fetch('/new');
  if (response.ok) {
    const gameId = sanitizeGameId(await response.text());
    localStorage.setItem('gameId', gameId);
    const stateResponse = await fetch(`/state?gameId=${gameId}`);
    if (stateResponse.ok) {
      const state = await stateResponse.json();
      const { fen, engine } = state;
      renderBoard(fen);


      // Update the game ID link element with the current game ID
      const gameIdDisplay = document.getElementById('gameIdDisplay');
      gameIdDisplay.textContent = `Game ID: ${gameId}`;

      // Get the current URL
      const currentUrl = new URL(window.location.href);

      // Set the game ID as a query parameter in the URL
      currentUrl.searchParams.set('gameId', gameId);

      // Update the href attribute of the game ID link element with the updated URL
      gameIdDisplay.href = currentUrl.href;
      console.log(currentUrl.href)

    } else {
      console.error(`Error getting game state: ${stateResponse.statusText}`);
    }
  } else {
    console.error(`Error creating new game: ${response.statusText}`);
  }
}


function makeMove(from, to) {
  const gameId = localStorage.getItem('gameId');
  if (!gameId) {
    console.error('No game ID found');
    return false;
  }

  /**
   * Store the current fen so we can use it later
   * when the computer move fails to revert
   */
  const prevFen = game.fen();

  const move = game.move({ from, to });
  if (move === null) {
    console.error('Invalid move');
    return false;
  }

  /**
   * The async function does its own snapback since the onDrop function
   * does not support async fn calls
   */
  (async () => {
    const response = await fetch(`/move?gameId=${gameId}&from=${from}&to=${to}`);
  
    if (response.ok && response.status === 200) {
      const computerMove = await response.json();
      console.log(computerMove);
  
      game.move(computerMove);
      
      /**
       * Update the board
       */
      board.position(game.fen(), true);
  
      return true;
    } 
    
    /** 
     * And revert back to original position
     */
    game.load(prevFen)
    board.position(prevFen, true);

    console.error(`Error making move: ${response.statusText}`);
  })();

  return true;
}

async function loadGame(event) {
  event.preventDefault();
  const gameIdInput = document.getElementById('gameIdInput');
  const currentUrl = new URL(window.location.href);
  
  const gameId = sanitizeGameId(
    gameIdInput.value || currentUrl.searchParams.get('gameId')
  );

  if (!gameId) {
    return
  }

  const stateResponse = await fetch(`/state?gameId=${gameId}`);
  if (stateResponse.ok) {
    const state = await stateResponse.json();
    const { fen, engine } = state;
    renderBoard(fen);

    // Update the game ID link element with the current game ID
    const gameIdDisplay = document.getElementById('gameIdDisplay');
    gameIdDisplay.textContent = `Game ID: ${gameId}`;
    gameIdDisplay.href = currentUrl.href;
  } else if (stateResponse.status === 404) {
    // Check if the error message element already exists
    const errorMessage = document.getElementById('errorMessage');
    if (!errorMessage) {
      // If the error message element does not exist, create it
      const errorMessage = document.createElement('p');
      errorMessage.textContent = 'Game ID not found';
      errorMessage.style.color = 'red';
      errorMessage.id = 'errorMessage';
      const controls = document.getElementById('controls');
      controls.appendChild(errorMessage);
    }
  } else {
    console.error(`Error getting game state: ${stateResponse.statusText}`);
  }
}

function sanitizeGameId(gameId) {
  // Parse the gameId parameter as a number
  const parsedGameId = Number(gameId);

  // Check that the parsed gameId is a finite number
  if (Number.isFinite(parsedGameId)) {
    return parsedGameId;
  } else {
    // If the parsed gameId is not a finite number, return null
    return null;
  }
}


newGameButton.addEventListener('click', newGame);
loadGameButton.addEventListener('click', loadGame);

window.addEventListener('load', loadGame);