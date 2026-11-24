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
  ScopeSummary,
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
        title="Historical Number Pairs"
        description="Co-occurrence frequency of two main numbers across draws."
      />
      <WindowSelector>
        <label className="field field-compact">
          Min frequency
          <input
            type="number"
            min="0"
            value={minimum}
            onChange={(event) => setMinimum(event.target.value)}
          />
        </label>
        <label className="field">
          Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="frequency_desc">Frequency (desc)</option>
            <option value="frequency_asc">Frequency (asc)</option>
            <option value="pair">Pair order</option>
          </select>
        </label>
      </WindowSelector>
      <Card>
        <DataState {...result} hasData={!!result.data} empty="No pairs match the filter.">
          {result.data && (
            <>
              <ScopeSummary context={result.data.context} subject="Main pairs" />
              <DataTable mobileHidden>
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Rank</th>
                    <th>Draws</th>
                    <th>Rate</th>
                    <th>Current gap</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((pair) => (
                    <tr key={pair.numbers.join('-')}>
                      <td>
                        <PairLink pair={pair} />
                      </td>
                      <td>{result.data?.context.actual_draw_count ? pair.frequency_rank : '—'}</td>
                      <td>{pair.frequency}</td>
                      <td>{formatPercent(pair.percent_of_draws)}</td>
                      <td>{pair.current_gap ?? '—'}</td>
                      <td>
                        {pair.last_seen_draw_id ? (
                          <Link
                            to={`/history/${pair.last_seen_draw_id}${globalSearch(game!.id, window)}`}
                          >
                            {pair.last_seen_draw_id}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <div className="mobile-only pair-mobile-list">
                {result.data.items.map((pair) => (
                  <div className="pair-mobile-row" key={pair.numbers.join('-')}>
                    <PairLink pair={pair} />
                    <div className="pair-mobile-stats">
                      <strong>
                        {pair.frequency} draws ({formatPercent(pair.percent_of_draws)})
                      </strong>
                      <span className="muted">
                        {result.data?.context.actual_draw_count
                          ? `Rank ${pair.frequency_rank}`
                          : '—'}{' '}
                        · Gap {pair.current_gap ?? '—'}
                      </span>
                    </div>
                    <div className="pair-mobile-draw">
                      {pair.last_seen_draw_id ? (
                        <Link
                          to={`/history/${pair.last_seen_draw_id}${globalSearch(game!.id, window)}`}
                        >
                          #{pair.last_seen_draw_id}
                        </Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {result.data.items.length === 0 && (
                <p className="muted">No pairs match the filter.</p>
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
      : Promise.reject(new Error('Invalid number pair for this game.')),
  )
  return (
    <>
      <BackLink to="/pairs" label="Back to pairs" />
      <PageHead
        title={`Pair ${pair}`}
        description="Draws containing both main numbers in selected window."
      />
      <WindowSelector />
      <DataState {...result} hasData={!!result.data}>
        {result.data && (
          <div className="grid cols-2">
            <div className="span-2">
              <ScopeSummary context={result.data.context} subject="Main number pairs" />
            </div>
            <Card title="Metrics">
              <div className="stack">
                <div>
                  Co-occurrence: <strong>{result.data.metrics.frequency} draws</strong>
                </div>
                <div>
                  Draw percentage:{' '}
                  <strong>{formatPercent(result.data.metrics.percent_of_draws)}</strong>
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
                  <strong>{result.data.metrics.last_seen_draw_id ?? 'Never appeared'}</strong>
                </div>
              </div>
            </Card>
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
            <Card title="Appeared Draws" className="span-2">
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
