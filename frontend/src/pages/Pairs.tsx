import { Link, useParams } from 'react-router'
import { api, globalSearch, params, windowQuery, type PairDetail, type PairsResponse } from '../api'
import { useApp, useQuery, useUrlField } from '../state'
import {
  BackLink,
  Card,
  ContextNote,
  DataState,
  DataTable,
  DrawRows,
  PageHead,
  Pager,
  PairLink,
  WindowSelector,
  formatPercent,
} from '../ui'

export function Pairs() {
  const { game, window } = useApp()
  const [minimum, setMinimum] = useUrlField('min_frequency', '0')
  const [sort, setSort] = useUrlField('sort', 'frequency_desc')
  const [pageValue, setPage] = useUrlField('page', '1')
  const page = Math.max(1, Number(pageValue) || 1)
  const path = `/games/${game!.id}/analytics/pairs?${params({ ...windowQuery(window), min_frequency: minimum, sort, page, page_size: 25 })}`
  const result = useQuery(path, (signal) => api<PairsResponse>(path, signal))
  return (
    <>
      <PageHead
        kicker="Phân tích cặp"
        title="Cặp số trong lịch sử"
        description="Tần suất đồng xuất hiện của hai số chính qua các kỳ."
      />
      <WindowSelector />
      <div className="toolbar">
        <label className="field">
          Tần suất tối thiểu
          <input
            type="number"
            min="0"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
          />
        </label>
        <label className="field">
          Sắp xếp
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="frequency_desc">Tần suất giảm</option>
            <option value="frequency_asc">Tần suất tăng</option>
            <option value="pair">Theo cặp số</option>
          </select>
        </label>
      </div>
      <Card>
        <DataState {...result} hasData={!!result.data} empty="Không có cặp nào khớp bộ lọc.">
          {result.data && (
            <>
              <DataTable>
                <thead>
                  <tr>
                    <th>Cặp</th>
                    <th>Số kỳ</th>
                    <th>Tỷ lệ</th>
                    <th>Gap hiện tại</th>
                    <th>Lần gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((pair) => (
                    <tr key={pair.numbers.join('-')}>
                      <td>
                        <PairLink pair={pair} />
                      </td>
                      <td>{pair.frequency}</td>
                      <td>{formatPercent(pair.percent_of_draws)}</td>
                      <td>{pair.current_gap ?? '—'}</td>
                      <td>{pair.last_seen_draw_id ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              {result.data.items.length === 0 && (
                <p className="muted">Không có cặp nào khớp bộ lọc.</p>
              )}
              <Pager
                page={result.data.page}
                total={result.data.total}
                pageSize={result.data.page_size}
                setPage={(value) => setPage(String(value))}
              />
              <ContextNote
                count={result.data.context.actual_draw_count}
                version={result.data.context.data_version}
              />
            </>
          )}
        </DataState>
      </Card>
    </>
  )
}

export function PairDetailPage() {
  const { game, window } = useApp()
  const { pair } = useParams()
  const [pageValue, setPage] = useUrlField('page', '1')
  const page = Math.max(1, Number(pageValue) || 1)
  const [a, b] = (pair ?? '').split('-').map(Number)
  const valid =
    Number.isInteger(a) &&
    Number.isInteger(b) &&
    a !== b &&
    a >= game!.main_min &&
    a <= game!.main_max &&
    b >= game!.main_min &&
    b <= game!.main_max
  const path = `/games/${game!.id}/analytics/pairs/${a}/${b}?${params({ ...windowQuery(window), page, page_size: 10 })}`
  const result = useQuery(path, (signal) =>
    valid
      ? api<PairDetail>(path, signal)
      : Promise.reject(new Error('Cặp số không hợp lệ cho game này.')),
  )
  return (
    <>
      <BackLink to="/pairs" label="Về cặp số" />
      <PageHead
        kicker="Chi tiết cặp"
        title={`Cặp ${pair}`}
        description="Các kỳ có cả hai số chính trong phạm vi phân tích."
      />
      <WindowSelector />
      <DataState {...result} hasData={!!result.data}>
        {result.data && (
          <div className="grid cols-2">
            <Card title="Chỉ số">
              <div className="stack">
                <div>
                  Đồng xuất hiện: <strong>{result.data.metrics.frequency} kỳ</strong>
                </div>
                <div>
                  Tỷ lệ kỳ: <strong>{formatPercent(result.data.metrics.percent_of_draws)}</strong>
                </div>
                <div>
                  Gap hiện tại: <strong>{result.data.metrics.current_gap ?? '—'}</strong>
                </div>
                <div>
                  Gap trung bình:{' '}
                  <strong>{result.data.metrics.average_gap?.toFixed(1) ?? '—'}</strong>
                </div>
                <div>
                  Gap lớn nhất: <strong>{result.data.metrics.max_gap ?? '—'}</strong>
                </div>
                <div>
                  Lần gần nhất:{' '}
                  <strong>{result.data.metrics.last_seen_draw_id ?? 'Chưa xuất hiện'}</strong>
                </div>
              </div>
            </Card>
            <Card title="Dòng thời gian">
              <div className="timeline">
                {result.data.timeline_draw_ids.length ? (
                  result.data.timeline_draw_ids.map((id) => (
                    <Link key={id} to={`/history/${id}${globalSearch(game!.id, window)}`}>
                      Kỳ {id}
                    </Link>
                  ))
                ) : (
                  <p className="muted">Chưa có lần xuất hiện.</p>
                )}
              </div>
            </Card>
            <Card title="Các kỳ xuất hiện" className="span-2">
              <DrawRows draws={result.data.appearance_draws.items} game={game!} />
              {result.data.appearance_draws.items.length === 0 && (
                <p className="muted">Chưa có kỳ trong phạm vi.</p>
              )}
              <Pager
                page={result.data.appearance_draws.page}
                total={result.data.appearance_draws.total}
                pageSize={result.data.appearance_draws.page_size}
                setPage={(value) => setPage(String(value))}
              />
            </Card>
          </div>
        )}
      </DataState>
    </>
  )
}
