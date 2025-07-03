import type { PlayerId, RuneClient } from "rune-sdk"

export interface GameState {
  players: Record<
    PlayerId,
    {
      position: { x: number; y: number }
      speed: number
    }
  >
  playerIds: PlayerId[]
}

type GameActions = {
  accelerate: () => void
  turnLeft: () => void
  turnRight: () => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 4,
  setup: (allPlayerIds) => {
    const players: Record<
      PlayerId,
      { position: { x: number; y: number }; speed: number }
    > = {}

    // Initialize all players at starting positions
    allPlayerIds.forEach((playerId, index) => {
      players[playerId] = {
        position: { x: 0, y: 100 + index * 50 }, // Staggered start positions
        speed: 0,
      }
    })

    return {
      players,
      playerIds: allPlayerIds,
    }
  },
  actions: {
    accelerate: (_params, { game, playerId }) => {
      if (game.players[playerId]) {
        game.players[playerId].speed = Math.min(
          game.players[playerId].speed + 1,
          10
        )
      }
    },
    turnLeft: (_params, { game, playerId }) => {
      const player = game.players[playerId]
      if (player && player.position.x > 0) {
        player.position.x -= 1
      }
    },
    turnRight: (_params, { game, playerId }) => {
      const player = game.players[playerId]
      if (player && player.position.x < 4) {
        player.position.x += 1
      }
    },
  },
})
