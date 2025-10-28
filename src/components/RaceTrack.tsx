// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// lane width in pixels for the current asset: 96 pixels
// total width for all lanes: 96 * 5 = 480 pixels
// background width to accomodate wider screens: 480 * 2 = 960 pixels
// track margin: (960 - 480) / 2 = 240 pixels

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { TilingSprite, useApp, Sprite } from "@pixi/react"
import { Texture } from "pixi.js"
import { GameState } from "../logic"
import {
  CLIENT_SCALING_FACTOR,
  LANE_WIDTH_PX,
  TRACK_WIDTH_PX,
} from "../client_constants"
import { useMemo } from "react"

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
  softObstacleTexture: Texture
  hardObstacleTexture: Texture
  pickupTexture: Texture
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
  softObstacleTexture,
  hardObstacleTexture,
  pickupTexture,
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

  const anchorParam = useMemo(() => ({ x: 0.5, y: 0.5 }), [])
  const scaleParam = useMemo(() => ({ x: scale, y: scale }), [scale])

  return (
    <>
      {/* Tiling Background */}
      <TilingSprite
        texture={trackTexture}
        width={screenWidth}
        height={screenHeight}
        tilePosition={{ x: -tileOffsetX, y: tileYInPixels }}
        tileScale={scaleParam}
        anchor={{ x: 0, y: 0 }}
        position={{ x: 0, y: 0 }}
      />

      {/* Overlays: Pickups and Obstacles */}
      {game.pickups.map((pickup, index) => {
        const x = xOffset + scaledLaneWidth * (pickup.x + 0.5)
        const relativeY = pickup.y - cameraY
        const screenY =
          centerY - (relativeY / screenHeightInGameUnits) * screenHeight

        if (screenY >= -50 && screenY <= screenHeight + 50) {
          return (
            <Sprite
              key={`g${index}`}
              texture={pickupTexture}
              x={x}
              y={screenY}
              anchor={anchorParam}
              scale={scaleParam}
            />
          )
        }
        return null
      })}

      {game.obstacles.map((obstacle, index) => {
        const x = xOffset + scaledLaneWidth * (obstacle.x + 0.5)
        const relativeY = obstacle.y - cameraY
        const screenY =
          centerY - (relativeY / screenHeightInGameUnits) * screenHeight

        if (screenY >= -50 && screenY <= screenHeight + 50) {
          if (obstacle.indestructible) {
            return (
              <Sprite
                key={`w${index}`}
                texture={hardObstacleTexture}
                x={x}
                y={screenY}
                anchor={anchorParam}
                scale={scaleParam}
              />
            )
          } else {
            return (
              <Sprite
                key={`c${index}`}
                texture={softObstacleTexture}
                x={x}
                y={screenY}
                anchor={anchorParam}
                scale={scaleParam}
              />
            )
          }
        }
      })}
    </>
  )
}

export default RaceTrack
