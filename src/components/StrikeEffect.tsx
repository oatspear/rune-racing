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

      // Number of radial arms
      const arms = 6
      // Number of segments per arm
      const segments = 12

      // For each radial arm
      for (let arm = 0; arm < arms; arm++) {
        // Base rotation for this arm
        const armRotation = (arm * Math.PI * 2) / arms + time * 5 // Faster rotation

        // Start with no alpha
        g.lineStyle(3, 0xffffff, 0)
        g.moveTo(x, y)

        // Draw each segment of the spiral
        for (let i = 0; i <= segments; i++) {
          const t = i / segments
          // Add spiky variation to radius
          const radiusVariation = Math.sin(t * Math.PI * 6) * 0.4 + 1
          const r = radius * t * radiusVariation
          // Minimal spiral, mostly radial with some wobble
          const rotation =
            armRotation +
            t * Math.PI * 0.5 + // Very slight curve (reduced from 6 to 0.5)
            Math.sin(time * 8 + t * Math.PI * 3) * 0.3 // Subtle wobble

          // Calculate position
          const px = x + Math.cos(rotation) * r
          const py = y + Math.sin(rotation) * r

          // Fade in in the middle, fade out at the ends with sharper falloff
          const alpha = Math.pow(Math.sin(t * Math.PI), 1.5) // Sharper fade
          // Thicker lines at the peaks
          const lineWidth = 2 + Math.sin(t * Math.PI * 6) * 2
          g.lineStyle(lineWidth, 0xffffff, alpha * 0.7)
          g.lineTo(px, py)
        }
      }

      // Add particles that follow the arms
      const particles = 18
      for (let i = 0; i < particles; i++) {
        const particleTime = (time * 5 + i / particles) % 1
        const r = radius * particleTime * (0.9 + Math.sin(time * 6 + i) * 0.15)
        // Align particles more with the arms
        const baseRotation = (Math.floor(i / 3) * (Math.PI * 2)) / 6
        const rotation = baseRotation + time * 5 + Math.sin(time * 4) * 0.2

        const px = x + Math.cos(rotation) * r
        const py = y + Math.sin(rotation) * r

        // Sharper fade out
        const alpha = Math.pow(1 - particleTime, 1.5) * 0.8
        g.lineStyle(0)
        g.beginFill(0xffffff, alpha)
        // Smaller, more consistent particles
        const size = 1.2 + Math.sin(time * 6 + i) * 0.4
        g.drawCircle(px, py, size)
        g.endFill()
      }
    }
  }, [x, y, radius, time])

  return <Graphics draw={draw} />
}

export default StrikeEffect
