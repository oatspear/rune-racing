// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { Stage } from "@pixi/react"
import { useEffect, useState, useMemo } from "react"
import { PlayerId } from "rune-sdk"
import { GameState } from "./logic.ts"
import Players from "./components/Players.tsx"
import { VISIBLE_TRACK_HEIGHT } from "./client_constants.ts"
import ScoreHUD from "./components/ScoreHUD.tsx"
import RaceTrack from "./components/RaceTrack.tsx"

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const App = () => {
  const [game, setGame] = useState<GameState>()
  const [yourPlayerId, setYourPlayerId] = useState<PlayerId | undefined>()

  useEffect(() => {
    Rune.initClient({
      onChange: ({ game, yourPlayerId }) => {
        setGame(game)
        setYourPlayerId(yourPlayerId)
      },
    })
  }, [])

  // Calculate camera position based on player position
  const cameraY = useMemo(() => {
    if (!game || !yourPlayerId || !game.players[yourPlayerId]) return 0

    const player = game.players[yourPlayerId]
    // We want the player at 4/6 down the screen
    // Camera is at the center, so we need to offset from player position by how far up from center the player should be
    // 4/6 of screen height = 1/6 down from center
    // Since the RaceTrack inverts Y coordinates, we need to ADD to move the player down
    return player.y + VISIBLE_TRACK_HEIGHT / 12 // Move camera down from player position
  }, [game, yourPlayerId])

  useEffect(() => {
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
      if (Math.abs(dx) > 40) {
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
      if (Math.abs(dx) > 40) {
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
  }, [])

  if (!game) {
    return null
  }

  return (
    <>
      <div id="board-container">
        <Stage
          options={{ backgroundAlpha: 0 }}
          width={window.innerWidth}
          height={window.innerHeight}
        >
          <RaceTrack game={game} cameraY={cameraY} />
          <Players game={game} yourPlayerId={yourPlayerId} cameraY={cameraY} />
        </Stage>
        <ScoreHUD game={game} yourPlayerId={yourPlayerId} />
      </div>
      <div id="controls-hud">
        <div className="control-buttons">
          <button
            className="control-button"
            onPointerDown={() => Rune.actions.startBoost()}
            onPointerUp={() => Rune.actions.stopBoost()}
            onPointerLeave={() => Rune.actions.stopBoost()}
            onTouchStart={(e) => {
              e.preventDefault() // Prevent double-firing with pointer events
              Rune.actions.startBoost()
            }}
            onTouchEnd={(e) => {
              e.preventDefault()
              Rune.actions.stopBoost()
            }}
            onTouchCancel={(e) => {
              e.preventDefault()
              Rune.actions.stopBoost()
            }}
          >
            Boost
          </button>
          <button
            className="control-button"
            onPointerDown={() => {
              console.log("Strike button pressed")
              Rune.actions.strike()
            }}
            onTouchStart={(e) => {
              e.preventDefault() // Prevent double-firing with pointer events
              console.log("Strike button touched")
              Rune.actions.strike()
            }}
          >
            Strike
          </button>
        </div>
      </div>
    </>
  )
}

export default App
