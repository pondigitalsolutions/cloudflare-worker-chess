import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from '__STATIC_CONTENT_MANIFEST'
const assetManifest = JSON.parse(manifestJSON)

import * as Chess from 'js-chess-engine';

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);

  if (url.pathname === '/new') {
    return newGame(env);
  } else if (url.pathname === '/move') {
    return makeMove(params.get('gameId'), params.get('from'), params.get('to'), env);    
  } else if (url.pathname === '/state') {
    return getState(params.get('gameId'), env);
  }
  else {
    return await getAssetFromKV(
      {
        request,
        waitUntil(promise) {
          return ctx.waitUntil(promise)
        },
      },
      {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: assetManifest,
      },
    )
  }
}

async function getState(gameId, env) {
  try {
    const game = JSON.parse(await env.chessState.get(gameId));

    if (game === null) {
      return new Response('Invalid game ID', { status: 404 });
    }

    return new Response(JSON.stringify(game), { status: 200 });
  } catch (error) {
    return new Response('Invalid game ID', { status: 400 });
  }
}

async function newGame(env) {
  const engine = new Chess.Game();

  /**
   * Could update this with extra settings
   */
  const fen = engine.exportFEN();
  const gameId = Date.now() + '';

  // Store the game state in the Key Value database
  try {
    const engineState = engine.exportJson();
    await env.chessState.put(gameId, JSON.stringify({ fen, engineState }));
    return new Response(gameId, { status: 200 });
  } catch (error) {
    console.log(error)
    return new Response('Error storing game', { status: 500 });
  }
}

async function makeMove(gameId, from, to, env) {
  // Retrieve the game state from the Key Value database
  let game;
  try {
    game = JSON.parse(await env.chessState.get(gameId));
  } catch (error) {
    console.log(error);
    return new Response('Invalid game ID', { status: 400 });
  }

  const { fen, engineState } = game;
  
  const engine = new Chess.Game(engineState);
  
  // Is this required?
  //engine.setFen(fen);

  // Make the player's move
  try {
    console.log({from, to});
    engine.move(from, to);
  } catch (error) {
    console.log(error)
    return new Response('Invalid move', { status: 400 });
  }

  // Make the computer's move
  const lastMove = engine.aiMove();
  console.log(lastMove);

  const updatedFen = engine.exportFEN();

  // Update the game state in the Key Value database
  try {
    const engineState = engine.exportJson();
    await env.chessState.put(gameId, JSON.stringify({ fen: updatedFen, engineState }));

    /**
     * Convert to lower case correct notation so frontend chess engine
     * gets valid moves
     */
    return new Response(
      JSON.stringify({ 
        from: Object.keys(lastMove)[0].toLowerCase(), 
        to: Object.values(lastMove)[0].toLowerCase()
      }), 
      { status: 200 }
    );
  } catch (error) {
    console.log(error)
    return new Response('Error updating game', { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx) {
    return await handleRequest(request, env, ctx).catch(
      (err) => new Response(err.stack, { status: 500 })
    )
  }
}
