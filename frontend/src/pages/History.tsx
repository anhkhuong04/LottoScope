import { Link, useLocation, useParams } from 'react-router'
import { api, globalSearch, params, type Draw, type Page } from '../api'
import { useApp, useQuery, useUrlField } from '../state'
import { DrawPrizes } from './DrawPrizes'
import {
  BackLink,
  Balls,
  Card,
  DataState,
  DataTable,
  FilterBar,
  DrawRows,
  PageHead,
  Pager,
  formatVietnamTime,
} from '../ui'

export function History() {
  const { game } = useApp()
  const location = useLocation()
  const [from, setFrom] = useUrlField('from_date', '')
  const [to, setTo] = useUrlField('to_date', '')
  const [drawId, setDrawId] = useUrlField('draw_id', '')
  const [sort, setSort] = useUrlField('sort', 'desc')
  const [pageValue, setPage] = useUrlField('page', '1')
  const page = Math.max(1, Number(pageValue) || 1)
  const path = `/games/${game!.id}/draws?${params({ from_date: from, to_date: to, draw_id: drawId, sort, page, page_size: 25 })}`
  const result = useQuery(path, (signal) => api<Page<Draw>>(path, signal))
  return (
    <>
      <PageHead
        title="Draw History"
        description="Search by date or draw ID; special numbers displayed separately."
      />
      <FilterBar>
        <label className="field">
          From date
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="field">
          To date
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label className="field">
          Draw ID
          <input
            value={drawId}
            onChange={(event) => setDrawId(event.target.value)}
            placeholder="e.g. 00830"
          />
        </label>
        <label className="field">
          Order
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
      </FilterBar>
      {from && to && from > to ? (
        <div className="notice error">Start date must be on or before end date.</div>
      ) : (
        <Card>
          <DataState {...result} hasData={!!result.data} empty="No draws match the filter.">
            {result.data && (
              <>
                <p className="scope-summary">
                  <span>{result.data.total} draws matched</span>
                  <span>
                    {from || to
                      ? `${from || 'All-time start'} → ${to || 'Present'}`
                      : 'All-time history'}
                  </span>
                  {drawId && <span>Draw ID: {drawId}</span>}
                  <span>{sort === 'asc' ? 'Oldest first' : 'Newest first'}</span>
                </p>
                <DataTable mobileHidden>
                  <thead>
                    <tr>
                      <th>Draw</th>
                      <th>Date / Time</th>
                      <th>Main Numbers</th>
                      {game!.special_min !== null && <th>Special</th>}
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.items.map((draw) => (
                      <tr key={draw.draw_id}>
                        <td>
                          <strong>{draw.draw_id}</strong>
                        </td>
                        <td>
                          {draw.draw_date}
                          {draw.draw_time ? ` · ${draw.draw_time.slice(0, 5)}` : ''}
                        </td>
                        <td>
                          <Balls values={draw.main_numbers} />
                        </td>
                        {game!.special_min !== null && (
                          <td>
                            {draw.special_number === null ? (
                              '—'
                            ) : (
                              <Balls values={[]} special={draw.special_number} />
                            )}
                          </td>
                        )}
                        <td>
                          <Link
                            to={`/history/${encodeURIComponent(draw.draw_id)}${location.search}`}
                          >
                            View draw
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                <div className="mobile-only">
                  <DrawRows draws={result.data.items} game={game!} />
                </div>
                {result.data.items.length === 0 && (
                  <p className="muted">No draws match the filter.</p>
                )}
                <Pager
                  page={result.data.page}
                  total={result.data.total}
                  pageSize={result.data.page_size}
                  setPage={(value) => setPage(String(value))}
                />
              </>
            )}
          </DataState>
        </Card>
      )}
    </>
  )
}

export function DrawDetail() {
  const { game, window } = useApp()
  const { drawId } = useParams()
  const path = `/games/${game!.id}/draws/${encodeURIComponent(drawId ?? '')}`
  const result = useQuery(path, (signal) => api<Draw>(path, signal))
  return (
    <>
      <BackLink to="/history" label="Back to history" />
      <PageHead title={`Draw ${drawId}`} description={game!.label} />
      <Card>
        <DataState {...result} hasData={!!result.data} empty="Draw not found.">
          {result.data && (
            <div className="stack">
              <Balls
                values={result.data.main_numbers}
                special={game!.special_min === null ? null : result.data.special_number}
                large
              />
              <div>
                <strong>Draw date:</strong> {result.data.draw_date}
              </div>
              <div>
                <strong>Draw time:</strong> {result.data.draw_time ?? 'Not available'}
              </div>
              <div>
                <strong>Retrieved at:</strong> {formatVietnamTime(result.data.source_retrieved_at)}
              </div>
              <div>
                <Link to={`/checker${globalSearch(game!.id, window)}`}>
                  Check a number combination
                </Link>
              </div>
            </div>
          )}
        </DataState>
      </Card>
      {result.data && (
        <DrawPrizes
          key={`${game!.id}/${result.data.draw_id}`}
          gameId={game!.id}
          drawId={result.data.draw_id}
        />
      )}
    </>
  )
}
