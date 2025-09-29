// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

import { Sprite } from "@pixi/react"
import { BaseTexture, Rectangle, Texture, SCALE_MODES } from "pixi.js"
import { useMemo } from "react"
import strikeEffectImage from "../assets/strike-effect.png"
import { PlayableCharacter } from "../logic"

interface StrikeEffectProps {
  x: number
  y: number
  radius: number // Used for scaling
  time: number // Used for frame calculation
  character?: PlayableCharacter // Character type determines effect row
}

const SPRITE_SIZE = 64 // Size of each sprite in the sheet
const FRAME_COUNT = 13 // Number of frames in the animation
const EFFECT_ROWS = {
  [PlayableCharacter.BLUE]: 2, // row 2 for blue
  [PlayableCharacter.RED]: 7, // row 7 for red
  [PlayableCharacter.GREEN]: 3, // row 3 for green
  [PlayableCharacter.PURPLE]: 1, // row 1 for purple
} as const

const StrikeEffect = ({ x, y, radius, time, character }: StrikeEffectProps) => {
  // Create and cache textures from spritesheet
  const textures = useMemo(() => {
    const baseTexture = BaseTexture.from(strikeEffectImage)
    baseTexture.scaleMode = SCALE_MODES.LINEAR

    const row = character !== undefined ? EFFECT_ROWS[character] : 0
    const frames: Texture[] = []
    for (let i = 0; i < FRAME_COUNT; i++) {
      frames.push(
        new Texture(
          baseTexture,
          new Rectangle(
            i * SPRITE_SIZE,
            row * SPRITE_SIZE,
            SPRITE_SIZE,
            SPRITE_SIZE
          )
        )
      )
    }

    // Load the texture if not already loaded
    if (!baseTexture.valid) {
      baseTexture.once("loaded", () => {
        // Force a re-render when texture loads
        frames.forEach((texture) => texture.update())
      })
    }

    return frames
  }, [character]) // Recreate textures when character changes
  const frame = Math.floor(time * FRAME_COUNT)
  const frameIndex = Math.min(frame, FRAME_COUNT - 1) // Don't loop, stay on last frame

  // Calculate sprite properties
  const scale = (radius * 2) / SPRITE_SIZE // Scale to match the desired radius
  const anchorX = 0.5
  const anchorY = 0.5

  return (
    <Sprite
      texture={textures[frameIndex]}
      x={x}
      y={y}
      anchor={{ x: anchorX, y: anchorY }}
      scale={{ x: scale, y: scale }}
    />
  )
}

export default StrikeEffect
