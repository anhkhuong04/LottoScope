import { ArrowRight, Clock3 } from 'lucide-react'
import { Link } from 'react-router'
import {
  api,
  globalSearch,
  params,
  windowQuery,
  type Draw,
  type NumbersResponse,
  type PairsResponse,
  type Page,
  type Status,
} from '../api'
import { useApp, useQuery } from '../state'
import {
  Balls,
  Card,
  DataState,
  DrawRows,
  FrequencyTile,
  PageHead,
  PairLink,
  WindowSelector,
  formatVietnamTime,
} from '../ui'

export function Dashboard() {
  const { game, window } = useApp()
  const search = globalSearch(game!.id, window)
  const base = `/games/${game!.id}`
  const query = params(windowQuery(window))
  const latest = useQuery(`${base}/draws/latest`, (signal) =>
    api<Draw>(`${base}/draws/latest`, signal),
  )
  const status = useQuery(`${base}/status`, (signal) => api<Status>(`${base}/status`, signal))
  const numbers = useQuery(`${base}/analytics/numbers?${query}`, (signal) =>
    api<NumbersResponse>(`${base}/analytics/numbers?${query}`, signal),
  )
  const pairs = useQuery(`${base}/analytics/pairs?${query}&page_size=5`, (signal) =>
    api<PairsResponse>(`${base}/analytics/pairs?${query}&page_size=5`, signal),
  )
  const recent = useQuery(`${base}/draws?page_size=3`, (signal) =>
    api<Page<Draw>>(`${base}/draws?page_size=3`, signal),
  )
  const max = Math.max(0, ...(numbers.data?.items.map((item) => item.frequency) ?? []))
  const frequent = [...(numbers.data?.items ?? [])]
    .sort((a, b) => b.frequency - a.frequency || a.number - b.number)
    .slice(0, 6)
  const syncFailed =
    !!status.data?.last_failed_ingestion_at &&
    (!status.data.last_successful_ingestion_at ||
      status.data.last_failed_ingestion_at > status.data.last_successful_ingestion_at)
  const gaps = [...(numbers.data?.items ?? [])]
    .filter((item) => item.current_gap !== null)
    .sort((a, b) => (b.current_gap ?? -1) - (a.current_gap ?? -1) || a.number - b.number)
    .slice(0, 5)
  return (
    <>
      <PageHead
        title={`Tổng quan ${game!.label}`}
        description="Các thống kê từ những kỳ quay đã được lưu."
      >
        <div className="dashboard-actions">
          <WindowSelector />
        </div>
      </PageHead>
      <div className="dashboard-hero">
        <Card
          className="latest-card"
          title="Kết quả gần nhất"
          subtitle="Kết quả đã công bố và được lưu trong lịch sử"
          action={
            <Link className="link-arrow" to={`/history${search}`}>
              Lịch sử <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        >
          <div className="latest-result">
            <DataState {...latest} hasData={!!latest.data} empty="Chưa có kỳ quay được lưu.">
              {latest.data && (
                <>
                  <p className="latest-meta">
                    <span>Kỳ {latest.data.draw_id}</span>
                    <span>
                      {latest.data.draw_date}
                      {latest.data.draw_time ? ` · ${latest.data.draw_time.slice(0, 5)}` : ''}
                    </span>
                  </p>
                  <Balls
                    values={latest.data.main_numbers}
                    special={game!.special_min === null ? null : latest.data.special_number}
                    large
                  />
                </>
              )}
            </DataState>
          </div>
          <div className="data-freshness">
            <details
              className={`data-details${syncFailed || status.error ? ' source-warning' : ''}`}
            >
              <summary aria-busy={status.loading}>
                <Clock3 size={15} aria-hidden="true" />
                <span>
                  {status.error
                    ? status.data
                      ? 'Trạng thái đồng bộ chưa được cập nhật'
                      : 'Chưa kiểm tra được trạng thái đồng bộ'
                    : status.loading
                      ? 'Đang kiểm tra trạng thái đồng bộ…'
                      : syncFailed
                        ? 'Lần đồng bộ gần nhất chưa hoàn tất'
                        : 'Tình trạng dữ liệu'}
                </span>
              </summary>
              <div className="stack">
                <DataState {...status} hasData={!!status.data}>
                  {status.data && (
                    <>
                      <div>
                        <strong>Đồng bộ thành công:</strong>{' '}
                        {status.data.last_successful_ingestion_at
                          ? formatVietnamTime(status.data.last_successful_ingestion_at)
                          : 'Chưa có'}
                      </div>
                      {syncFailed && (
                        <div>
                          <strong>Lần chưa hoàn tất:</strong>{' '}
                          {formatVietnamTime(status.data.last_failed_ingestion_at!)}
                        </div>
                      )}
                      {!numbers.data && (
                        <div>
                          <strong>Phiên bản kho dữ liệu:</strong> {status.data.data_version}
                        </div>
                      )}
                    </>
                  )}
                </DataState>
                {numbers.data && (
                  <>
                    <div>
                      <strong>Phiên bản dữ liệu thống kê:</strong>{' '}
                      {numbers.data.context.data_version}
                    </div>
                    <div>
                      <strong>Số kỳ trong phạm vi:</strong> {numbers.data.context.actual_draw_count}
                    </div>
                  </>
                )}
              </div>
            </details>
          </div>
        </Card>
      </div>
      <div className="dashboard-sections">
        <Card
          title="Tần suất các số"
          subtitle="6 số có tần suất cao nhất trong phạm vi đã chọn"
          action={
            <Link className="link-arrow" to={`/numbers${search}`}>
              Xem tất cả <ArrowRight size={14} />
            </Link>
          }
        >
          <DataState {...numbers} hasData={!!numbers.data} empty="Chưa có dữ liệu phân tích số.">
            {numbers.data && (
              <>
                <div className="number-grid">
                  {frequent.map((item) => (
                    <FrequencyTile
                      key={item.number}
                      to={`/numbers/${item.number}${search}`}
                      number={item.number}
                      frequency={item.frequency}
                      maximum={max}
                    />
                  ))}
                </div>
                <p className="chart-caption">
                  Thanh dài hơn: xuất hiện nhiều hơn trong phạm vi. Cao nhất {max} kỳ.
                </p>
              </>
            )}
          </DataState>
        </Card>
        <Card
          title="Các cặp xuất hiện nhiều"
          className="pairs-summary"
          action={
            <Link className="link-arrow" to={`/pairs${search}`}>
              Xem cặp số <ArrowRight size={14} />
            </Link>
          }
        >
          <DataState {...pairs} hasData={!!pairs.data} empty="Chưa có cặp số trong phạm vi.">
            {pairs.data && (
              <div className="stack">
                {pairs.data.items.map((pair) => (
                  <div className="draw-row" key={pair.numbers.join('-')}>
                    <PairLink pair={pair} />
                    <strong>{pair.frequency} kỳ</strong>
                  </div>
                ))}
                {pairs.data.items.length === 0 && (
                  <p className="muted">Chưa có cặp số trong phạm vi.</p>
                )}
              </div>
            )}
          </DataState>
        </Card>
        <Card
          title="Khoảng cách hiện tại cao"
          subtitle="Số kỳ liên tiếp chưa xuất hiện"
          action={
            <Link className="link-arrow" to={`/numbers${search}`}>
              Phân tích số <ArrowRight size={14} />
            </Link>
          }
        >
          <DataState {...numbers} hasData={!!numbers.data}>
            {gaps.length ? (
              <div className="bar-list">
                {gaps.map((item) => (
                  <div className="bar-row" key={item.number}>
                    <Link to={`/numbers/${item.number}${search}`}>
                      {String(item.number).padStart(2, '0')}
                    </Link>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${(100 * (item.current_gap ?? 0)) / Math.max(1, gaps[0].current_gap ?? 1)}%`,
                        }}
                      />
                    </div>
                    <strong>{item.current_gap}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Chưa có khoảng cách để hiển thị.</p>
            )}
          </DataState>
        </Card>
        <Card
          title="Các kỳ gần đây"
          action={
            <Link className="link-arrow" to={`/history${search}`}>
              Toàn bộ lịch sử <ArrowRight size={14} />
            </Link>
          }
        >
          <DataState {...recent} hasData={!!recent.data} empty="Chưa có kỳ quay được lưu.">
            {recent.data && <DrawRows draws={recent.data.items} game={game!} />}
          </DataState>
        </Card>
      </div>
    </>
  )
}
