import { CanvasTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'
import { SIGN_CELL, type SignEntry } from './envGeometry'

/** Draws every sign into one canvas atlas (one row per sign). Browser only: returns null without a DOM. */
export function createSignTexture(entries: readonly SignEntry[]): CanvasTexture | null {
  if (typeof document === 'undefined' || entries.length === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = SIGN_CELL.w
  canvas.height = SIGN_CELL.h * entries.length
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const draw = () => {
    entries.forEach((e, i) => {
      const y = i * SIGN_CELL.h
      ctx.fillStyle = e.board
      ctx.fillRect(0, y, SIGN_CELL.w, SIGN_CELL.h)
      // The cell is stretched onto a board of a different shape; squeeze the text so it ends up undistorted.
      const squeeze = e.aspect / (SIGN_CELL.w / SIGN_CELL.h)
      let size = SIGN_CELL.h * 0.62
      const font = (px: number) => `700 ${px}px "Space Grotesk", "DM Sans", system-ui, sans-serif`
      ctx.font = font(size)
      const measured = ctx.measureText(e.text).width * squeeze
      if (measured > SIGN_CELL.w * 0.9) {
        size *= (SIGN_CELL.w * 0.9) / measured
        ctx.font = font(size)
      }
      ctx.save()
      ctx.translate(SIGN_CELL.w / 2, y + SIGN_CELL.h / 2)
      ctx.scale(squeeze, 1)
      ctx.fillStyle = e.ink
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(e.text, 0, 2)
      ctx.restore()
      ctx.strokeStyle = e.ink
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 4
      ctx.strokeRect(6, y + 6, SIGN_CELL.w - 12, SIGN_CELL.h - 12)
      ctx.globalAlpha = 1
    })
  }
  draw()
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  texture.minFilter = LinearMipmapLinearFilter
  // Redraw once the web fonts are available, so signs use the game's typeface.
  void document.fonts?.ready.then(() => {
    draw()
    texture.needsUpdate = true
  })
  return texture
}
