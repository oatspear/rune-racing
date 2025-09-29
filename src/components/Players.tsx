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
  PLAYER_RADIUS,
  PlayerState,
} from "../logic"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

import { Graphics, useApp } from "@pixi/react"
import { PLAYER_COLORS, lightenColor } from "../client_constants"
import { Graphics as PixiGraphics } from "@pixi/graphics"
import { useRef } from "react"
import { LANE_MARGIN, VISIBLE_TRACK_HEIGHT } from "../client_constants"
import StrikeEffect from "./StrikeEffect"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

type PlayersProps = {
  game: GameState
  yourPlayerId?: PlayerId
  cameraY: number
}

type TrailPoint = {
  lane: number // Store lane number instead of screen x
  worldY: number // Store world y position
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
  const centerY = height / 2 // Camera-relative center point
  const trailsRef = useRef<Record<PlayerId, PlayerTrail>>({})
  const strikeStartTimes = useRef<Record<string, number>>({}) // Track when each strike effect started

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
      // Only show effect if there's an active strike event
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

      // Get striker's character color from their player state, lightened like when boosting
      const striker = game.players[game.lastStrike.strikerId]
      // const baseColor =
      //   striker && striker.character != null
      //     ? PLAYER_COLORS[striker.character]
      //     : undefined
      // const strikerColor = baseColor ? lightenColor(baseColor, 0.5) : undefined

      // Create a unique ID for this strike event
      const strikeId = `${playerId}-${game.lastStrike.timestamp}`

      // Start tracking this strike effect if we haven't seen it before
      if (!strikeStartTimes.current[strikeId]) {
        strikeStartTimes.current[strikeId] = now
      }

      // Calculate animation progress
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

  return (
    <>
      {/* Draw base players and their trails */}
      <Graphics
        key={`players-${JSON.stringify(game.players)}`}
        draw={(g) => {
          g.clear()
          const now = performance.now()

          // Draw other players first
          for (const [playerId, player] of Object.entries(game.players)) {
            if (playerId === yourPlayerId) continue // Skip current player
            const trail = trailsRef.current[playerId]
            updateTrail(trail, player, now)
            drawPlayer(
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

          // Draw current player last
          if (yourPlayerId && game.players[yourPlayerId]) {
            const player = game.players[yourPlayerId]
            const trail = trailsRef.current[yourPlayerId]
            updateTrail(trail, player, now)
            drawPlayer(
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

  // Add new point if enough time has passed and not in knockback
  if (timeSinceLastUpdate > 32 && !player.knockbackEndTime) {
    trail.points.unshift({
      lane: player.x,
      worldY: player.y,
      timestamp: now,
    })
    trail.lastUpdate = now
    // Keep only last 12 points
    if (trail.points.length > 12) {
      trail.points.pop()
    }
  } else if (player.knockbackEndTime) {
    trail.points.length = 0 // Clear trail during knockback
  }
}

function drawPlayer(
  g: PixiGraphics,
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

  // Calculate screen Y with speed-based offset
  const relativeY = player.y - cameraY

  // Only draw if within visible range
  if (Math.abs(relativeY) > VISIBLE_TRACK_HEIGHT / 2) {
    return
  }

  let speedY = 0
  let knockbackProgress = 0
  let alpha = 1

  if (player.knockbackEndTime) {
    knockbackProgress =
      (player.knockbackEndTime - now) / KNOCKBACK_RECOVERY_TIME_MS
    alpha = Math.cos(knockbackProgress * Math.PI * 4) * 0.5 + 0.5
  } else {
    speedY = player.boosting ? 40 : (player.speed / MAX_SPEED) * 40
  }

  const y = centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height + speedY
  let color =
    player.character != null && PLAYER_COLORS[player.character] != null
      ? PLAYER_COLORS[player.character]
      : 0x202020
  if (player.boosting) {
    color = lightenColor(color, 0.5) // Lighten color when boosting
  }

  // Draw trail
  if (trail.points.length > 1 && !player.knockbackEndTime) {
    g.lineStyle(0) // Reset line style
    const points = trail.points
    let p1 = { lane: player.x, worldY: player.y, timestamp: 0 }

    // Draw trail segments with gradual fade
    for (let i = 0; i < points.length; i++) {
      const p2 = points[i]

      // Calculate screen coordinates for both points
      const x1 = LANE_MARGIN + laneWidth * (p1.lane + 0.5)
      const x2 = LANE_MARGIN + laneWidth * (p2.lane + 0.5)

      // Calculate relative positions from camera
      const relY1 = p1.worldY - cameraY
      const relY2 = p2.worldY - cameraY

      const screenY1 =
        centerY - (relY1 / VISIBLE_TRACK_HEIGHT) * height + speedY
      const screenY2 =
        centerY - (relY2 / VISIBLE_TRACK_HEIGHT) * height + speedY

      // Draw the trail segment with knockback fade
      const age = (now - p1.timestamp) / 1000 // Convert to seconds
      let trailAlpha = Math.max(0, 1 - age) // Fade out over 1 second
      if (!player.boosting) {
        trailAlpha *= 0.6 // Non-boosting players have dimmer trails
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

  // Draw player
  const playerScreenRadius = (PLAYER_RADIUS / VISIBLE_TRACK_HEIGHT) * height
  const outlineColor = 0x2c2c2c // Default outline color
  g.lineStyle(3, outlineColor, alpha)
  g.beginFill(color, alpha)
  // g.drawCircle(x, y, playerScreenRadius)
  // draw player as a triangle
  g.drawPolygon([
    x,
    y - playerScreenRadius,
    x - playerScreenRadius,
    y + playerScreenRadius,
    x + playerScreenRadius,
    y + playerScreenRadius,
  ])
  g.endFill()
}
