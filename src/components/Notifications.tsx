// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

import { PlayerId } from "rune-sdk"
import { StrikeEvent } from "../logic"
import { useState, useEffect, useMemo, memo } from "react"

const NOTIFICATION_TIMEOUT = 1000

interface EventNotificationProps {
  type: "striker" | "target"
  playerId: PlayerId
  timestamp: number
}

// Memoized notification component
const EventNotification = memo(({ type, playerId }: EventNotificationProps) => {
  const playerInfo = Rune.getPlayerInfo(playerId)
  return (
    <div
      className={`strike-notification ${type} animate__animated animate__slideInRight animate__faster`}
    >
      <img
        src={playerInfo.avatarUrl}
        alt={type === "striker" ? "Striker" : "Target"}
        className="character-icon"
      />
      <span>{type === "striker" ? "Hit!" : "Strike!"}</span>
    </div>
  )
})
EventNotification.displayName = "EventNotification"

interface NotificationsProps {
  currentTime: number
  yourPlayerId?: PlayerId
  strikeEvent?: StrikeEvent
}

const Notifications = ({
  currentTime,
  yourPlayerId,
  strikeEvent,
}: NotificationsProps) => {
  const [lastHit, setLastHit] = useState<StrikeEvent | null>(null)
  const [lastTarget, setLastTarget] = useState<StrikeEvent | null>(null)

  // Effect to handle strike event updates
  useEffect(() => {
    if (!strikeEvent || !yourPlayerId) return

    if (strikeEvent.strikerId === yourPlayerId) {
      if (!lastHit || lastHit.timestamp !== strikeEvent.timestamp) {
        setLastHit(strikeEvent)
      }
    } else if (strikeEvent.targetId === yourPlayerId) {
      if (!lastTarget || lastTarget.timestamp !== strikeEvent.timestamp) {
        setLastTarget(strikeEvent)
      }
    }
  }, [strikeEvent, yourPlayerId, lastHit, lastTarget])

  // Effect to handle notification timeouts
  useEffect(() => {
    if (lastHit && lastHit.timestamp + NOTIFICATION_TIMEOUT <= currentTime) {
      setLastHit(null)
    }
    if (
      lastTarget &&
      lastTarget.timestamp + NOTIFICATION_TIMEOUT <= currentTime
    ) {
      setLastTarget(null)
    }
  }, [currentTime, lastHit, lastTarget])

  // Memoize both notifications together
  const renderedNotifications = useMemo(() => {
    const notifs = []

    if (lastTarget && yourPlayerId === lastTarget.targetId) {
      notifs.push(
        <EventNotification
          key={`target-${lastTarget.timestamp}`}
          type="target"
          playerId={lastTarget.strikerId}
          timestamp={lastTarget.timestamp}
        />
      )
    }

    if (lastHit && yourPlayerId === lastHit.strikerId) {
      notifs.push(
        <EventNotification
          key={`hit-${lastHit.timestamp}`}
          type="striker"
          playerId={lastHit.targetId}
          timestamp={lastHit.timestamp}
        />
      )
    }

    return notifs
  }, [lastHit, lastTarget, yourPlayerId])

  return <div className="notifications-container">{renderedNotifications}</div>
}

export default Notifications
