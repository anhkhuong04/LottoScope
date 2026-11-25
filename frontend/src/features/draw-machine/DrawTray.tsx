import type { Game } from '../../api'
import type { Snapshot } from './session'

export function DrawTray({
  snapshot,
  game,
  specialMax,
}: {
  snapshot: Snapshot
  game: Game
  specialMax: number | null
}) {
  const hasSpecial = specialMax !== null
  return (
    <div className={`draw-tray${hasSpecial ? ' has-special' : ''}`}>
      <ol
        className="draw-result-slots"
        aria-label="Draw sequence"
        style={{ gridTemplateColumns: `repeat(${game.main_count}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: game.main_count }, (_, i) => (
          <li key={i}>
            <span className={`draw-slot${snapshot.drawn[i] !== undefined ? ' filled' : ''}`}>
              {snapshot.drawn[i] === undefined ? '—' : String(snapshot.drawn[i]).padStart(2, '0')}
            </span>
            <small>Ball {i + 1}</small>
          </li>
        ))}
      </ol>

      {hasSpecial && (
        <div className="draw-special-result" aria-label="Special Number">
          <span className={`draw-slot special${snapshot.specialNumber !== null ? ' filled' : ''}`}>
            {snapshot.specialNumber === null
              ? '—'
              : String(snapshot.specialNumber).padStart(2, '0')}
          </span>
          <div>
            <strong>Special Number</strong>
            <small>
              Red chamber · {game.special_min}–{specialMax}
            </small>
          </div>
        </div>
      )}
    </div>
  )
}
