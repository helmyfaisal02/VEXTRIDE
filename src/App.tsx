import { Component, type ReactNode } from 'react'
import { GameCanvas } from '@/game/GameCanvas'
import { Hud } from '@/game/hud/Hud'

interface BoundaryState {
  error: Error | null
}

/** Shows a readable message if WebGL or Rapier fails to initialise. */
class GameErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#223a63] px-6 text-center text-white">
          <h1 className="font-display text-2xl font-bold uppercase" style={{ letterSpacing: '0.14em' }}>
            Vextride
          </h1>
          <p className="text-sm text-white/80">
            The 3D engine could not start. Check that WebGL is enabled in your browser.
          </p>
          <p className="max-w-md text-xs text-white/60">{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <main className="relative h-full w-full">
      <GameErrorBoundary>
        <GameCanvas />
        <Hud />
      </GameErrorBoundary>
    </main>
  )
}
