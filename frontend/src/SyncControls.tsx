import { LoaderCircle, RefreshCw, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, ApiError, type SyncResult } from './api'
import { useApp } from './state'

const syncErrors: Record<string, string> = {
  sync_cooldown: 'This game was recently synced. Please wait 60 seconds before trying again.',
  ingestion_busy: 'An ingestion or sync is already in progress. Please try again later.',
  sync_source_unavailable: 'Unable to fetch new draws right now. Please try again later.',
  sync_review_pending: 'Source data changed and requires review before updating.',
}

export function SyncControls() {
  const { game, refreshData } = useApp()
  const running = useRef(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null)

  async function sync() {
    if (!game || running.current) return
    const selected = game
    running.current = true
    setPending(true)
    setNotice(null)
    try {
      const result = await api<SyncResult>(`/games/${selected.id}/sync`, undefined, {})
      const outcome = result.created
        ? `added ${result.created} new draw(s).`
        : result.enriched
          ? 'updated prize breakdown.'
          : 'checked source, no new draws found.'
      const backlog = result.remaining_unresolved
        ? ` ${result.remaining_unresolved} unresolved historical draw(s) remain.`
        : ''
      setNotice({ error: false, text: `${selected.label}: ${outcome}${backlog}` })
    } catch (error) {
      const message =
        error instanceof ApiError && error.code && syncErrors[error.code]
          ? syncErrors[error.code]
          : error instanceof Error
            ? error.message
            : 'Unable to sync at this time.'
      setNotice({
        error: true,
        text: `${selected.label}: ${message} Stored data has been preserved.`,
      })
    } finally {
      running.current = false
      setPending(false)
      refreshData()
    }
  }

  return (
    <div className="sync-controls">
      <button
        className={`btn sync-trigger${pending ? ' is-loading' : ''}`}
        title={`Fetch new draws for ${game?.label ?? 'selected game'}`}
        aria-label={pending ? 'Syncing…' : 'Sync'}
        disabled={!game || pending}
        onClick={sync}
      >
        {pending ? (
          <LoaderCircle size={16} aria-hidden="true" />
        ) : (
          <RefreshCw size={16} aria-hidden="true" />
        )}
        <span>{pending ? 'Syncing…' : 'Sync'}</span>
      </button>
      {(pending || notice) && (
        <div className="sync-feedback">
          {pending && <p role="status">Fetching data, please wait…</p>}
          {notice && (
            <p
              className={`notice${notice.error ? ' error' : ''}`}
              role={notice.error ? 'alert' : 'status'}
            >
              {notice.text}
            </p>
          )}
          {notice && (
            <button
              className="btn ghost sync-dismiss"
              aria-label="Dismiss sync notice"
              title="Dismiss notice"
              onClick={() => setNotice(null)}
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
