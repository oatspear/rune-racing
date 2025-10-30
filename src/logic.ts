// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import type { PlayerId, RuneClient } from "rune-sdk"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const PLAYER_RADIUS = 8
export const OBSTACLE_RADIUS = 8
const COLLISION_THRESHOLD = (((PLAYER_RADIUS + OBSTACLE_RADIUS) / 2) * 1.5) | 0

export const MAX_SPEED = PLAYER_RADIUS * 30 // units per second
export const BOOST_SPEED = MAX_SPEED * 1.5 // units per second
const ACCELERATION = MAX_SPEED / 1.5 // reach max speed in 1.5 seconds
const TRACK_LENGTH = MAX_SPEED * 10

export const NUM_LANES = 5 // Total lanes available (0-4)
const MAX_LANE = NUM_LANES - 1 // Maximum lane index (4)

export const VISION_RANGE = MAX_SPEED * 3 // How far ahead players can see (3 seconds at max speed)

const QUEUED_ACTION_DURATION = 800

export const KNOCKBACK_RECOVERY_TIME_MS = 400 // ms
const STRIKE_RANGE_BEHIND = MAX_SPEED // units to scan behind for targets
const STRIKE_COOLDOWN_MS = 2000 // 2 second cooldown between strikes

type Persisted = {
  sessionCount: number
}

export enum GamePhase {
  CHARACTER_SELECT,
  RACING,
}

export interface Position2D {
  x: number // lane index (0-4)
  y: number // distance from start
}

type Pickup = Position2D

interface Obstacle extends Position2D {
  indestructible: boolean
}

export const PlayerAction = {
  NONE: { type: "move", direction: 0 },
  TURN_LEFT: { type: "move", direction: -1 },
  TURN_RIGHT: { type: "move", direction: 1 },
} as const

export type PlayerAction =
  | {
      type: "move"
      direction: number
    }
  | {
      type: "boost"
    }
  | {
      type: "strike"
    }

export enum PlayableCharacter {
  BLUE,
  RED,
  GREEN,
  PURPLE,
}

export interface PlayerState extends Position2D {
  character: PlayableCharacter | null
  ready: boolean
  speed: number
  score: number
  knockbackEndTime: number | undefined
  queuedAction: PlayerAction
  queueExpireTime: number
  boosting: boolean
  lastStrikeTime?: number // Timestamp of last strike used (for cooldown)
}

export interface StrikeEvent {
  strikerId: PlayerId
  targetId: PlayerId
  timestamp: number
}

export interface GameState {
  phase: GamePhase
  players: Record<PlayerId, PlayerState>
  playerIds: PlayerId[]
  lastUpdateTime: number
  pickups: Pickup[]
  obstacles: Obstacle[]
  lastStrike?: StrikeEvent
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

function applyKnockback(target: PlayerState, currentTime: number): void {
  // Calculate knockback distance based on current speed
  const knockback = PLAYER_RADIUS + PLAYER_RADIUS * (target.speed / MAX_SPEED)
  // Reset speed and boost
  target.speed = 0
  target.boosting = false
  // Set or refresh knockback timer
  target.knockbackEndTime = currentTime + KNOCKBACK_RECOVERY_TIME_MS
  // Apply knockback distance
  target.y = target.y - knockback
}

function enqueueAction(action: PlayerAction, player: PlayerState): void {
  player.queuedAction = action
  player.queueExpireTime = Rune.gameTime() + QUEUED_ACTION_DURATION
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

type GameActions = {
  selectCharacter: (params: { character: PlayableCharacter | null }) => void
  toggleReady: () => void
  turnLeft: () => void
  turnRight: () => void
  startBoost: () => void
  stopBoost: () => void
  strike: () => void
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
      character: characters.pop() || null,
      ready: false,
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
    phase: GamePhase.CHARACTER_SELECT,
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
        // applyKnockback(player, currentTime)
        player.speed = 0
        // Ensure boosting stays off during knockback
        player.boosting = false
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

  // Only update player positions during the racing phase
  if (game.phase === GamePhase.RACING) {
    // Update all players' speeds and positions using delta time
    for (const [playerId, player] of Object.entries(game.players)) {
      updatePlayer(game, playerId, player, currentTime, deltaTime)
    }
  }

  // TODO remove from the game any pickups or obstacles that are behind all players.

  // Only check for winners during the racing phase
  if (game.phase === GamePhase.RACING) {
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

function strike(game: GameState, playerId: PlayerId): void {
  const player = game.players[playerId]
  if (!player) return

  // Cannot strike while in knockback
  if (player.knockbackEndTime && player.knockbackEndTime > Rune.gameTime()) {
    return
  }

  // Check cooldown
  const currentTime = Rune.gameTime()
  if (
    player.lastStrikeTime &&
    currentTime - player.lastStrikeTime < STRIKE_COOLDOWN_MS
  ) {
    return // Still on cooldown
  }

  // Find the closest target in range
  let closestTarget: PlayerState | null = null
  let minDistance = Infinity

  // List all potential targets
  for (const [targetId, target] of Object.entries(game.players)) {
    if (targetId === playerId) continue // Skip self

    // Check if target is in range (behind to unlimited forward)
    const distance = target.y - player.y
    if (distance < -STRIKE_RANGE_BEHIND) continue

    // Update closest target if this one is closer
    if (Math.abs(distance) < Math.abs(minDistance)) {
      closestTarget = target
      // eslint-disable-next-line rune/no-global-scope-mutation
      minDistance = distance
    }
  }

  // If we found a target, strike them
  if (closestTarget) {
    applyKnockback(closestTarget, currentTime)
    player.lastStrikeTime = currentTime

    // Find the target's ID
    const targetId = Object.entries(game.players).find(
      ([, p]) => p === closestTarget
    )?.[0]

    if (targetId) {
      game.lastStrike = {
        strikerId: playerId,
        targetId,
        timestamp: currentTime,
      }
    }
  }
}

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 4,
  updatesPerSecond: 30,
  persistPlayerData: true,
  setup,
  update: ({ game }) => updateGame(game),
  actions: {
    selectCharacter: ({ character }, { game, playerId }) => {
      const player = game.players[playerId]
      if (!player || game.phase !== GamePhase.CHARACTER_SELECT) return

      // If selecting null (deselecting) or a new character
      if (
        character === null ||
        !Object.values(game.players).some(
          (p: PlayerState) => p.character === character
        )
      ) {
        player.character = character
        // Unready when changing character
        player.ready = false
      }
    },
    toggleReady: (_params, { game, playerId }) => {
      const player = game.players[playerId]
      if (!player || game.phase !== GamePhase.CHARACTER_SELECT) return
      if (player.character === null) return // Can't ready up without a character

      player.ready = !player.ready

      // Check if everyone is ready
      const allReady = Object.values(game.players).every(
        (p: PlayerState) => p.ready && p.character !== null
      )

      if (allReady) {
        game.phase = GamePhase.RACING
        // Randomly assign lanes like before
        const lanes = Array.from({ length: game.playerIds.length }, (_, i) => {
          if (game.playerIds.length >= 4) {
            return i % 2 === 0 ? 1 : 3
          } else if (game.playerIds.length === 3) {
            return i + 1
          } else {
            return i === 0 ? 1 : 3
          }
        })

        // Update player positions
        for (const playerId of game.playerIds) {
          const player = game.players[playerId]
          player.x = lanes.splice(0, 1)[0]
          player.y = -MAX_SPEED / 2
        }
      }
    },
    turnLeft: (_params, { game, playerId }) => {
      if (game.phase === GamePhase.RACING) turnLeft(game, playerId)
    },
    turnRight: (_params, { game, playerId }) => {
      if (game.phase === GamePhase.RACING) turnRight(game, playerId)
    },
    startBoost: (_params, { game, playerId }) => {
      if (game.phase === GamePhase.RACING) startBoost(game, playerId)
    },
    stopBoost: (_params, { game, playerId }) => {
      if (game.phase === GamePhase.RACING) stopBoost(game, playerId)
    },
    strike: (_params, { game, playerId }) => {
      if (game.phase === GamePhase.RACING) strike(game, playerId)
    },
  },
})
