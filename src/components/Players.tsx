// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { PlayerId } from "rune-sdk"
import {
  GameState,
  MAX_SPEED,
  NUM_LANES,
  PLAYER_RADIUS,
  PlayerState,
} from "../logic"
import { Graphics, useApp } from "@pixi/react"
import { Graphics as PixiGraphics } from "pixi.js"
import { useRef } from "react"
import {
  LANE_MARGIN,
  PLAYER_COLORS,
  VISIBLE_TRACK_HEIGHT,
} from "../client_constants"

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

  const now = performance.now()
  for (const playerId of Object.values(game.playerIds)) {
    if (!trailsRef.current[playerId]) {
      trailsRef.current[playerId] = {
        points: [],
        lastUpdate: now,
      }
    }
  }

  return (
    <Graphics
      key={JSON.stringify(game.players)}
      draw={(g) => {
        g.clear()
        const now = performance.now()

        // Draw other players first
        for (const [playerId, player] of Object.entries(game.players)) {
          if (playerId === yourPlayerId) continue // Skip current player
          const trail = trailsRef.current[playerId]
          updateTrail(trail, player, now)
          drawPlayer(g, player, cameraY, height, laneWidth, centerY, trail)
        }

        // Draw current player last, at dynamic position based on speed
        if (yourPlayerId && game.players[yourPlayerId]) {
          const player = game.players[yourPlayerId]
          const trail = trailsRef.current[yourPlayerId]
          updateTrail(trail, player, now)
          drawPlayer(g, player, cameraY, height, laneWidth, centerY, trail)
        }
      }}
    />
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
  }
}

function drawPlayer(
  g: PixiGraphics,
  player: PlayerState,
  cameraY: number,
  height: number,
  laneWidth: number,
  centerY: number,
  trail: PlayerTrail
) {
  const lane = Math.max(0, Math.min(NUM_LANES - 1, player.x))
  const x = LANE_MARGIN + laneWidth * (lane + 0.5)

  // Calculate screen Y with speed-based offset
  const relativeY = player.y - cameraY

  // Only draw if within visible range
  if (Math.abs(relativeY) > VISIBLE_TRACK_HEIGHT / 2) {
    return
  }

  const speedY = player.knockbackEndTime ? 0 : (player.speed / MAX_SPEED) * 40
  const y = centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height + speedY
  const color = PLAYER_COLORS[player.character] || 0xffffff

  // Update trail points
  const now = performance.now()

  // Draw trail
  if (trail.points.length > 1) {
    g.lineStyle(0) // Reset line style
    const points = trail.points

    // Draw trail segments with gradual fade
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]
      const p2 = points[i + 1]
      const age = (now - p1.timestamp) / 1000 // Convert to seconds
      const alpha = Math.max(0, 1 - age) // Fade out over 1 second

      // Calculate screen coordinates for both points
      const x1 = LANE_MARGIN + laneWidth * (p1.lane + 0.5)
      const x2 = LANE_MARGIN + laneWidth * (p2.lane + 0.5)

      // Calculate relative positions from camera
      const relY1 = p1.worldY - cameraY
      const relY2 = p2.worldY - cameraY

      // Convert to screen coordinates with speed offset
      const speedY = player.knockbackEndTime
        ? 0
        : (player.speed / MAX_SPEED) * 40

      const screenY1 =
        centerY - (relY1 / VISIBLE_TRACK_HEIGHT) * height + speedY
      const screenY2 =
        centerY - (relY2 / VISIBLE_TRACK_HEIGHT) * height + speedY

      // Draw the trail segment with knockback fade
      let trailAlpha = alpha * 0.6
      if (player.knockbackEndTime) {
        const knockbackProgress =
          (player.knockbackEndTime - performance.now()) / 400
        const knockbackAlpha =
          Math.cos(knockbackProgress * Math.PI * 4) * 0.5 + 0.5
        trailAlpha *= knockbackAlpha
      }

      g.lineStyle(Math.max(3, 20 * (1 - i / points.length)), color, trailAlpha)
      g.moveTo(x1, screenY1)
      g.lineTo(x2, screenY2)
    }
  }

  // Draw player with blink effect during knockback
  const playerScreenRadius = (PLAYER_RADIUS / VISIBLE_TRACK_HEIGHT) * height

  // Calculate blink alpha if in knockback
  let alpha = 1
  if (player.knockbackEndTime) {
    // Blink twice per second during knockback
    const knockbackProgress =
      (player.knockbackEndTime - performance.now()) / 400
    alpha = Math.cos(knockbackProgress * Math.PI * 4) * 0.5 + 0.5
  }

  // Draw player
  const outlineColor = 0x2c2c2c // Default outline color
  g.lineStyle(3, outlineColor, alpha)
  g.beginFill(color, alpha)
  g.drawCircle(x, y, playerScreenRadius)
  g.endFill()
}

/*
function lightenColor(color: number, factor: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff

  const newR = Math.min(255, r + (255 - r) * factor)
  const newG = Math.min(255, g + (255 - g) * factor)
  const newB = Math.min(255, b + (255 - b) * factor)

  return (newR << 16) | (newG << 8) | newB
}
*/
