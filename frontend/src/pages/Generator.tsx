import { useApp } from '../state'
import DrawMachine from '../features/draw-machine/DrawMachine'
import { Link } from 'react-router'
import { globalSearch } from '../api'

export function Generator() {
  const { game, window } = useApp()
  return (
    <>
      <p className="machine-preview-entry">
        <Link to={`/generator/preview${globalSearch(game!.id, window)}`}>
          Xem thiết kế lồng cầu mới
        </Link>
      </p>
      <DrawMachine key={game!.id} game={game!} analysisWindow={window} />
    </>
  )
}
