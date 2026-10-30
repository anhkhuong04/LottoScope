import { useApp } from '../state'
import DrawMachine from '../features/draw-machine/DrawMachine'

export function Generator() {
  const { game, window } = useApp()
  return <DrawMachine key={game!.id} game={game!} analysisWindow={window} />
}
