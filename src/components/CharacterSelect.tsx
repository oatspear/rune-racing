// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

import { PlayableCharacter, GameState } from "../logic"
import { PLAYER_COLORS } from "../client_constants"
import { PlayerId } from "rune-sdk"

interface CharacterSelectProps {
  game: GameState
  yourPlayerId?: PlayerId
}

const CharacterNames = {
  [PlayableCharacter.BLUE]: "Sapphire",
  [PlayableCharacter.RED]: "Ruby",
  [PlayableCharacter.GREEN]: "Emerald",
  [PlayableCharacter.PURPLE]: "Amethyst",
}

const CharacterSelect = ({ game, yourPlayerId }: CharacterSelectProps) => {
  if (!yourPlayerId) return null

  const yourPlayer = game.players[yourPlayerId]
  if (!yourPlayer) return null

  // Get ready status of all players
  const allPlayersReady = Object.values(game.players).every(
    (p) => p.ready && p.character !== null
  )

  return (
    <div className="character-select">
      <h1>Character Selection</h1>
      <div className="character-grid">
        {Object.values(PlayableCharacter)
          .filter((c): c is PlayableCharacter => typeof c === "number")
          .map((character) => {
            const isSelected = Object.values(game.players).some(
              (p) => p.character === character
            )
            // get the name of the player who selected this character
            const selectedPlayerId = Object.entries(game.players).find(
              ([, p]) => p.character === character
            )?.[0]
            const selectedPlayerName = selectedPlayerId
              ? Rune.getPlayerInfo(selectedPlayerId)?.displayName || ""
              : ""
            const isYourCharacter = yourPlayer.character === character
            const canSelect = !isSelected || isYourCharacter

            return (
              <button
                key={character}
                className={`character-button ${
                  isSelected ? "selected" : ""
                } ${isYourCharacter ? "yours" : ""}`}
                onClick={() => {
                  if (!canSelect) return
                  if (isYourCharacter) {
                    // Deselect
                    Rune.actions.selectCharacter({ character: null })
                  } else {
                    // Select new character
                    Rune.actions.selectCharacter({ character })
                  }
                }}
                disabled={!canSelect}
                style={{
                  backgroundColor: `#${PLAYER_COLORS[character]
                    .toString(16)
                    .padStart(6, "0")}`,
                }}
              >
                <span className="character-name">
                  {CharacterNames[character]}
                </span>
                {isSelected && !isYourCharacter && (
                  <span className="taken-by">{selectedPlayerName}</span>
                )}
              </button>
            )
          })}
      </div>

      <div className="ready-section">
        <button
          className={`ready-button ${yourPlayer.ready ? "ready" : ""}`}
          onClick={() => Rune.actions.toggleReady()}
          disabled={yourPlayer.character === null}
        >
          {yourPlayer.ready ? "Ready!" : "Ready Up"}
        </button>

        {allPlayersReady && (
          <div className="all-ready-message">
            All players ready! Game starting...
          </div>
        )}
      </div>
    </div>
  )
}

export default CharacterSelect
