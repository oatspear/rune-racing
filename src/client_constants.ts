// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import {
  NUM_LANES,
  OBSTACLE_RADIUS,
  PlayableCharacter,
  PLAYER_RADIUS,
} from "./logic"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const CLIENT_SCALING_FACTOR = 8 // Adjusts overall size of game elements on screen

export const TRACK_LENGTH = 2400

// Game space dimensions (pixels)
export const PLAYER_RADIUS_PX = PLAYER_RADIUS * CLIENT_SCALING_FACTOR
export const OBSTACLE_RADIUS_PX = OBSTACLE_RADIUS * CLIENT_SCALING_FACTOR
export const LANE_WIDTH_PX = PLAYER_RADIUS * CLIENT_SCALING_FACTOR * 1.5
export const TRACK_WIDTH_PX = NUM_LANES * LANE_WIDTH_PX // 5 lanes × 96px each - center of texture

export const PLAYER_COLORS = {
  [PlayableCharacter.BLUE]: 0x1e90ff, // Sapphire Blue
  [PlayableCharacter.RED]: 0xc72c48, // Ruby Red
  [PlayableCharacter.GREEN]: 0x50c878, // Emerald Green
  [PlayableCharacter.PURPLE]: 0x800080, // Amethyst Purple
}

export const PLAYER_OUTLINE_COLORS = {
  [PlayableCharacter.BLUE]: 0xffc0cb, // Pastel Yellow
  [PlayableCharacter.RED]: 0x2c2c2c, // Almost Black
  [PlayableCharacter.GREEN]: 0xfafafa, // Almost White
  [PlayableCharacter.PURPLE]: 0xff00ff, // Neon Pink
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Calculate scale factor with smart stepping
 * Always ensures 480px playable area fits on screen
 */
export function calculateScale(screenWidth: number): number {
  // const baseScale = screenWidth / GAME_WIDTH

  // Define scale steps for clean rendering
  const scaleSteps = [0.25, 0.5, 1.0, 2.0, 3.0, 4.0]

  // Find the largest step that fits
  for (let i = scaleSteps.length - 1; i >= 0; i--) {
    if (TRACK_WIDTH_PX * scaleSteps[i] <= screenWidth) {
      return scaleSteps[i]
    }
  }

  // Fallback to smallest scale
  return scaleSteps[0]
}

/**
 * Lightens a color by a specified factor (between 0 and 1).
 * Used for both boosting players and strike effects.
 */
export function lightenColor(color: number, factor: number): number {
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff

  const newR = Math.min(255, r + (255 - r) * factor)
  const newG = Math.min(255, g + (255 - g) * factor)
  const newB = Math.min(255, b + (255 - b) * factor)

  return (newR << 16) | (newG << 8) | newB
}
