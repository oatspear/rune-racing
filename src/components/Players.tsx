// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { PlayerId } from "rune-sdk"
import {
  GameState,
  KNOCKBACK_RECOVERY_TIME_MS,
  PlayableCharacter,
  PlayerState,
} from "../logic"

import { Container, Graphics, Sprite, useApp } from "@pixi/react"
import { LANE_WIDTH_PX, PLAYER_COLORS, lightenColor } from "../client_constants"
import { Graphics as PixiGraphics } from "@pixi/graphics"
import { useRef } from "react"
import StrikeEffect from "./StrikeEffect"

// Import character sprites
import spriteBlue from "../assets/arrow-blue.png"
import spriteRed from "../assets/arrow-red.png"
import spriteGreen from "../assets/arrow-green.png"
import spritePurple from "../assets/arrow-purple.png"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Map character indices to imported sprites
const CHARACTER_SPRITES: Record<PlayableCharacter, string> = {
  [PlayableCharacter.BLUE]: spriteBlue,
  [PlayableCharacter.RED]: spriteRed,
  [PlayableCharacter.GREEN]: spriteGreen,
  [PlayableCharacter.PURPLE]: spritePurple,
}

const DEFAULT_SPRITE = CHARACTER_SPRITES[PlayableCharacter.BLUE]

type PlayersProps = {
  game: GameState
  yourPlayerId?: PlayerId
  cameraY: number
  xOffset: number
  scale: number
  screenHeightInGameUnits: number
}

type TrailPoint = {
  lane: number
  worldY: number
  timestamp: number
}

type PlayerTrail = {
  points: TrailPoint[]
  lastUpdate: number
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const Players = ({
  game,
  yourPlayerId,
  cameraY,
  xOffset,
  scale,
  screenHeightInGameUnits,
}: PlayersProps) => {
  const app = useApp()
  const height = app.screen.height
  const screenCenterY = height / 2
  const trailsRef = useRef<Record<PlayerId, PlayerTrail>>({})
  const strikeStartTimes = useRef<Record<string, number>>({})

  const now = performance.now()
  for (const playerId of Object.values(game.playerIds)) {
    if (!trailsRef.current[playerId]) {
      trailsRef.current[playerId] = {
        points: [],
        lastUpdate: now,
      }
    }
  }

  const scaledLaneWidth = LANE_WIDTH_PX * scale

  const renderStrikeEffects = () => {
    return Object.entries(game.players).map(([playerId, player]) => {
      if (
        !player.knockbackEndTime ||
        !game.lastStrike ||
        game.lastStrike.targetId !== playerId
      ) {
        return null
      }

      const x = xOffset + scaledLaneWidth * (player.x + 0.5)
      const relativeY = player.y - cameraY
      const y = screenCenterY - (relativeY / screenHeightInGameUnits) * height

      if (Math.abs(relativeY) > screenHeightInGameUnits / 2) return null

      const striker = game.players[game.lastStrike.strikerId]
      const strikeId = `${playerId}-${game.lastStrike.timestamp}`

      if (!strikeStartTimes.current[strikeId]) {
        strikeStartTimes.current[strikeId] = now
      }

      const timeSinceStart = now - strikeStartTimes.current[strikeId]
      const normalizedTime = Math.min(
        timeSinceStart / (KNOCKBACK_RECOVERY_TIME_MS + 100),
        1
      )

      return (
        <StrikeEffect
          key={`strike-${playerId}`}
          x={x}
          y={y}
          scale={scale}
          time={normalizedTime}
          character={striker?.character ?? undefined}
        />
      )
    })
  }

  const renderPlayers = () => {
    const playerElements = []

    // Render other players first
    for (const [playerId, player] of Object.entries(game.players)) {
      if (playerId === yourPlayerId) continue
      const trail = trailsRef.current[playerId]
      updateTrail(trail, player, now)
      playerElements.push(
        renderPlayer(
          playerId,
          player,
          xOffset,
          cameraY,
          height,
          scale,
          scaledLaneWidth,
          screenCenterY,
          screenHeightInGameUnits,
          now
        )
      )
    }

    // Render current player last (on top)
    if (yourPlayerId && game.players[yourPlayerId]) {
      const player = game.players[yourPlayerId]
      const trail = trailsRef.current[yourPlayerId]
      updateTrail(trail, player, now)
      playerElements.push(
        renderPlayer(
          yourPlayerId,
          player,
          xOffset,
          cameraY,
          height,
          scale,
          scaledLaneWidth,
          screenCenterY,
          screenHeightInGameUnits,
          now
        )
      )
    }

    return playerElements
  }

  return (
    <>
      {/* Draw trails */}
      <Graphics
        key={`trails-${JSON.stringify(game.players)}`}
        draw={(g) => {
          g.clear()
          const now = performance.now()

          // Draw trails for all players
          for (const [playerId, player] of Object.entries(game.players)) {
            const trail = trailsRef.current[playerId]
            drawTrail(
              g,
              player,
              xOffset,
              cameraY,
              height,
              scaledLaneWidth,
              screenCenterY,
              screenHeightInGameUnits,
              trail,
              now
            )
          }
        }}
      />

      {/* Draw player sprites */}
      <Container key={`player-sprites`}>{renderPlayers()}</Container>

      {/* Draw strike effects on top */}
      {renderStrikeEffects()}
    </>
  )
}

export default Players

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function updateTrail(trail: PlayerTrail, player: PlayerState, now: number) {
  const timeSinceLastUpdate = now - trail.lastUpdate

  if (timeSinceLastUpdate > 32 && !player.knockbackEndTime) {
    trail.points.unshift({
      lane: player.x,
      worldY: player.y,
      timestamp: now,
    })
    trail.lastUpdate = now
    if (trail.points.length > 15) {
      trail.points.pop()
    }
  } else if (player.knockbackEndTime) {
    trail.points.length = 0
  }
}

// Helper function to create smooth curves using Catmull-Rom interpolation
function getCurvePoints(
  points: { x: number; y: number }[]
): { x: number; y: number }[] {
  if (points.length < 2) return points

  const curvePoints: { x: number; y: number }[] = []
  const segmentsPerCurve = 8

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    for (let t = 0; t < segmentsPerCurve; t++) {
      const tNorm = t / segmentsPerCurve
      const tSq = tNorm * tNorm
      const tCube = tSq * tNorm

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * tNorm +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * tSq +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * tCube)

      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * tNorm +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * tSq +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * tCube)

      curvePoints.push({ x, y })
    }
  }

  if (points.length > 0) {
    curvePoints.push(points[points.length - 1])
  }

  return curvePoints
}

function drawTrail(
  g: PixiGraphics,
  player: PlayerState,
  xOffset: number,
  cameraY: number,
  height: number,
  laneWidth: number,
  centerY: number,
  screenHeightInGameUnits: number,
  trail: PlayerTrail,
  now: number
) {
  const relativeY = player.y - cameraY
  if (Math.abs(relativeY) > screenHeightInGameUnits / 2) {
    return
  }

  if (player.knockbackEndTime) {
    return // Don't draw trail during knockback
  }

  let color =
    player.character != null && PLAYER_COLORS[player.character] != null
      ? PLAYER_COLORS[player.character]
      : 0x202020
  if (player.boosting) {
    color = lightenColor(color, 0.5)
  }

  // Build array of screen positions including current player position
  const screenPoints: { x: number; y: number; age: number }[] = []

  // Add current player position as the first point (age 0)
  const currentX = xOffset + laneWidth * (player.x + 0.5)
  const currentRelY = player.y - cameraY
  const currentY = centerY - (currentRelY / screenHeightInGameUnits) * height
  screenPoints.push({ x: currentX, y: currentY, age: 0 })

  // Add trail points
  for (let i = 0; i < trail.points.length; i++) {
    const point = trail.points[i]
    const x = xOffset + laneWidth * (point.lane + 0.5)
    const relY = point.worldY - cameraY
    const y = centerY - (relY / screenHeightInGameUnits) * height
    const age = (now - point.timestamp) / 1000
    screenPoints.push({ x, y, age })
  }

  if (screenPoints.length < 2) return

  // Apply curve smoothing
  const smoothPoints = getCurvePoints(screenPoints)

  // Calculate base parameters
  const totalPoints = smoothPoints.length
  let baseAlpha = 1.0
  if (!player.boosting) {
    baseAlpha *= 0.6
  }

  // Draw three passes for gradient effect
  const passes = [
    { widthMult: 1.8, alphaMult: 0.2 }, // Outer glow
    { widthMult: 1.0, alphaMult: 0.5 }, // Middle layer
    { widthMult: 0.4, alphaMult: 0.9, useCore: true }, // Bright core
  ]

  for (const pass of passes) {
    for (let i = 0; i < smoothPoints.length - 1; i++) {
      const p1 = smoothPoints[i]
      const p2 = smoothPoints[i + 1]

      // Calculate fade based on original trail point indices
      const originalIndex = Math.floor((i / totalPoints) * trail.points.length)
      const ageFactor = Math.max(
        0,
        1 -
          screenPoints[Math.min(originalIndex + 1, screenPoints.length - 1)].age
      )

      const segmentAlpha = baseAlpha * ageFactor * pass.alphaMult

      // Width tapers along the trail
      const widthFactor = 1 - i / totalPoints
      let segmentWidth = Math.max(2, 16 * widthFactor)
      if (player.boosting) {
        segmentWidth *= 1.25
      }
      segmentWidth *= pass.widthMult

      // Use lightened color for the bright core
      const drawColor = pass.useCore ? lightenColor(color, 0.3) : color

      g.lineStyle(segmentWidth, drawColor, segmentAlpha)
      g.moveTo(p1.x, p1.y)
      g.lineTo(p2.x, p2.y)
    }
  }
}

function renderPlayer(
  playerId: PlayerId,
  player: PlayerState,
  xOffset: number,
  cameraY: number,
  height: number,
  scale: number,
  scaledLaneWidth: number,
  centerY: number,
  screenHeightInGameUnits: number,
  now: number
) {
  const laneCentered = player.x + 0.5
  const x = xOffset + scaledLaneWidth * laneCentered
  const relativeY = player.y - cameraY

  if (Math.abs(relativeY) > screenHeightInGameUnits / 2) {
    return null
  }

  let alpha = 1

  if (player.knockbackEndTime) {
    const knockbackProgress =
      (player.knockbackEndTime - now) / KNOCKBACK_RECOVERY_TIME_MS
    alpha = Math.cos(knockbackProgress * Math.PI * 4) * 0.5 + 0.5
  }

  // Pure coordinate conversion - no speedY offset
  const y = centerY - (relativeY / screenHeightInGameUnits) * height

  // Get sprite image based on character
  const spriteImage =
    player.character != null && CHARACTER_SPRITES[player.character]
      ? CHARACTER_SPRITES[player.character]
      : DEFAULT_SPRITE

  // Apply color tint when boosting
  let tint = 0xffffff // White (no tint)
  if (
    player.boosting &&
    player.character != null &&
    PLAYER_COLORS[player.character] != null
  ) {
    tint = lightenColor(PLAYER_COLORS[player.character], 0.5)
  }

  return (
    <Sprite
      key={`player-${playerId}`}
      image={spriteImage}
      x={x}
      y={y}
      anchor={0.5}
      scale={scale}
      alpha={alpha}
      tint={tint}
    />
  )
}
