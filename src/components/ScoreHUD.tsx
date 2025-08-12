// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { PlayerId } from "rune-sdk"
import { GameState } from "../logic"
import { PLAYER_COLORS } from "../client_constants"

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

type ScoreHUDProps = {
  game: GameState
  yourPlayerId?: PlayerId
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const ScoreHUD = ({ game, yourPlayerId }: ScoreHUDProps) => {
  if (!yourPlayerId || !game.players[yourPlayerId]) return null

  const player = game.players[yourPlayerId]
  const color = PLAYER_COLORS[player.character] || 0xffffff

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
          backgroundColor: `#${color.toString(16).padStart(6, "0")}`,
        }}
      />
      <span>Pickups: {player.score}</span>
    </div>
  )
}

export default ScoreHUD
