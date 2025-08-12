// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { PlayableCharacter } from "./logic"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const LANE_MARGIN = 30
export const VISIBLE_TRACK_HEIGHT = 240 // How much of track to show ahead/behind in game units
export const TRACK_LENGTH = 2400

export const PLAYER_COLORS = {
  [PlayableCharacter.BLUE]: 0x1e90ff, // Sapphire Blue
  [PlayableCharacter.RED]: 0xc72c48, // Ruby Red
  [PlayableCharacter.GREEN]: 0x50c878, // Emerald Green
  [PlayableCharacter.PURPLE]: 0x800080, // Amethyst Purple
}
