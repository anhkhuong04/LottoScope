import { Link, useLocation, useParams } from 'react-router'
import {
  api,
  globalSearch,
  params,
  windowQuery,
  type NumberDetail,
  type NumbersResponse,
} from '../api'
import { useApp, useQuery, useUrlField } from '../state'
import {
  BackLink,
  Ball,
  Card,
  ContextNote,
  DataState,
  DataTable,
  DrawRows,
  FrequencyTile,
  PageHead,
  ScopeSummary,
  Pager,
  PairLink,
  WindowSelector,
  formatPercent,
} from '../ui'

export function Numbers() {
  const { game, window } = useApp()
  const location = useLocation()
  const [sort, setSort] = useUrlField('sort', 'number')
  const [view, setView] = useUrlField('view', 'grid')
  const [kind, setKind] = useUrlField('number_kind', 'main')
  const special = game!.id === 'lotto_535' && kind === 'special'
  const path = `/games/${game!.id}/analytics/numbers?${params({ ...windowQuery(window), sort, number_kind: special ? 'special' : 'main' })}`
  const result = useQuery(path, (signal) => api<NumbersResponse>(path, signal))
  const max = Math.max(0, ...(result.data?.items.map((item) => item.frequency) ?? []))
  return (
    <>
      <PageHead
        title="Tần suất & khoảng cách"
        description={
          special
            ? 'Các số đặc biệt 01–12 được thống kê riêng trong phạm vi đã chọn.'
            : 'Mỗi số chính được thống kê độc lập trong phạm vi đã chọn.'
        }
      />
      <WindowSelector>
        {game!.id === 'lotto_535' && (
          <label className="field">
            Nhóm số
            <select
              value={special ? 'special' : 'main'}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="main">Số chính 01–35</option>
              <option value="special">Số đặc biệt 01–12</option>
            </select>
          </label>
        )}
        <label className="field">
          Sắp xếp
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="number">Theo số</option>
            <option value="frequency_desc">Tần suất giảm</option>
            <option value="frequency_asc">Tần suất tăng</option>
            <option value="gap_desc">Khoảng cách giảm</option>
          </select>
        </label>
        <label className="field">
          Cách xem
          <select value={view} onChange={(event) => setView(event.target.value)}>
            <option value="grid">Lưới</option>
            <option value="table">Bảng</option>
            <option value="chart">Biểu đồ</option>
          </select>
        </label>
      </WindowSelector>
      <Card>
        <DataState {...result} hasData={!!result.data} empty="Chưa có thống kê số.">
          {result.data && (
            <>
              <ScopeSummary
                context={result.data.context}
                subject={special ? 'Số đặc biệt' : 'Số chính'}
              />
              {view === 'grid' && (
                <div className="number-grid">
                  {result.data.items.map((item) => (
                    <FrequencyTile
                      key={item.number}
                      to={`/numbers/${item.number}${location.search}`}
                      number={item.number}
                      frequency={item.frequency}
                      maximum={max}
                      special={special}
                      rank={
                        result.data?.context.actual_draw_count ? item.frequency_rank : undefined
                      }
                    />
                  ))}
                </div>
              )}
              {view === 'table' && (
                <DataTable>
                  <thead>
                    <tr>
                      <th>Số</th>
                      <th>Hạng tần suất</th>
                      <th>Tần suất</th>
                      <th>Tỷ lệ</th>
                      <th>Gap hiện tại</th>
                      <th>Gap TB</th>
                      <th>Lần gần nhất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.items.map((item) => (
                      <tr key={item.number}>
                        <td>
                          <Link to={`/numbers/${item.number}${location.search}`}>
                            <Ball value={item.number} special={special} />
                          </Link>
                        </td>
                        <td>
                          {result.data?.context.actual_draw_count ? item.frequency_rank : '—'}
                        </td>
                        <td>{item.frequency}</td>
                        <td>{formatPercent(item.frequency_percent)}</td>
                        <td>{item.current_gap ?? '—'}</td>
                        <td>{item.average_gap?.toFixed(1) ?? '—'}</td>
                        <td>
                          {item.last_seen_draw_id ? (
                            <Link
                              to={`/history/${item.last_seen_draw_id}${globalSearch(game!.id, window)}`}
                            >
                              {item.last_seen_draw_id}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
              {view === 'chart' && (
                <>
                  <div className="bar-list">
                    {result.data.items.map((item) => (
                      <div className="bar-row" key={item.number}>
                        <Link to={`/numbers/${item.number}${location.search}`}>
                          {String(item.number).padStart(2, '0')}
                        </Link>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${(100 * item.frequency) / Math.max(1, max)}%` }}
                          />
                        </div>
                        <strong>{item.frequency}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="muted" style={{ marginTop: 17 }}>
                    Tần suất cao nhất {max} kỳ; mỗi hàng ghi số kỳ tương ứng.
                  </p>
                </>
              )}
              {view === 'grid' && (
                <p className="chart-caption">
                  Thanh dài hơn: xuất hiện nhiều hơn trong phạm vi. Cao nhất {max} kỳ. Chọn Bảng để
                  xem đầy đủ chỉ số. Cùng tần suất cùng hạng; số tăng dần khi đồng hạng.
                </p>
              )}
              <div style={{ marginTop: 16 }}>
                <ContextNote
                  count={result.data.context.actual_draw_count}
                  version={result.data.context.data_version}
                />
              </div>
            </>
          )}
        </DataState>
      </Card>
    </>
  )
}

export function NumberDetailPage() {
  const { game, window } = useApp()
  const location = useLocation()
  const special =
    game!.id === 'lotto_535' &&
    new URLSearchParams(location.search).get('number_kind') === 'special'
  const { number } = useParams()
  const [pageValue, setPage] = useUrlField('page', '1')
  const page = Math.max(1, Number(pageValue) || 1)
  const valid =
    Number.isInteger(Number(number)) &&
    Number(number) >= game!.main_min &&
    Number(number) <= (special ? game!.special_max! : game!.main_max)
  const path = `/games/${game!.id}/analytics/numbers/${number}?${params({ ...windowQuery(window), page, page_size: 10, number_kind: special ? 'special' : 'main' })}`
  const result = useQuery(path, (signal) =>
    valid
      ? api<NumberDetail>(path, signal)
      : Promise.reject(new Error('Số ngoài miền của game này.')),
  )
  return (
    <>
      <BackLink to="/numbers" label="Về phân tích số" />
      <PageHead
        title={`Số ${special ? 'đặc biệt ' : ''}${String(number).padStart(2, '0')}`}
        description={`Thống kê từ các kỳ ${game!.label} trong phạm vi đã chọn.`}
      />
      <WindowSelector />
      <DataState {...result} hasData={!!result.data}>
        {result.data && (
          <div className="grid cols-2">
            <div className="span-2">
              <ScopeSummary
                context={result.data.context}
                subject={special ? 'Số đặc biệt' : 'Số chính'}
              />
            </div>
            <Card title="Chỉ số">
              <div className="stack">
                <div>
                  Tần suất:{' '}
                  <strong>
                    {result.data.metrics.frequency} kỳ (
                    {formatPercent(result.data.metrics.frequency_percent)})
                  </strong>
                </div>
                <div>
                  Hạng tần suất:{' '}
                  <strong>
                    {result.data.context.actual_draw_count
                      ? result.data.metrics.frequency_rank
                      : '—'}
                  </strong>
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
                  {result.data.metrics.last_seen_draw_id ? (
                    <Link
                      className="inline-link"
                      to={`/history/${result.data.metrics.last_seen_draw_id}${globalSearch(game!.id, window)}`}
                    >
                      Kỳ {result.data.metrics.last_seen_draw_id}
                    </Link>
                  ) : (
                    <strong>Chưa xuất hiện trong phạm vi</strong>
                  )}
                </div>
              </div>
            </Card>
            {!special && (
              <Card
                title="Các cặp đi cùng"
                subtitle="Tối đa 10 cặp theo tần suất; đồng hạng xếp theo số tăng dần"
              >
                {result.data.pair_partners.length ? (
                  <div className="stack">
                    {result.data.pair_partners.map((pair) => (
                      <div className="draw-row" key={pair.numbers.join('-')}>
                        <PairLink pair={pair} />
                        <strong>{pair.frequency} kỳ</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Chưa có cặp trong phạm vi.</p>
                )}
              </Card>
            )}
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
            <Card title="Kỳ có số này">
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
