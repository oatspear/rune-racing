// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import type { PlayerId, RuneClient } from "rune-sdk"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TRACK_LENGTH = 2400
export const MAX_SPEED = 240 // units per second
export const BOOST_SPEED = MAX_SPEED * 1.5 // units per second
const ACCELERATION = MAX_SPEED / 1.5 // reach max speed in 1.5 seconds

export const NUM_LANES = 5 // Total lanes available (0-4)
const MAX_LANE = NUM_LANES - 1 // Maximum lane index (4)

export const PLAYER_RADIUS = 10
export const OBSTACLE_RADIUS = 10
const COLLISION_THRESHOLD = PLAYER_RADIUS + OBSTACLE_RADIUS

const QUEUED_ACTION_DURATION = 250

export const KNOCKBACK_RECOVERY_TIME_MS = 400 // ms

type Persisted = {
  sessionCount: number
}

export interface Position2D {
  x: number // lane index (0-4)
  y: number // distance from start
}

type Pickup = Position2D

interface Obstacle extends Position2D {
  indestructible: boolean
}

export enum PlayerAction {
  NONE = 0,
  TURN_LEFT,
  TURN_RIGHT,
}

export enum PlayableCharacter {
  BLUE,
  RED,
  GREEN,
  PURPLE,
}

export interface PlayerState {
  character: PlayableCharacter
  x: number // lane index (0-4)
  y: number // distance from start
  speed: number
  score: number
  knockbackEndTime?: number // When knockback effect should end
  queuedAction: PlayerAction
  queueExpireTime: number // When this queued action should be dropped
  boosting: boolean
}

export interface GameState {
  players: Record<PlayerId, PlayerState>
  playerIds: PlayerId[]
  lastUpdateTime: number
  pickups: Pickup[]
  obstacles: Obstacle[]
}

// -----------------------------------------------------------------------------
// Physics and Logic
// -----------------------------------------------------------------------------

function collidesWithAny(x: number, y: number, objects: Position2D[]): boolean {
  for (const obj of objects) {
    if (obj.x === x && Math.abs(obj.y - y) < COLLISION_THRESHOLD) {
      return true
    }
  }
  return false
}

function enqueueAction(action: PlayerAction, player: PlayerState): void {
  player.queuedAction = action
  player.queueExpireTime = Rune.gameTime() + QUEUED_ACTION_DURATION
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

type GameActions = {
  turnLeft: () => void
  turnRight: () => void
  startBoost: () => void
  stopBoost: () => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions, Persisted>
}

function setup(allPlayerIds: PlayerId[]): GameState {
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
  // randomly assign characters
  const characters = [
    PlayableCharacter.BLUE,
    PlayableCharacter.RED,
    PlayableCharacter.GREEN,
    PlayableCharacter.PURPLE,
  ]
  characters.sort(() => Math.random() - 0.5)
  allPlayerIds.forEach((playerId) => {
    players[playerId] = {
      character: characters.pop()!,
      x: lanes.splice(0, 1)[0], // Start in assigned lane
      y: -MAX_SPEED / 2,
      speed: 0, // Start from rest
      score: 0, // Start with no pickups collected
      knockbackEndTime: undefined, // No knockback at start
      queuedAction: PlayerAction.NONE, // No queued action at start
      queueExpireTime: 0, // No action expiration at start
      boosting: false,
    }
  })

  // Create 5 pickups along the track
  const pickups: Pickup[] = []
  for (let i = 0; i < 5; i++) {
    pickups.push({
      x: Math.floor(Math.random() * 5), // Random lane 0-4
      y: 300 + (TRACK_LENGTH - 600) * (i / 4), // Spread evenly along track, avoiding start and end
    })
  }

  // Create obstacles along the track
  const obstacles: Obstacle[] = []

  // Add 8 destructible obstacles
  for (let i = 0; i < 8; i++) {
    obstacles.push({
      x: Math.floor(Math.random() * 5), // Random lane 0-4
      y: 420 + (TRACK_LENGTH - 800) * (i / 7), // Spread evenly, avoiding start/end and pickup zones
      indestructible: false,
    })
  }

  // Add 8 indestructible obstacles
  for (let i = 0; i < 8; i++) {
    obstacles.push({
      x: Math.floor(Math.random() * 5), // Random lane 0-4
      y: 400 + (TRACK_LENGTH - 800) * (i / 7), // Spread evenly, different spacing than destructibles
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
}

function updatePlayer(
  game: GameState,
  playerId: PlayerId,
  player: PlayerState,
  currentTime: number,
  deltaTime: number
): void {
  // Check for collisions before moving
  let hasCollision = false

  // Check for obstacle collisions
  for (let i = game.obstacles.length - 1; i >= 0; i--) {
    const obstacle = game.obstacles[i]
    if (
      Math.abs(obstacle.y - player.y) < COLLISION_THRESHOLD &&
      obstacle.x === player.x
    ) {
      hasCollision = true
      if (obstacle.indestructible) {
        // Indestructible obstacles cause knockback and stop boosting
        const knockback =
          PLAYER_RADIUS + PLAYER_RADIUS * (player.speed / MAX_SPEED)
        player.speed = 0
        player.boosting = false // Turn off boosting on hard wall collision
        player.knockbackEndTime = currentTime + KNOCKBACK_RECOVERY_TIME_MS
        player.y = player.y - knockback
      } else {
        game.obstacles.splice(i, 1)
        if (!player.boosting) {
          player.speed *= 0.5 // Reduce speed to half
        }
      }
      break // Exit after first collision
    }
  }

  // Only check pickups and update movement if no obstacle collision
  if (!hasCollision) {
    // Check for pickup collisions
    for (let i = game.pickups.length - 1; i >= 0; i--) {
      const pickup = game.pickups[i]
      if (
        Math.abs(pickup.y - player.y) < COLLISION_THRESHOLD &&
        pickup.x === player.x
      ) {
        game.pickups.splice(i, 1)
        player.score += 1
      }
    }

    // Handle movement
    if (player.knockbackEndTime && player.knockbackEndTime > currentTime) {
      // During knockback, player stays at knocked back position with zero speed
      player.speed = 0
      // Ensure boosting stays off during knockback
      player.boosting = false
    } else if (player.knockbackEndTime) {
      // Knockback just ended, resume from knocked back position
      player.knockbackEndTime = undefined
      player.speed = 0
      // Keep boosting off; player must release and press boost again
    } else {
      // Try queued actions first if they exist
      if (player.queuedAction) {
        if (currentTime >= player.queueExpireTime) {
          player.queuedAction = PlayerAction.NONE // Clear expired actions
        }
        switch (player.queuedAction) {
          case PlayerAction.TURN_LEFT:
            turnLeft(game, playerId)
            break
          case PlayerAction.TURN_RIGHT:
            turnRight(game, playerId)
            break
        }
      }

      // Accelerate and move
      if (player.boosting) {
        player.speed = BOOST_SPEED
      } else {
        player.speed = Math.min(
          MAX_SPEED,
          player.speed + ACCELERATION * deltaTime
        )
      }
      player.y += player.speed * deltaTime
    }
  }
}

function updateGame(game: GameState): void {
  const currentTime = Rune.gameTime()
  const deltaTime = (currentTime - game.lastUpdateTime) / 1000 // Convert to seconds
  game.lastUpdateTime = currentTime

  // Update all players' speeds and positions using delta time
  for (const [playerId, player] of Object.entries(game.players)) {
    updatePlayer(game, playerId, player, currentTime, deltaTime)
  }

  // TODO remove from the game any pickups or obstacles that are behind all players.

  // Check if any player has finished
  const winners = Object.entries(game.players)
    .filter(([, player]) => player.y >= TRACK_LENGTH + MAX_SPEED / 4)
    .map(([playerId]) => playerId)

  if (winners.length > 0) {
    const results: Record<PlayerId, "WON" | "LOST"> = {}
    game.playerIds.forEach((id) => {
      results[id] = winners.includes(id) ? "WON" : "LOST"
    })
    Rune.gameOver({ players: results })
  }
}

function turnLeft(game: GameState, playerId: PlayerId): void {
  const player = game.players[playerId]
  if (!player || player.x <= 0) return // Only check lane bounds

  // Queue the action if in knockback
  if (player.knockbackEndTime) {
    return enqueueAction(PlayerAction.TURN_LEFT, player)
  }

  // Clear any existing queued action since player tried a new move
  player.queuedAction = PlayerAction.NONE

  // Check for obstacles in target lane
  const targetLane = player.x - 1

  // Queue the action if blocked by obstacle
  if (collidesWithAny(targetLane, player.y, game.obstacles)) {
    enqueueAction(PlayerAction.TURN_LEFT, player)
  } else {
    player.x = targetLane
  }
}

function turnRight(game: GameState, playerId: PlayerId): void {
  const player = game.players[playerId]
  if (!player || player.x >= MAX_LANE) return // Only check lane bounds

  // Queue the action if in knockback
  if (player.knockbackEndTime) {
    return enqueueAction(PlayerAction.TURN_RIGHT, player)
  }

  // Clear any existing queued action since player tried a new move
  player.queuedAction = PlayerAction.NONE

  // Check for obstacles in target lane
  const targetLane = player.x + 1

  // Queue the action if blocked by obstacle
  if (collidesWithAny(targetLane, player.y, game.obstacles)) {
    enqueueAction(PlayerAction.TURN_RIGHT, player)
  } else {
    player.x = targetLane
  }
}

function startBoost(game: GameState, playerId: PlayerId): void {
  const player = game.players[playerId]
  if (!player) return
  // Only allow boosting if not in knockback
  if (!player.knockbackEndTime) {
    player.boosting = true
  }
}

function stopBoost(game: GameState, playerId: PlayerId): void {
  const player = game.players[playerId]
  if (!player) return
  player.boosting = false
}

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 4,
  updatesPerSecond: 30,
  persistPlayerData: true,
  setup,
  update: ({ game }) => updateGame(game),
  actions: {
    turnLeft: (_params, { game, playerId }) => turnLeft(game, playerId),
    turnRight: (_params, { game, playerId }) => turnRight(game, playerId),
    startBoost: (_params, { game, playerId }) => startBoost(game, playerId),
    stopBoost: (_params, { game, playerId }) => stopBoost(game, playerId),
  },
})
