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

const PLAYER_COLORS: Record<string, number> = {
  "0": 0xff0000, // Red
  "1": 0x00ff00, // Green
  "2": 0x0000ff, // Blue
  "3": 0xffff00, // Yellow
  "4": 0xff00ff, // Magenta
}
import { Graphics, useApp, useTick } from "@pixi/react"
import { Graphics as PixiGraphics } from "@pixi/graphics"
import { useRef, useState } from "react"
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
  const [time, setTime] = useState(0)

  useTick((delta) => {
    setTime((t) => t + delta * 0.01) // Slow down the animation a bit
  })

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
      // Only show effect if player was hit by a strike (not by obstacle)
      if (
        !player.knockbackEndTime ||
        !game.lastStrike ||
        game.lastStrike.targetId !== playerId ||
        // Check if the strike event is recent enough to be relevant to current knockback
        Math.abs(
          game.lastStrike.timestamp -
            (player.knockbackEndTime - KNOCKBACK_RECOVERY_TIME_MS)
        ) > 100
      ) {
        return null
      }

      const lane = Math.max(0, Math.min(NUM_LANES - 1, player.x))
      const x = LANE_MARGIN + laneWidth * (lane + 0.5)
      const relativeY = player.y - cameraY
      const y = centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height
      const playerScreenRadius = (PLAYER_RADIUS / VISIBLE_TRACK_HEIGHT) * height

      if (Math.abs(relativeY) > VISIBLE_TRACK_HEIGHT / 2) return null

      return (
        <StrikeEffect
          key={`strike-${playerId}`}
          x={x}
          y={y}
          radius={playerScreenRadius * 2}
          time={time}
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
  let color = PLAYER_COLORS[player.character] || 0x202020
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

function lightenColor(color: number, factor: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff

  const newR = Math.min(255, r + (255 - r) * factor)
  const newG = Math.min(255, g + (255 - g) * factor)
  const newB = Math.min(255, b + (255 - b) * factor)

  return (newR << 16) | (newG << 8) | newB
}
