import { Graphics, Stage, useApp } from "@pixi/react"
import { useEffect, useState } from "react"
import { PlayerId } from "rune-sdk"
import { GameState } from "./logic.ts"

const NUM_LANES = 5
const LANE_MARGIN = 50
const PLAYER_FIXED_Y = 0.7 // Fixed vertical position for player's character
const VISIBLE_TRACK_HEIGHT = 240 // How much of track to show ahead/behind in game units
const TRACK_LENGTH = 2400 // Import from logic.ts

const RaceTrack = ({ game, yourPlayerId }: PlayersProps) => {
  const app = useApp()
  const width = app.screen.width
  const height = app.screen.height
  const laneWidth = (width - 2 * LANE_MARGIN) / NUM_LANES

  // If we're a player, get our position to offset the track
  const playerPos =
    (yourPlayerId && game.players[yourPlayerId]?.position.y) || 0

  return (
    <Graphics
      key={`track-${playerPos}`}
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
        const screenBottom = playerPos - VISIBLE_TRACK_HEIGHT / 2
        const screenTop = playerPos + VISIBLE_TRACK_HEIGHT / 2

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

          const screenY =
            height * (1 - (y - screenBottom) / VISIBLE_TRACK_HEIGHT)
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
      }}
    />
  )
}

type PlayersProps = {
  game: GameState
  yourPlayerId?: PlayerId
}

const Players = ({ game, yourPlayerId }: PlayersProps) => {
  const app = useApp()
  const width = app.screen.width
  const height = app.screen.height
  const laneWidth = (width - 2 * LANE_MARGIN) / NUM_LANES

  // Get our player's position to calculate relative positions
  const playerPos =
    (yourPlayerId && game.players[yourPlayerId]?.position.y) || 0

  return (
    <Graphics
      key={JSON.stringify(game.players)}
      draw={(g) => {
        g.clear()

        // Draw other players first
        Object.entries(game.players).forEach(([playerId, player]) => {
          if (playerId === yourPlayerId) return // Skip current player

          const lane = Math.max(0, Math.min(NUM_LANES - 1, player.position.x))
          const x = LANE_MARGIN + laneWidth * (lane + 0.5)

          // Calculate relative position from player
          const relativeY = player.position.y - playerPos
          // Only draw if within visible range
          if (Math.abs(relativeY) <= VISIBLE_TRACK_HEIGHT / 2) {
            const screenY =
              height * (PLAYER_FIXED_Y - relativeY / VISIBLE_TRACK_HEIGHT)
            const color = parseInt(playerId.slice(-6), 16) || 0xff0000
            g.beginFill(color)
            g.drawCircle(x, screenY, 18)
            g.endFill()
          }
        })

        // Draw current player last, at fixed position
        if (yourPlayerId && game.players[yourPlayerId]) {
          const player = game.players[yourPlayerId]
          const lane = Math.max(0, Math.min(NUM_LANES - 1, player.position.x))
          const x = LANE_MARGIN + laneWidth * (lane + 0.5)
          const y = height * PLAYER_FIXED_Y
          const color = parseInt(yourPlayerId.slice(-6), 16) || 0xff0000
          g.beginFill(color)
          g.drawCircle(x, y, 18)
          g.endFill()
        }
      }}
    />
  )
}

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
          <RaceTrack game={game} yourPlayerId={yourPlayerId} />
          <Players game={game} yourPlayerId={yourPlayerId} />
        </Stage>
      </div>
      <div id="controls-hud">
        <button onPointerDown={() => Rune.actions.turnLeft()}>Turn Left</button>
        <button onPointerDown={() => Rune.actions.turnRight()}>
          Turn Right
        </button>
      </div>
    </>
  )
}

export default App
