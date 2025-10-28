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
import { GameState } from "../logic"
import {
  CLIENT_SCALING_FACTOR,
  LANE_WIDTH_PX,
  OBSTACLE_RADIUS_PX,
  TRACK_WIDTH_PX,
} from "../client_constants"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Texture dimensions
const TEXTURE_WIDTH = 960 // px
const TEXTURE_HEIGHT = 1024 // px
const TEXTURE_MARGIN = (TEXTURE_WIDTH - TRACK_WIDTH_PX) / 2 // px

type TrackProps = {
  game: GameState
  cameraY: number
  trackTexture: Texture
  xOffset: number
  scale: number
  screenHeightInGameUnits: number
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const RaceTrack = ({
  game,
  cameraY,
  trackTexture,
  xOffset,
  scale,
  screenHeightInGameUnits,
}: TrackProps) => {
  const app = useApp()
  const screenWidth = app.screen.width
  const screenHeight = app.screen.height

  // Scaled dimensions
  const scaledLaneWidth = LANE_WIDTH_PX * scale

  // Tile position offset to center the 480px area
  // The playable area starts at 240px in the texture
  const tileOffsetX = TEXTURE_MARGIN * scale - xOffset

  // Vertical scrolling
  const textureHeightInGameUnits = TEXTURE_HEIGHT / CLIENT_SCALING_FACTOR
  const tileY = ((cameraY % textureHeightInGameUnits) * scale) | 0
  const tileYInPixels = tileY * CLIENT_SCALING_FACTOR

  // Calculate lane positioning for obstacles/pickups
  const centerY = screenHeight / 2

  return (
    <>
      {/* Tiling Background */}
      <TilingSprite
        texture={trackTexture}
        width={screenWidth}
        height={screenHeight}
        tilePosition={{ x: -tileOffsetX, y: tileYInPixels }}
        tileScale={{ x: scale, y: scale }}
        anchor={{ x: 0, y: 0 }}
        position={{ x: 0, y: 0 }}
      />

      {/* Overlays: Pickups and Obstacles */}
      <Graphics
        draw={(g) => {
          g.clear()

          // Draw pickups
          const pickupScreenRadius = OBSTACLE_RADIUS_PX * scale
          game.pickups.forEach((pickup) => {
            const x = xOffset + scaledLaneWidth * (pickup.x + 0.5)
            const relativeY = pickup.y - cameraY
            const screenY =
              centerY - (relativeY / screenHeightInGameUnits) * screenHeight

            if (screenY >= -50 && screenY <= screenHeight + 50) {
              g.lineStyle(0)
              g.beginFill(0xffd700)
              g.drawCircle(x, screenY, pickupScreenRadius / 2)
              g.endFill()
            }
          })

          // Draw obstacles
          const obstacleScreenSize = OBSTACLE_RADIUS_PX * scale
          game.obstacles.forEach((obstacle) => {
            const x = xOffset + scaledLaneWidth * (obstacle.x + 0.5)
            const relativeY = obstacle.y - cameraY
            const screenY =
              centerY - (relativeY / screenHeightInGameUnits) * screenHeight

            if (screenY >= -50 && screenY <= screenHeight + 50) {
              if (obstacle.indestructible) {
                g.lineStyle(3, 0x444444)
                g.beginFill(0x888888)
                g.drawRect(
                  x - obstacleScreenSize / 2,
                  screenY - obstacleScreenSize / 2,
                  obstacleScreenSize,
                  obstacleScreenSize
                )
                g.lineStyle(2, 0x444444)
                g.moveTo(
                  x - obstacleScreenSize / 3,
                  screenY - obstacleScreenSize / 3
                )
                g.lineTo(
                  x + obstacleScreenSize / 3,
                  screenY + obstacleScreenSize / 3
                )
                g.moveTo(
                  x + obstacleScreenSize / 3,
                  screenY - obstacleScreenSize / 3
                )
                g.lineTo(
                  x - obstacleScreenSize / 3,
                  screenY + obstacleScreenSize / 3
                )
                g.endFill()
              } else {
                g.lineStyle(2, 0xff4444)
                g.beginFill(0xff6666)
                g.drawRect(
                  x - obstacleScreenSize / 2,
                  screenY - obstacleScreenSize / 2,
                  obstacleScreenSize,
                  obstacleScreenSize
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
