import type { PlayerId, RuneClient } from "rune-sdk"

const TRACK_LENGTH = 2400
export const MAX_SPEED = 240 // units per second
const ACCELERATION = MAX_SPEED / 1.5 // reach max speed in 1.5 seconds

interface Pickup {
  id: number
  lane: number
  y: number
  collected: boolean
}

interface Obstacle {
  id: number
  lane: number
  y: number
  destroyed: boolean
  indestructible: boolean
}

export interface PlayerState {
  position: {
    x: number // lane index (0-4)
    y: number // distance from start
  }
  speed: number
  score: number
  knockbackEndTime?: number // When knockback effect should end
  queuedAction?: {
    type: "turnLeft" | "turnRight"
    expireTime: number // When this queued action should be dropped
  }
}

export interface GameState {
  players: Record<PlayerId, PlayerState>
  playerIds: PlayerId[]
  lastUpdateTime: number
  pickups: Pickup[]
  obstacles: Obstacle[]
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
    const players: Record<PlayerId, PlayerState> = {}

    // Initialize all players at starting positions with zero speed
    const lanes: number[] = [2, 2, 2, 2] // for each player
    if (allPlayerIds.length >= 4) {
      lanes[0] = 1 // Player 1 in second lane
      lanes[1] = 3 // Player 2 in fourth lane
      lanes[2] = 1 // Player 3 in second lane
      lanes[3] = 3 // Player 4 in fourth lane
    } else if (allPlayerIds.length === 3) {
      lanes[0] = 1 // Player 1 in second lane
      lanes[1] = 2 // Player 2 in middle lane
      lanes[2] = 3 // Player 3 in fourth lane
    } else if (allPlayerIds.length === 2) {
      lanes[0] = 1 // Player 1 in second lane
      lanes[1] = 3 // Player 2 in fourth lane
    }
    allPlayerIds.forEach((playerId) => {
      players[playerId] = {
        position: { x: lanes.splice(0, 1)[0], y: -MAX_SPEED / 2 }, // Start in assigned lane
        speed: 0, // Start from rest
        score: 0, // Start with no pickups collected
      }
    })

    // Create 5 pickups along the track
    const pickups: Pickup[] = []
    for (let i = 0; i < 5; i++) {
      pickups.push({
        id: i,
        lane: Math.floor(Math.random() * 5), // Random lane 0-4
        y: 300 + (TRACK_LENGTH - 600) * (i / 4), // Spread evenly along track, avoiding start and end
        collected: false,
      })
    }

    // Create obstacles along the track
    const obstacles: Obstacle[] = []

    // Add 8 destructible obstacles
    for (let i = 0; i < 8; i++) {
      obstacles.push({
        id: i,
        lane: 2, // Math.floor(Math.random() * 5), // Random lane 0-4
        y: 420 + (TRACK_LENGTH - 800) * (i / 7), // Spread evenly, avoiding start/end and pickup zones
        destroyed: false,
        indestructible: false,
      })
    }

    // Add 8 indestructible obstacles
    for (let i = 0; i < 8; i++) {
      obstacles.push({
        id: i + 8,
        lane: 2, // Math.floor(Math.random() * 5), // Random lane 0-4
        y: 400 + (TRACK_LENGTH - 800) * (i / 7), // Spread evenly, different spacing than destructibles
        destroyed: false,
        indestructible: true,
      })
    }

    return {
      players,
      playerIds: allPlayerIds,
      lastUpdateTime: Rune.gameTime(),
      pickups,
      obstacles,
    }
  },
  update: ({ game }) => {
    const currentTime = Rune.gameTime()
    const deltaTime = (currentTime - game.lastUpdateTime) / 1000 // Convert to seconds
    game.lastUpdateTime = currentTime

    // Update all players' speeds and positions using delta time
    Object.entries(game.players).forEach(([, player]) => {
      // Try queued actions first if they exist
      if (player.queuedAction && currentTime < player.queuedAction.expireTime) {
        const targetLane =
          player.queuedAction.type === "turnLeft"
            ? player.position.x - 1
            : player.position.x + 1

        if (targetLane >= 0 && targetLane <= 4 && !player.knockbackEndTime) {
          // Check for obstacles in target lane
          const hasObstacle = game.obstacles.some(
            (obstacle) =>
              !obstacle.destroyed &&
              obstacle.lane === targetLane &&
              Math.abs(obstacle.y - player.position.y) < 26
          )

          if (!hasObstacle) {
            player.position.x = targetLane
            player.queuedAction = undefined // Clear the queue on successful move
          }
        }
      } else if (player.queuedAction) {
        player.queuedAction = undefined // Clear expired actions
      }
      // Accelerate
      player.speed = Math.min(
        MAX_SPEED,
        player.speed + ACCELERATION * deltaTime
      )

      // Update position based on current speed
      player.position.y += player.speed * deltaTime

      // Check for pickup collisions
      game.pickups.forEach((pickup) => {
        if (
          !pickup.collected &&
          Math.abs(pickup.y - player.position.y) < 26 && // Player radius (16) + pickup radius (10)
          pickup.lane === player.position.x // In same lane
        ) {
          pickup.collected = true
          player.score += 1
        }
      })

      // Handle knockback state
      if (player.knockbackEndTime) {
        if (player.knockbackEndTime > currentTime) {
          // During knockback, player stays at knocked back position with zero speed
          player.speed = 0
        } else {
          // Knockback just ended, resume from knocked back position
          player.knockbackEndTime = undefined
          player.speed = 0
        }
      }

      // Check for obstacle collisions, but only if not in knockback
      if (!player.knockbackEndTime) {
        game.obstacles.forEach((obstacle) => {
          // Simple collision check based on position and radius
          if (
            !obstacle.destroyed &&
            Math.abs(obstacle.y - player.position.y) < 26 && // Player radius (16) + obstacle radius (10)
            obstacle.lane === player.position.x // In same lane
          ) {
            if (obstacle.indestructible) {
              // Instantly move player back 40 units and stop them
              player.position.y -= 40
              player.speed = 0
              player.knockbackEndTime = currentTime + 400 // 400ms recovery time
            } else {
              obstacle.destroyed = true
              player.speed *= 0.5 // Reduce speed to half
            }
          }
        })
      }
    })

    // Check if any player has finished
    const winners = Object.entries(game.players)
      .filter(([, player]) => player.position.y >= TRACK_LENGTH + MAX_SPEED / 2)
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
      if (!player || player.position.x <= 0) return // Only check lane bounds

      // Clear any existing queued action since player tried a new move
      player.queuedAction = undefined

      if (player.knockbackEndTime) {
        // Queue the action if in knockback
        player.queuedAction = {
          type: "turnLeft",
          expireTime: Rune.gameTime() + 180,
        }
        return
      }

      // Check for obstacles in target lane
      const targetLane = player.position.x - 1

      const hasObstacle = game.obstacles.some(
        (obstacle) =>
          !obstacle.destroyed &&
          obstacle.lane === targetLane &&
          Math.abs(obstacle.y - player.position.y) < 26 // Player radius (16) + obstacle radius (10)
      )

      if (!hasObstacle) {
        player.position.x = targetLane
      } else {
        // Queue the action if blocked by obstacle
        player.queuedAction = {
          type: "turnLeft",
          expireTime: Rune.gameTime() + 180,
        }
      }
    },
    turnRight: (_params, { game, playerId }) => {
      const player = game.players[playerId]
      if (!player || player.position.x >= 4) return // Only check lane bounds

      // Clear any existing queued action since player tried a new move
      player.queuedAction = undefined

      if (player.knockbackEndTime) {
        // Queue the action if in knockback
        player.queuedAction = {
          type: "turnRight",
          expireTime: Rune.gameTime() + 180,
        }
        return
      }

      // Check for obstacles in target lane
      const targetLane = player.position.x + 1

      const hasObstacle = game.obstacles.some(
        (obstacle) =>
          !obstacle.destroyed &&
          obstacle.lane === targetLane &&
          Math.abs(obstacle.y - player.position.y) < 26 // Player radius (16) + obstacle radius (10)
      )

      if (!hasObstacle) {
        player.position.x = targetLane
      } else {
        // Queue the action if blocked by obstacle
        player.queuedAction = {
          type: "turnRight",
          expireTime: Rune.gameTime() + 180,
        }
      }
    },
  },
})
