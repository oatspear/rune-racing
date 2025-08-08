import { Graphics, Stage, useApp } from "@pixi/react"
import { useEffect, useRef, useState, useMemo } from "react"
import { PlayerId } from "rune-sdk"
import {
  GameState,
  MAX_SPEED,
  PLAYER_RADIUS,
  OBSTACLE_RADIUS,
} from "./logic.ts"

const NUM_LANES = 5
const LANE_MARGIN = 30
const VISIBLE_TRACK_HEIGHT = 240 // How much of track to show ahead/behind in game units
const TRACK_LENGTH = 2400

// Camera configuration shows 240 units of track height
// Player is positioned at 4/6 from top of screen = 1/6 below center

type TrackProps = PlayersProps & {
  cameraY: number // Center of the visible area in world coordinates
}

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

const Players = ({ game, yourPlayerId, cameraY }: PlayersProps) => {
  const app = useApp()
  const width = app.screen.width
  const height = app.screen.height
  const laneWidth = (width - 2 * LANE_MARGIN) / NUM_LANES
  const centerY = height / 2 // Camera-relative center point
  const trailsRef = useRef<Record<PlayerId, PlayerTrail>>({})

  return (
    <Graphics
      key={JSON.stringify(game.players)}
      draw={(g) => {
        g.clear()

        // Draw other players first
        Object.entries(game.players).forEach(([playerId, player]) => {
          if (playerId === yourPlayerId) return // Skip current player

          const lane = Math.max(0, Math.min(NUM_LANES - 1, player.x))
          const x = LANE_MARGIN + laneWidth * (lane + 0.5)

          // Calculate relative position from player
          const relativeY = player.y - cameraY
          // Only draw if within visible range
          if (Math.abs(relativeY) <= VISIBLE_TRACK_HEIGHT / 2) {
            // Calculate screen position with player's speed offset
            const speedY = player.knockbackEndTime
              ? 0
              : (player.speed / MAX_SPEED) * 40 // Move up to 40 pixels forward at max speed

            const finalY =
              centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height + speedY
            const color = parseInt(playerId.slice(-6), 16) || 0xff0000

            // Convert player size from game units to screen pixels
            const playerScreenRadius =
              (PLAYER_RADIUS / VISIBLE_TRACK_HEIGHT) * height

            // Update trail points
            const now = performance.now()
            if (!trailsRef.current[playerId]) {
              trailsRef.current[playerId] = {
                points: [],
                lastUpdate: now,
              }
            }

            const trail = trailsRef.current[playerId]
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

                // Calculate relative positions from current player
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

                // Draw the trail segment
                g.lineStyle(
                  Math.max(3, 20 * (1 - i / points.length)),
                  color,
                  alpha * 0.6
                )
                g.moveTo(x1, screenY1)
                g.lineTo(x2, screenY2)
              }
            }

            // Draw player
            g.lineStyle(0)
            g.beginFill(color)
            g.drawCircle(x, finalY, playerScreenRadius)
            g.endFill()
          }
        })

        // Draw current player last, at dynamic position based on speed
        if (yourPlayerId && game.players[yourPlayerId]) {
          const player = game.players[yourPlayerId]
          const lane = Math.max(0, Math.min(NUM_LANES - 1, player.x))
          const x = LANE_MARGIN + laneWidth * (lane + 0.5)

          // Calculate screen Y with speed-based offset
          const relativeY = player.y - cameraY
          const speedY = player.knockbackEndTime
            ? 0
            : (player.speed / MAX_SPEED) * 40
          const y =
            centerY - (relativeY / VISIBLE_TRACK_HEIGHT) * height + speedY
          const color = parseInt(yourPlayerId.slice(-6), 16) || 0xff0000

          // Update trail points
          const now = performance.now()
          if (!trailsRef.current[yourPlayerId]) {
            trailsRef.current[yourPlayerId] = {
              points: [],
              lastUpdate: now,
            }
          }

          const trail = trailsRef.current[yourPlayerId]
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

              g.lineStyle(
                Math.max(3, 20 * (1 - i / points.length)),
                color,
                trailAlpha
              )
              g.moveTo(x1, screenY1)
              g.lineTo(x2, screenY2)
            }
          }

          // Draw player with blink effect during knockback
          const playerScreenRadius =
            (PLAYER_RADIUS / VISIBLE_TRACK_HEIGHT) * height

          // Calculate blink alpha if in knockback
          let alpha = 1
          if (player.knockbackEndTime) {
            // Blink twice per second during knockback
            const knockbackProgress =
              (player.knockbackEndTime - performance.now()) / 400
            alpha = Math.cos(knockbackProgress * Math.PI * 4) * 0.5 + 0.5
          }

          g.lineStyle(0)
          g.beginFill(color, alpha)
          g.drawCircle(x, y, playerScreenRadius)
          g.endFill()
        }
      }}
    />
  )
}

const ScoreHUD = ({ game, yourPlayerId }: PlayersProps) => {
  if (!yourPlayerId || !game.players[yourPlayerId]) return null

  const player = game.players[yourPlayerId]
  const color = `#${yourPlayerId.slice(-6)}`

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        padding: "10px",
        borderRadius: "5px",
        color: "white",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span
        style={{
          display: "block",
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      <span>Pickups: {player.score}</span>
    </div>
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
          <RaceTrack
            game={game}
            yourPlayerId={yourPlayerId}
            cameraY={cameraY}
          />
          <Players game={game} yourPlayerId={yourPlayerId} cameraY={cameraY} />
        </Stage>
        <ScoreHUD game={game} yourPlayerId={yourPlayerId} cameraY={cameraY} />
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
