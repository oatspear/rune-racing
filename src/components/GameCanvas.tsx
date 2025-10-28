// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { useEffect, useMemo } from "react"
import { PlayerId } from "rune-sdk"
import { GameState } from "../logic.ts"
import Players from "./Players.tsx"
import {
  calculateScale,
  CLIENT_SCALING_FACTOR,
  TRACK_WIDTH_PX,
} from "../client_constants.ts"
import RaceTrack from "./RaceTrack.tsx"
// import Notifications from "./components/Notifications.tsx"

import { Texture } from "pixi.js"
import { useApp } from "@pixi/react"

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const MIN_BOTTOM_MARGIN_PX = 64 // Reserve for HUD elements
const MAX_OFFSET_RATIO = 1 / 3 // Player at 5/6 down screen when possible

interface GameCanvasProps {
  game: GameState
  yourPlayerId: PlayerId | undefined
  trackTexture: Texture | undefined
}

const GameCanvas = ({ game, yourPlayerId, trackTexture }: GameCanvasProps) => {
  const app = useApp()

  const scale = useMemo(
    () => calculateScale(app.screen.width),
    [app.screen.width]
  )

  // horizontal margin up to the playable area
  const xOffset = useMemo(
    () => (app.screen.width - TRACK_WIDTH_PX * scale) / 2,
    [app.screen.width, scale]
  )

  const screenHeightInGameUnits = useMemo(
    () => app.screen.height / (CLIENT_SCALING_FACTOR * scale),
    [app.screen.height, scale]
  )

  // Calculate camera position based on player position
  const cameraY = useMemo(() => {
    if (!game || !yourPlayerId || !game.players[yourPlayerId]) return 0
    const player = game.players[yourPlayerId]

    // Calculate safe base offset considering HUD space
    const idealOffsetInGameUnits = screenHeightInGameUnits * MAX_OFFSET_RATIO
    const minOffsetInGameUnits =
      MIN_BOTTOM_MARGIN_PX / (CLIENT_SCALING_FACTOR * scale)
    const baseOffset = Math.max(minOffsetInGameUnits, idealOffsetInGameUnits)

    // Speed reduces the offset (brings player toward center)
    // 1 game unit per 12 speed units
    const speedOffset = player.speed / 24

    // Don't let speed offset push player into HUD zone
    const finalOffset = Math.max(minOffsetInGameUnits, baseOffset - speedOffset)

    return (player.y + finalOffset) | 0
  }, [game, screenHeightInGameUnits, yourPlayerId, scale])

  useEffect(handleGestures, [])

  if (!game) {
    return null
  }

  return (
    <>
      {trackTexture && (
        <RaceTrack
          game={game}
          cameraY={cameraY}
          trackTexture={trackTexture}
          xOffset={xOffset}
          scale={scale}
          screenHeightInGameUnits={screenHeightInGameUnits}
        />
      )}
      <Players
        game={game}
        yourPlayerId={yourPlayerId}
        cameraY={cameraY}
        xOffset={xOffset}
        scale={scale}
        screenHeightInGameUnits={screenHeightInGameUnits}
      />
    </>
  )
}

export default GameCanvas

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function handleGestures() {
  // Handle swipe gestures and mouse drag for lane changes
  let touchStartX = 0
  let touchEndX = 0
  let touchActive = false
  let mouseStartX = 0
  let mouseEndX = 0
  let mouseActive = false

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      touchActive = true
      touchStartX = e.touches[0].clientX
      touchEndX = touchStartX
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (touchActive && e.touches.length === 1) {
      touchEndX = e.touches[0].clientX
    }
  }

  function onTouchEnd() {
    if (!touchActive) return
    const dx = touchEndX - touchStartX
    if (Math.abs(dx) > 24) {
      if (dx < 0) {
        Rune.actions.turnLeft()
      } else {
        Rune.actions.turnRight()
      }
    }
    touchActive = false
    touchStartX = 0
    touchEndX = 0
  }

  function onMouseDown(e: MouseEvent) {
    mouseActive = true
    mouseStartX = e.clientX
    mouseEndX = mouseStartX
  }

  function onMouseMove(e: MouseEvent) {
    if (mouseActive) {
      mouseEndX = e.clientX
    }
  }

  function onMouseUp() {
    if (!mouseActive) return
    const dx = mouseEndX - mouseStartX
    if (Math.abs(dx) > 16) {
      if (dx < 0) {
        Rune.actions.turnLeft()
      } else {
        Rune.actions.turnRight()
      }
    }
    mouseActive = false
    mouseStartX = 0
    mouseEndX = 0
  }

  window.addEventListener("touchstart", onTouchStart)
  window.addEventListener("touchmove", onTouchMove)
  window.addEventListener("touchend", onTouchEnd)
  window.addEventListener("mousedown", onMouseDown)
  window.addEventListener("mousemove", onMouseMove)
  window.addEventListener("mouseup", onMouseUp)

  return () => {
    window.removeEventListener("touchstart", onTouchStart)
    window.removeEventListener("touchmove", onTouchMove)
    window.removeEventListener("touchend", onTouchEnd)
    window.removeEventListener("mousedown", onMouseDown)
    window.removeEventListener("mousemove", onMouseMove)
    window.removeEventListener("mouseup", onMouseUp)
  }
}
