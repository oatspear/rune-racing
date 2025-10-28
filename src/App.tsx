// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

// -----------------------------------------------------------------------------
// Imports
// -----------------------------------------------------------------------------

import { Stage } from "@pixi/react"
import { useEffect, useState } from "react"
import { PlayerId } from "rune-sdk"
import { GameState, GamePhase } from "./logic.ts"
import ScoreHUD from "./components/ScoreHUD.tsx"
import CharacterSelect from "./components/CharacterSelect.tsx"
// import Notifications from "./components/Notifications.tsx"

import trackTexturePath from "./assets/racetrack.png"
import { Assets, Texture } from "pixi.js"
import GameCanvas from "./components/GameCanvas.tsx"

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const App = () => {
  const [game, setGame] = useState<GameState>()
  const [yourPlayerId, setYourPlayerId] = useState<PlayerId | undefined>()
  const [trackTexture, setTrackTexture] = useState<Texture | undefined>()

  useEffect(() => {
    Assets.load(trackTexturePath).then(setTrackTexture)
    setTrackTexture(Texture.from(trackTexturePath))

    Rune.initClient({
      onChange: ({ game, yourPlayerId }) => {
        setGame(game)
        setYourPlayerId(yourPlayerId)
      },
    })
  }, [])

  if (!game) {
    return null
  }

  return (
    <>
      {game.phase === GamePhase.CHARACTER_SELECT ? (
        <CharacterSelect game={game} yourPlayerId={yourPlayerId} />
      ) : (
        <>
          <div id="board-container">
            <Stage
              options={{ backgroundAlpha: 0 }}
              width={window.innerWidth}
              height={window.innerHeight}
            >
              <GameCanvas
                game={game}
                yourPlayerId={yourPlayerId}
                trackTexture={trackTexture}
              />
            </Stage>
            <ScoreHUD game={game} yourPlayerId={yourPlayerId} />
          </div>

          <div id="controls-hud">
            <div className="control-buttons">
              <button
                className="control-button"
                onPointerDown={() => Rune.actions.startBoost()}
                onPointerUp={() => Rune.actions.stopBoost()}
                onPointerLeave={() => Rune.actions.stopBoost()}
                onTouchStart={(e) => {
                  e.preventDefault() // Prevent double-firing with pointer events
                  Rune.actions.startBoost()
                }}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  Rune.actions.stopBoost()
                }}
                onTouchCancel={(e) => {
                  e.preventDefault()
                  Rune.actions.stopBoost()
                }}
              >
                Boost
              </button>
              <button
                className="control-button"
                onPointerDown={() => {
                  Rune.actions.strike()
                }}
                onTouchStart={(e) => {
                  e.preventDefault() // Prevent double-firing with pointer events
                  Rune.actions.strike()
                }}
              >
                Strike
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default App
