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
        title="Frequency & Gaps"
        description={
          special
            ? 'Special numbers 01–12 tracked separately in selected window.'
            : 'Each main number is analyzed independently in selected window.'
        }
      />
      <WindowSelector>
        {game!.id === 'lotto_535' && (
          <label className="field">
            Number kind
            <select
              value={special ? 'special' : 'main'}
              onChange={(event) => setKind(event.target.value)}
            >
              <option value="main">Main numbers 01–35</option>
              <option value="special">Special numbers 01–12</option>
            </select>
          </label>
        )}
        <label className="field">
          Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="number">Number order</option>
            <option value="frequency_desc">Frequency (desc)</option>
            <option value="frequency_asc">Frequency (asc)</option>
            <option value="gap_desc">Gap (desc)</option>
          </select>
        </label>
        <label className="field">
          View
          <select value={view} onChange={(event) => setView(event.target.value)}>
            <option value="grid">Grid</option>
            <option value="table">Table</option>
            <option value="chart">Chart</option>
          </select>
        </label>
      </WindowSelector>
      <Card>
        <DataState {...result} hasData={!!result.data} empty="No number statistics available.">
          {result.data && (
            <>
              <ScopeSummary
                context={result.data.context}
                subject={special ? 'Special numbers' : 'Main numbers'}
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
                      <th>Number</th>
                      <th>Rank</th>
                      <th>Frequency</th>
                      <th>Rate</th>
                      <th>Current gap</th>
                      <th>Avg gap</th>
                      <th>Last seen</th>
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
                    Max frequency {max} draws; each bar indicates corresponding draw count.
                  </p>
                </>
              )}
              {view === 'grid' && (
                <p className="chart-caption">
                  Longer bar indicates higher frequency. Max {max} draws. Choose Table for full
                  metrics. Ties share rank; ties sorted ascending.
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
      : Promise.reject(new Error('Number out of range for this game.')),
  )
  return (
    <>
      <BackLink to="/numbers" label="Back to numbers" />
      <PageHead
        title={`${special ? 'Special Number ' : 'Number '}${String(number).padStart(2, '0')}`}
        description={`Statistics from ${game!.label} draws in selected window.`}
      />
      <WindowSelector />
      <DataState {...result} hasData={!!result.data}>
        {result.data && (
          <div className="grid cols-2">
            <div className="span-2">
              <ScopeSummary
                context={result.data.context}
                subject={special ? 'Special numbers' : 'Main numbers'}
              />
            </div>
            <Card title="Metrics">
              <div className="stack">
                <div>
                  Frequency:{' '}
                  <strong>
                    {result.data.metrics.frequency} draws (
                    {formatPercent(result.data.metrics.frequency_percent)})
                  </strong>
                </div>
                <div>
                  Frequency rank:{' '}
                  <strong>
                    {result.data.context.actual_draw_count
                      ? result.data.metrics.frequency_rank
                      : '—'}
                  </strong>
                </div>
                <div>
                  Current gap: <strong>{result.data.metrics.current_gap ?? '—'}</strong>
                </div>
                <div>
                  Average gap: <strong>{result.data.metrics.average_gap?.toFixed(1) ?? '—'}</strong>
                </div>
                <div>
                  Max gap: <strong>{result.data.metrics.max_gap ?? '—'}</strong>
                </div>
                <div>
                  Last seen:{' '}
                  {result.data.metrics.last_seen_draw_id ? (
                    <Link
                      className="inline-link"
                      to={`/history/${result.data.metrics.last_seen_draw_id}${globalSearch(game!.id, window)}`}
                    >
                      Draw {result.data.metrics.last_seen_draw_id}
                    </Link>
                  ) : (
                    <strong>Not seen in selected window</strong>
                  )}
                </div>
              </div>
            </Card>
            {!special && (
              <Card
                title="Co-occurring Pairs"
                subtitle="Top 10 pairs by frequency; ties sorted ascending"
              >
                {result.data.pair_partners.length ? (
                  <div className="stack">
                    {result.data.pair_partners.map((pair) => (
                      <div className="draw-row" key={pair.numbers.join('-')}>
                        <PairLink pair={pair} />
                        <strong>{pair.frequency} draws</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No pairs in selected window.</p>
                )}
              </Card>
            )}
            <Card title="Timeline">
              <div className="timeline">
                {result.data.timeline_draw_ids.length ? (
                  result.data.timeline_draw_ids.map((id) => (
                    <Link key={id} to={`/history/${id}${globalSearch(game!.id, window)}`}>
                      Draw {id}
                    </Link>
                  ))
                ) : (
                  <p className="muted">No appearances recorded.</p>
                )}
              </div>
            </Card>
            <Card title="Draws with this number">
              <DrawRows draws={result.data.appearance_draws.items} game={game!} />
              {result.data.appearance_draws.items.length === 0 && (
                <p className="muted">No draws in selected window.</p>
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
