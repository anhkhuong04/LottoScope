import { ArrowRight, Clock3, RefreshCw } from 'lucide-react'
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
  ContextNote,
  DataState,
  DrawRows,
  FrequencyTile,
  Metric,
  PageHead,
  PairLink,
  WindowSelector,
  formatVietnamTime,
} from '../ui'

export function Dashboard() {
  const { game, window, refreshData } = useApp()
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
        kicker="Khám phá dữ liệu"
        title={`Tổng quan ${game!.label}`}
        description="Các thống kê từ những kỳ quay đã được lưu."
      >
        <div className="dashboard-actions">
          <WindowSelector />
          <button
            className="btn ghost icon-button"
            aria-label="Làm mới hiển thị"
            title="Chỉ đọc lại dữ liệu đã lưu"
            onClick={refreshData}
          >
            <RefreshCw size={18} aria-hidden="true" />
          </button>
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
          <DataState
            {...latest}
            showRefresh={false}
            hasData={!!latest.data}
            empty="Chưa có kỳ quay được lưu."
          >
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
          <div className="data-freshness">
            <DataState {...status} showRefresh={false} hasData={!!status.data}>
              {status.data && (
                <details className="data-details">
                  <summary>
                    <Clock3 size={15} aria-hidden="true" />
                    <span>
                      {syncFailed ? 'Lần đồng bộ gần nhất chưa hoàn tất' : 'Tình trạng dữ liệu'}
                    </span>
                  </summary>
                  <div className="stack">
                    <p>
                      Dữ liệu đã lưu vẫn được giữ. Tải dữ liệu lấy kỳ mới từ Vietlott; làm mới hiển
                      thị chỉ đọc lại dữ liệu đã lưu.
                    </p>
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
                    <div>
                      <strong>Phiên bản dữ liệu:</strong> {status.data.data_version}
                    </div>
                  </div>
                </details>
              )}
            </DataState>
          </div>
        </Card>
        <div className="dashboard-metrics">
          <Metric
            label="Kỳ gần nhất"
            value={latest.data?.draw_id ?? '—'}
            foot={latest.data?.draw_date ?? 'Chưa có kỳ quay'}
          />
          <Metric
            label="Kỳ trong phạm vi"
            value={numbers.data?.context.actual_draw_count ?? '—'}
            foot="Theo phạm vi phân tích"
          />
          <Metric
            label="Số xuất hiện nhiều nhất"
            value={
              numbers.data?.items.length
                ? String(
                    [...numbers.data.items].sort(
                      (a, b) => b.frequency - a.frequency || a.number - b.number,
                    )[0].number,
                  ).padStart(2, '0')
                : '—'
            }
            foot="Theo tần suất lịch sử"
          />
          <Metric
            label="Cặp xuất hiện nhiều nhất"
            value={
              pairs.data?.items[0]?.numbers
                .map((value) => String(value).padStart(2, '0'))
                .join(' · ') ?? '—'
            }
            foot="Trong phạm vi đã chọn"
          />
        </div>
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
          <DataState
            {...numbers}
            showRefresh={false}
            hasData={!!numbers.data}
            empty="Chưa có dữ liệu phân tích số."
          >
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
          <DataState
            {...pairs}
            showRefresh={false}
            hasData={!!pairs.data}
            empty="Chưa có cặp số trong phạm vi."
          >
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
          <DataState {...numbers} showRefresh={false} hasData={!!numbers.data}>
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
          <DataState
            {...recent}
            showRefresh={false}
            hasData={!!recent.data}
            empty="Chưa có kỳ quay được lưu."
          >
            {recent.data && <DrawRows draws={recent.data.items} game={game!} />}
          </DataState>
        </Card>
      </div>
      {numbers.data && (
        <ContextNote
          count={numbers.data.context.actual_draw_count}
          version={numbers.data.context.data_version}
        />
      )}
    </>
  )
}
