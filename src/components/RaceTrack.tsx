// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// lane width in pixels for the current asset: 96 pixels
// total width for all lanes: 96 * 5 = 480 pixels
// background width to accomodate wider screens: 480 * 2 = 960 pixels
// track margin: (960 - 480) / 2 = 240 pixels

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { TilingSprite, Graphics, useApp } from "@pixi/react"
import { Texture } from "pixi.js"
import { GameState, NUM_LANES, OBSTACLE_RADIUS } from "../logic"
import { VISIBLE_TRACK_HEIGHT } from "../client_constants"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Texture dimensions
// const TEXTURE_WIDTH = 960
const TEXTURE_HEIGHT = 1024

// Game space dimensions (pixels)
const GAME_WIDTH = 480 // 5 lanes × 96px each - center of texture
const TEXTURE_MARGIN = 240 // (960 - 480) / 2

type TrackProps = {
  game: GameState
  cameraY: number
  trackTexture: Texture
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Calculate scale factor with smart stepping
 * Always ensures 480px playable area fits on screen
 */
function calculateScale(screenWidth: number): number {
  // const baseScale = screenWidth / GAME_WIDTH

  // Define scale steps for clean rendering
  const scaleSteps = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]

  // Find the largest step that fits
  for (let i = scaleSteps.length - 1; i >= 0; i--) {
    if (GAME_WIDTH * scaleSteps[i] <= screenWidth) {
      return scaleSteps[i]
    }
  }

  // Fallback to smallest scale
  return scaleSteps[0]
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const RaceTrack = ({ game, cameraY, trackTexture }: TrackProps) => {
  const app = useApp()
  const screenWidth = app.screen.width
  const screenHeight = app.screen.height

  // Calculate scale with stepping
  const scale = calculateScale(screenWidth)

  // Scaled dimensions
  // const scaledTextureWidth = TEXTURE_WIDTH * scale
  const scaledGameWidth = GAME_WIDTH * scale

  // Center the playable area on screen
  const xOffset = (screenWidth - scaledGameWidth) / 2

  // Calculate how much of the texture to show
  // We want to show as much as fits on screen, centered on the playable area
  // const maxVisibleWidth = Math.min(screenWidth, scaledTextureWidth)

  // Tile position offset to center the 480px area
  // The playable area starts at 240px in the texture
  const tileOffsetX = TEXTURE_MARGIN * scale - xOffset

  // Vertical scrolling
  const textureHeightInGameUnits = TEXTURE_HEIGHT / scale
  const tileY = ((cameraY * 4) % textureHeightInGameUnits) * scale

  // Calculate lane positioning for obstacles/pickups
  const laneWidth = (GAME_WIDTH / NUM_LANES) * scale
  const centerY = screenHeight / 2

  return (
    <>
      {/* Tiling Background */}
      <TilingSprite
        texture={trackTexture}
        width={screenWidth}
        height={screenHeight}
        tilePosition={{ x: -tileOffsetX, y: tileY }}
        tileScale={{ x: scale, y: scale }}
        anchor={{ x: 0, y: 0 }}
        position={{ x: 0, y: 0 }}
      />

      {/* Overlays: Pickups and Obstacles */}
      <Graphics
        draw={(g) => {
          g.clear()

          // Draw pickups
          game.pickups.forEach((pickup) => {
            const x = xOffset + laneWidth * (pickup.x + 0.5)
            const relativeY = pickup.y - cameraY
            const screenY =
              centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * screenHeight

            if (screenY >= -50 && screenY <= screenHeight + 50) {
              const pickupScreenRadius =
                (10 / VISIBLE_TRACK_HEIGHT) * screenHeight
              g.lineStyle(0)
              g.beginFill(0xffd700)
              g.drawCircle(x, screenY, pickupScreenRadius)
              g.endFill()
            }
          })

          // Draw obstacles
          game.obstacles.forEach((obstacle) => {
            const x = xOffset + laneWidth * (obstacle.x + 0.5)
            const relativeY = obstacle.y - cameraY
            const screenY =
              centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * screenHeight

            if (screenY >= -50 && screenY <= screenHeight + 50) {
              const screenSize =
                ((OBSTACLE_RADIUS * 2) / VISIBLE_TRACK_HEIGHT) * screenHeight

              if (obstacle.indestructible) {
                g.lineStyle(3, 0x444444)
                g.beginFill(0x888888)
                g.drawRect(
                  x - screenSize / 2,
                  screenY - screenSize / 2,
                  screenSize,
                  screenSize
                )
                g.lineStyle(2, 0x444444)
                g.moveTo(x - screenSize / 3, screenY - screenSize / 3)
                g.lineTo(x + screenSize / 3, screenY + screenSize / 3)
                g.moveTo(x + screenSize / 3, screenY - screenSize / 3)
                g.lineTo(x - screenSize / 3, screenY + screenSize / 3)
                g.endFill()
              } else {
                g.lineStyle(2, 0xff4444)
                g.beginFill(0xff6666)
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
    </>
  )
}

export default RaceTrack
