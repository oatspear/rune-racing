// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { PlayerId } from "rune-sdk"
import {
  GameState,
  KNOCKBACK_RECOVERY_TIME_MS,
  MAX_SPEED,
  NUM_LANES,
  PlayableCharacter,
  PLAYER_RADIUS,
  PlayerState,
} from "../logic"

import { Container, Graphics, Sprite, useApp } from "@pixi/react"
import { PLAYER_COLORS, lightenColor } from "../client_constants"
import { Graphics as PixiGraphics } from "@pixi/graphics"
import { useRef } from "react"
import { LANE_MARGIN, VISIBLE_TRACK_HEIGHT } from "../client_constants"
import StrikeEffect from "./StrikeEffect"

// Import character sprites
import spriteBlue from "../assets/arrow-blue.png"
import spriteRed from "../assets/arrow-red.png"
import spriteGreen from "../assets/arrow-green.png"
import spritePurple from "../assets/arrow-purple.png"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Map character indices to imported sprites
const CHARACTER_SPRITES: Record<PlayableCharacter, string> = {
  [PlayableCharacter.BLUE]: spriteBlue,
  [PlayableCharacter.RED]: spriteRed,
  [PlayableCharacter.GREEN]: spriteGreen,
  [PlayableCharacter.PURPLE]: spritePurple,
}

type PlayersProps = {
  game: GameState
  yourPlayerId?: PlayerId
  cameraY: number
}

type TrailPoint = {
  lane: number
  worldY: number
  timestamp: number
}

type PlayerTrail = {
  points: TrailPoint[]
  lastUpdate: number
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const Players = ({ game, yourPlayerId, cameraY }: PlayersProps) => {
  const app = useApp()
  const width = app.screen.width
  const height = app.screen.height
  const laneWidth = (width - 2 * LANE_MARGIN) / NUM_LANES
  const centerY = height / 2
  const trailsRef = useRef<Record<PlayerId, PlayerTrail>>({})
  const strikeStartTimes = useRef<Record<string, number>>({})

  const now = performance.now()
  for (const playerId of Object.values(game.playerIds)) {
    if (!trailsRef.current[playerId]) {
      trailsRef.current[playerId] = {
        points: [],
        lastUpdate: now,
      }
    }
  }

  const renderStrikeEffects = () => {
    return Object.entries(game.players).map(([playerId, player]) => {
      if (
        !player.knockbackEndTime ||
        !game.lastStrike ||
        game.lastStrike.targetId !== playerId
      ) {
        return null
      }

      const lane = Math.max(0, Math.min(NUM_LANES - 1, player.x))
      const x = LANE_MARGIN + laneWidth * (lane + 0.5)
      const relativeY = player.y - cameraY
      const y = centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height
      const playerScreenRadius = (PLAYER_RADIUS / VISIBLE_TRACK_HEIGHT) * height

      if (Math.abs(relativeY) > VISIBLE_TRACK_HEIGHT / 2) return null

      const striker = game.players[game.lastStrike.strikerId]
      const strikeId = `${playerId}-${game.lastStrike.timestamp}`

      if (!strikeStartTimes.current[strikeId]) {
        strikeStartTimes.current[strikeId] = now
      }

      const timeSinceStart = now - strikeStartTimes.current[strikeId]
      const normalizedTime = Math.min(
        timeSinceStart / (KNOCKBACK_RECOVERY_TIME_MS + 100),
        1
      )

      return (
        <StrikeEffect
          key={`strike-${playerId}`}
          x={x}
          y={y}
          radius={playerScreenRadius * 2}
          time={normalizedTime}
          character={striker?.character ?? undefined}
        />
      )
    })
  }

  const renderPlayers = () => {
    const playerElements = []

    // Render other players first
    for (const [playerId, player] of Object.entries(game.players)) {
      if (playerId === yourPlayerId) continue
      const trail = trailsRef.current[playerId]
      updateTrail(trail, player, now)
      playerElements.push(
        renderPlayer(
          playerId,
          player,
          cameraY,
          height,
          laneWidth,
          centerY,
          trail,
          now
        )
      )
    }

    // Render current player last (on top)
    if (yourPlayerId && game.players[yourPlayerId]) {
      const player = game.players[yourPlayerId]
      const trail = trailsRef.current[yourPlayerId]
      updateTrail(trail, player, now)
      playerElements.push(
        renderPlayer(
          yourPlayerId,
          player,
          cameraY,
          height,
          laneWidth,
          centerY,
          trail,
          now
        )
      )
    }

    return playerElements
  }

  return (
    <>
      {/* Draw trails */}
      <Graphics
        key={`trails-${JSON.stringify(game.players)}`}
        draw={(g) => {
          g.clear()
          const now = performance.now()

          // Draw trails for all players
          for (const [playerId, player] of Object.entries(game.players)) {
            const trail = trailsRef.current[playerId]
            drawTrail(
              g,
              player,
              cameraY,
              height,
              laneWidth,
              centerY,
              trail,
              now
            )
          }
        }}
      />

      {/* Draw player sprites */}
      <Container key={`player-sprites`}>{renderPlayers()}</Container>

      {/* Draw strike effects on top */}
      {renderStrikeEffects()}
    </>
  )
}

export default Players

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function updateTrail(trail: PlayerTrail, player: PlayerState, now: number) {
  const timeSinceLastUpdate = now - trail.lastUpdate

  if (timeSinceLastUpdate > 32 && !player.knockbackEndTime) {
    trail.points.unshift({
      lane: player.x,
      worldY: player.y,
      timestamp: now,
    })
    trail.lastUpdate = now
    if (trail.points.length > 12) {
      trail.points.pop()
    }
  } else if (player.knockbackEndTime) {
    trail.points.length = 0
  }
}

function drawTrail(
  g: PixiGraphics,
  player: PlayerState,
  cameraY: number,
  height: number,
  laneWidth: number,
  centerY: number,
  trail: PlayerTrail,
  now: number
) {
  if (trail.points.length < 2 || player.knockbackEndTime) {
    return
  }

  const relativeY = player.y - cameraY
  if (Math.abs(relativeY) > VISIBLE_TRACK_HEIGHT / 2) {
    return
  }

  let speedY = 0
  let alpha = 1

  if (player.knockbackEndTime) {
    const knockbackProgress =
      (player.knockbackEndTime - now) / KNOCKBACK_RECOVERY_TIME_MS
    alpha = Math.cos(knockbackProgress * Math.PI * 4) * 0.5 + 0.5
  } else {
    speedY = player.boosting ? 40 : (player.speed / MAX_SPEED) * 40
  }

  let color =
    player.character != null && PLAYER_COLORS[player.character] != null
      ? PLAYER_COLORS[player.character]
      : 0x202020
  if (player.boosting) {
    color = lightenColor(color, 0.5)
  }

  g.lineStyle(0)
  const points = trail.points
  let p1 = { lane: player.x, worldY: player.y, timestamp: 0 }

  for (let i = 0; i < points.length; i++) {
    const p2 = points[i]

    const x1 = LANE_MARGIN + laneWidth * (p1.lane + 0.5)
    const x2 = LANE_MARGIN + laneWidth * (p2.lane + 0.5)

    const relY1 = p1.worldY - cameraY
    const relY2 = p2.worldY - cameraY

    const screenY1 = centerY - (relY1 / VISIBLE_TRACK_HEIGHT) * height + speedY
    const screenY2 = centerY - (relY2 / VISIBLE_TRACK_HEIGHT) * height + speedY

    const age = (now - p1.timestamp) / 1000
    let trailAlpha = Math.max(0, 1 - age)
    if (!player.boosting) {
      trailAlpha *= 0.6
    }
    if (player.knockbackEndTime) {
      trailAlpha *= alpha
    }

    let trailWidth = Math.max(2, 16 * (1 - i / points.length))
    if (player.boosting) {
      trailWidth *= 1.25
    }
    g.lineStyle(trailWidth, color, trailAlpha)
    g.moveTo(x1, screenY1)
    g.lineTo(x2, screenY2)
    p1 = p2
  }
}

function renderPlayer(
  playerId: PlayerId,
  player: PlayerState,
  cameraY: number,
  height: number,
  laneWidth: number,
  centerY: number,
  trail: PlayerTrail,
  now: number
) {
  const lane = Math.max(0, Math.min(NUM_LANES - 1, player.x))
  const x = LANE_MARGIN + laneWidth * (lane + 0.5)
  const relativeY = player.y - cameraY

  if (Math.abs(relativeY) > VISIBLE_TRACK_HEIGHT / 2) {
    return null
  }

  let speedY = 0
  let alpha = 1

  if (player.knockbackEndTime) {
    const knockbackProgress =
      (player.knockbackEndTime - now) / KNOCKBACK_RECOVERY_TIME_MS
    alpha = Math.cos(knockbackProgress * Math.PI * 4) * 0.5 + 0.5
  } else {
    speedY = player.boosting ? 40 : (player.speed / MAX_SPEED) * 40
  }

  const y = centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height + speedY
  const playerScreenRadius = (PLAYER_RADIUS / VISIBLE_TRACK_HEIGHT) * height

  // Get sprite image based on character
  const spriteImage =
    player.character != null && CHARACTER_SPRITES[player.character]
      ? CHARACTER_SPRITES[player.character]
      : CHARACTER_SPRITES[PlayableCharacter.BLUE]

  // Apply color tint when boosting
  let tint = 0xffffff // White (no tint)
  if (
    player.boosting &&
    player.character != null &&
    PLAYER_COLORS[player.character] != null
  ) {
    tint = lightenColor(PLAYER_COLORS[player.character], 0.5)
  }

  return (
    <Sprite
      key={`player-${playerId}`}
      image={spriteImage}
      x={x}
      y={y}
      anchor={0.5}
      width={playerScreenRadius * 2}
      height={playerScreenRadius * 2}
      alpha={alpha}
      tint={tint}
    />
  )
}
