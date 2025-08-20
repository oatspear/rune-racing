// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

import { PlayerId } from "rune-sdk"

interface StrikeNotificationProps {
  type: "striker" | "target"
  playerId: PlayerId
  onComplete: () => void
}

const StrikeNotification = ({
  type,
  playerId,
  onComplete,
}: StrikeNotificationProps) => {
  return (
    <div
      className={`strike-notification ${type} animate__animated animate__slideInRight animate__faster`}
      onAnimationEnd={onComplete}
    >
      <img
        src={Rune.getPlayerInfo(playerId).avatarUrl}
        alt={type === "striker" ? "Striker" : "Target"}
        className="character-icon"
      />
      <span>{type === "striker" ? "Hit!" : "Strike!"}</span>
    </div>
  )
}

export default StrikeNotification
