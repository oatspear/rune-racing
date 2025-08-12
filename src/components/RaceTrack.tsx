// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { Graphics, useApp } from "@pixi/react"
import { GameState, NUM_LANES, OBSTACLE_RADIUS } from "../logic"
import {
  LANE_MARGIN,
  TRACK_LENGTH,
  VISIBLE_TRACK_HEIGHT,
} from "../client_constants"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

type TrackProps = {
  game: GameState
  cameraY: number // Center of the visible area in world coordinates
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const RaceTrack = ({ game, cameraY }: TrackProps) => {
  const app = useApp()
  const width = app.screen.width
  const height = app.screen.height
  const laneWidth = (width - 2 * LANE_MARGIN) / NUM_LANES
  const centerY = height / 2 // Camera looks at center of screen

  return (
    <Graphics
      key={`track-${cameraY}`}
      draw={(g) => {
        g.clear()

        // Draw lanes
        for (let i = 0; i <= NUM_LANES; i++) {
          const x = LANE_MARGIN + i * laneWidth
          g.lineStyle(i === 0 || i === NUM_LANES ? 6 : 2, 0x888888)
          g.moveTo(x, 0)
          g.lineTo(x, height)
        }

        // Draw horizontal track markers
        const markerSpacing = 60 // Draw a line every 60 units
        // Visible area is centered around camera position
        const halfVisibleHeight = VISIBLE_TRACK_HEIGHT / 2
        const screenBottom = cameraY - halfVisibleHeight
        const screenTop = cameraY + halfVisibleHeight

        const startMarker =
          Math.floor(screenBottom / markerSpacing) * markerSpacing
        const endMarker = Math.min(
          Math.ceil(screenTop / markerSpacing) * markerSpacing,
          TRACK_LENGTH // Don't draw markers beyond finish line
        )

        // Draw regular track markers
        for (let y = startMarker; y <= endMarker; y += markerSpacing) {
          // Skip drawing if we're at the finish line
          if (y === TRACK_LENGTH) continue

          // Convert world Y to screen Y, accounting for player's screen position
          const relativeY = y - cameraY
          const screenY = centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height
          g.lineStyle(2, 0x666666)
          g.moveTo(LANE_MARGIN, screenY)
          g.lineTo(width - LANE_MARGIN, screenY)

          // Draw distance markers
          g.lineStyle(0)
          g.beginFill(0x666666)
          g.drawRect(LANE_MARGIN - 40, screenY - 10, 30, 20)
          g.endFill()
        }

        // Draw finish line if it's in view
        if (TRACK_LENGTH >= screenBottom && TRACK_LENGTH <= screenTop) {
          const finishY =
            height * (1 - (TRACK_LENGTH - screenBottom) / VISIBLE_TRACK_HEIGHT)

          // Draw checkered pattern
          const checkerSize = 20
          const numCheckers = Math.ceil((width - 2 * LANE_MARGIN) / checkerSize)

          for (let i = 0; i < numCheckers; i++) {
            const isEven = i % 2 === 0
            g.beginFill(isEven ? 0xffffff : 0x000000)
            g.drawRect(
              LANE_MARGIN + i * checkerSize,
              finishY - checkerSize / 2,
              checkerSize,
              checkerSize
            )
            g.endFill()
          }

          // Draw "FINISH" text background
          g.beginFill(0xff0000)
          g.drawRect(LANE_MARGIN - 80, finishY - 15, 70, 30)
          g.endFill()
        }

        // Draw pickups
        game.pickups.forEach((pickup) => {
          // Calculate pickup screen position
          const x = LANE_MARGIN + laneWidth * (pickup.x + 0.5)
          const relativeY = pickup.y - cameraY
          const screenY = centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height

          // Only draw if in visible range
          if (screenY >= 0 && screenY <= height) {
            const pickupScreenRadius = (10 / VISIBLE_TRACK_HEIGHT) * height // 10 units in game space
            g.lineStyle(0)
            g.beginFill(0xffd700) // Gold color
            g.drawCircle(x, screenY, pickupScreenRadius)
            g.endFill()
          }
        })

        // Draw obstacles
        game.obstacles.forEach((obstacle) => {
          // Calculate obstacle screen position
          const x = LANE_MARGIN + laneWidth * (obstacle.x + 0.5)
          const relativeY = obstacle.y - cameraY
          const screenY = centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height

          // Only draw if in visible range
          if (screenY >= 0 && screenY <= height) {
            // Convert obstacle size from game units to screen pixels
            const screenSize =
              ((OBSTACLE_RADIUS * 2) / VISIBLE_TRACK_HEIGHT) * height
            if (obstacle.indestructible) {
              // Steel-colored indestructible obstacle with thicker outline
              g.lineStyle(3, 0x444444) // Dark gray outline
              g.beginFill(0x888888) // Gray fill
              g.drawRect(
                x - screenSize / 2,
                screenY - screenSize / 2,
                screenSize,
                screenSize
              )
              // Add cross pattern to indicate indestructible
              g.lineStyle(2, 0x444444)
              g.moveTo(x - screenSize / 3, screenY - screenSize / 3)
              g.lineTo(x + screenSize / 3, screenY + screenSize / 3)
              g.moveTo(x + screenSize / 3, screenY - screenSize / 3)
              g.lineTo(x - screenSize / 3, screenY + screenSize / 3)
              g.endFill()
            } else {
              // Regular destructible obstacle
              g.lineStyle(2, 0xff4444) // Red outline
              g.beginFill(0xff6666) // Light red fill
              g.drawRect(
                x - screenSize / 2,
                screenY - screenSize / 2,
                screenSize,
                screenSize
              )
              g.endFill()
            }
          }
        })
      }}
    />
  )
}

export default RaceTrack
