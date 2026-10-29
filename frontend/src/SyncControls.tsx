import { Download, LoaderCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, ApiError, type SyncResult } from './api'
import { useApp } from './state'

const syncErrors: Record<string, string> = {
  sync_cooldown: 'Vừa đồng bộ game này. Vui lòng chờ 60 giây trước khi thử lại.',
  ingestion_busy: 'Một lượt nhập hoặc đồng bộ đang chạy. Vui lòng thử lại sau.',
  sync_source_unavailable: 'Chưa thể hoàn tất lấy kỳ mới từ Vietlott. Vui lòng thử lại sau.',
  sync_review_pending: 'Dữ liệu nguồn thay đổi và cần được kiểm tra trước khi cập nhật.',
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
        ? `đã thêm ${result.created} kỳ mới.`
        : result.enriched
          ? 'đã bổ sung thông tin giải thưởng.'
          : 'đã kiểm tra nguồn, không có kỳ mới.'
      const backlog = result.remaining_unresolved
        ? ` Còn ${result.remaining_unresolved} kỳ lịch sử chưa hoàn tất.`
        : ''
      setNotice({ error: false, text: `${selected.label}: ${outcome}${backlog}` })
    } catch (error) {
      const message =
        error instanceof ApiError && error.code && syncErrors[error.code]
          ? syncErrors[error.code]
          : error instanceof Error
            ? error.message
            : 'Không thể đồng bộ lúc này.'
      setNotice({
        error: true,
        text: `${selected.label}: ${message} Dữ liệu đã lưu vẫn được giữ.`,
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
        className="btn sync-trigger"
        title={`Lấy kỳ mới từ Vietlott cho ${game?.label ?? 'game đang chọn'}`}
        aria-label={pending ? 'Đang đồng bộ…' : 'Tải dữ liệu'}
        disabled={!game || pending}
        onClick={sync}
      >
        {pending ? (
          <LoaderCircle size={16} aria-hidden="true" />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
        <span>{pending ? 'Đang đồng bộ…' : 'Tải dữ liệu'}</span>
      </button>
      {(pending || notice) && (
        <div className="sync-feedback">
          {pending && <p role="status">Đang lấy dữ liệu, vui lòng đợi…</p>}
          {notice && (
            <p
              className={`notice${notice.error ? ' error' : ''}`}
              role={notice.error ? 'alert' : 'status'}
            >
              {notice.text}
            </p>
          )}
          {notice && (
            <button className="btn ghost" onClick={() => setNotice(null)}>
              Đóng thông báo đồng bộ
            </button>
          )}
        </div>
      )}
    </div>
  )
}
