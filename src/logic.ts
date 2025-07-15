import type { PlayerId, RuneClient } from "rune-sdk"

const TRACK_LENGTH = 2400
const MAX_SPEED = 240 // units per second
const ACCELERATION = MAX_SPEED / 1.5 // reach max speed in 1.5 seconds

export interface GameState {
  players: Record<
    PlayerId,
    {
      position: {
        x: number // lane index (0-4)
        y: number // distance from start
      }
      speed: number
    }
  >
  playerIds: PlayerId[]
  lastUpdateTime: number
}

type GameActions = {
  turnLeft: () => void
  turnRight: () => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 4,
  updatesPerSecond: 30,
  setup: (allPlayerIds) => {
    const players: Record<
      PlayerId,
      { position: { x: number; y: number }; speed: number }
    > = {}

    // Initialize all players at starting positions with zero speed
    allPlayerIds.forEach((playerId) => {
      players[playerId] = {
        position: { x: 2, y: 0 }, // Start in middle lane
        speed: 0, // Start from rest
      }
    })

    return {
      players,
      playerIds: allPlayerIds,
      lastUpdateTime: Rune.gameTime(),
    }
  },
  update: ({ game }) => {
    const currentTime = Rune.gameTime()
    const deltaTime = (currentTime - game.lastUpdateTime) / 1000 // Convert to seconds
    game.lastUpdateTime = currentTime

    // Update all players' speeds and positions using delta time
    Object.values(game.players).forEach((player) => {
      // Accelerate
      player.speed = Math.min(
        MAX_SPEED,
        player.speed + ACCELERATION * deltaTime
      )

      // Update position based on current speed
      player.position.y += player.speed * deltaTime
    })

    // Check if any player has finished
    const winners = Object.entries(game.players)
      .filter(([, player]) => player.position.y >= TRACK_LENGTH + MAX_SPEED)
      .map(([playerId]) => playerId)

    if (winners.length > 0) {
      const results: Record<PlayerId, "WON" | "LOST"> = {}
      game.playerIds.forEach((id) => {
        results[id] = winners.includes(id) ? "WON" : "LOST"
      })
      Rune.gameOver({ players: results })
    }
  },
  actions: {
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
