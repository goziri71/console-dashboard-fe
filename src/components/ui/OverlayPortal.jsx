import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders overlays at document.body so position:fixed covers the viewport
 * (avoids broken positioning inside scroll/transform ancestors).
 */
export default function OverlayPortal({ children, open = true }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
