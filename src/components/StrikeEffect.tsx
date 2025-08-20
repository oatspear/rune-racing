// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2025 André "Oats" Santos

import { Graphics } from "@pixi/react"
import { Graphics as PixiGraphics } from "pixi.js"
import { useMemo } from "react"

interface StrikeEffectProps {
  x: number
  y: number
  radius: number // Base radius of the effect
  time: number // Current time for animation
}

const StrikeEffect = ({ x, y, radius, time }: StrikeEffectProps) => {
  // Memoize our draw function to avoid recreating it every frame
  const draw = useMemo(() => {
    return (g: PixiGraphics) => {
      g.clear()

      // Number of spiral arms
      const arms = 4
      // Number of segments per arm
      const segments = 12

      // For each spiral arm
      for (let arm = 0; arm < arms; arm++) {
        // Base rotation for this arm
        const armRotation = (arm * Math.PI * 2) / arms + time * 2

        // Start with no alpha
        g.lineStyle(2, 0xffffff, 0)
        g.moveTo(x, y)

        // Draw each segment of the spiral
        for (let i = 0; i <= segments; i++) {
          const t = i / segments
          // Increase radius as we go out
          const r = radius * t
          // Rotate more as we go out
          const rotation =
            armRotation +
            t * Math.PI * 4 +
            Math.sin(time * 4 + t * Math.PI * 2) * 0.2

          // Calculate position
          const px = x + Math.cos(rotation) * r
          const py = y + Math.sin(rotation) * r

          // Fade in in the middle, fade out at the ends
          const alpha = Math.sin(t * Math.PI)
          g.lineStyle(2, 0xffffff, alpha * 0.5)
          g.lineTo(px, py)
        }
      }

      // Add some particles
      const particles = 8
      for (let i = 0; i < particles; i++) {
        const particleTime = (time * 3 + i / particles) % 1
        const r = radius * particleTime
        const rotation = time * 4 + (i * Math.PI * 2) / particles

        const px = x + Math.cos(rotation) * r
        const py = y + Math.sin(rotation) * r

        // Fade out as they go outward
        const alpha = 1 - particleTime
        g.lineStyle(0)
        g.beginFill(0xffffff, alpha * 0.7)
        g.drawCircle(px, py, 2)
        g.endFill()
      }
    }
  }, [x, y, radius, time])

  return <Graphics draw={draw} />
}

export default StrikeEffect
