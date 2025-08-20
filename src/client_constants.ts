// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { PlayableCharacter } from "./logic"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const LANE_MARGIN = 40 // Side margin for the track
export const VISIBLE_TRACK_HEIGHT = 360 // How much of track to show ahead/behind in game units
export const TRACK_LENGTH = 2400

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
