import { Graphics, Stage, useApp } from "@pixi/react"
import { useEffect, useState } from "react"
import { PlayerId } from "rune-sdk"
import { GameState } from "./logic.ts"

const NUM_LANES = 5

const LANE_MARGIN = 50
const PLAYER_Y_RATIO = 0.7 // 70% down the screen

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
          <RaceTrack />
          <Players game={game} yourPlayerId={yourPlayerId} />
        </Stage>
      </div>
      <div id="controls-hud">
        <button onPointerDown={() => Rune.actions.accelerate()}>
          Accelerate
        </button>
        <button onPointerDown={() => Rune.actions.turnLeft()}>Turn Left</button>
        <button onPointerDown={() => Rune.actions.turnRight()}>
          Turn Right
        </button>
      </div>
    </>
  )
}

const RaceTrack = () => {
  const app = useApp()
  const width = app.screen.width
  const height = app.screen.height
  const laneWidth = (width - 2 * LANE_MARGIN) / NUM_LANES

  return (
    <Graphics
      draw={(g) => {
        g.clear()
        // Draw lanes
        for (let i = 0; i <= NUM_LANES; i++) {
          const x = LANE_MARGIN + i * laneWidth
          g.lineStyle(i === 0 || i === NUM_LANES ? 6 : 2, 0x888888)
          g.moveTo(x, 0)
          g.lineTo(x, height)
        }
      }}
    />
  )
}

type PlayersProps = {
  game: GameState
  yourPlayerId?: PlayerId
}

const Players = ({ game }: PlayersProps) => {
  const app = useApp()
  const width = app.screen.width
  const height = app.screen.height
  const laneWidth = (width - 2 * LANE_MARGIN) / NUM_LANES

  return (
    <Graphics
      key={JSON.stringify(game.players)}
      draw={(g) => {
        g.clear()
        Object.entries(game.players).forEach(([playerId, player]) => {
          const lane = Math.max(0, Math.min(NUM_LANES - 1, player.position.x))
          const x = LANE_MARGIN + laneWidth * (lane + 0.5)
          const y = height * PLAYER_Y_RATIO
          const color = parseInt(playerId.slice(-6), 16) || 0xff0000
          g.beginFill(color)
          g.drawCircle(x, y, 18)
          g.endFill()
        })
      }}
    />
  )
}

export default App
