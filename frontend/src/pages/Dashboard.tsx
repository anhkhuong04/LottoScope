import { ArrowRight } from 'lucide-react'
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
  ScopeSummary,
  WindowSelector,
} from '../ui'

export function Dashboard() {
  const { game, window } = useApp()
  const search = globalSearch(game!.id, window)
  const base = `/games/${game!.id}`
  const query = params(windowQuery(window))
  const latest = useQuery(`${base}/draws/latest`, (signal) =>
    api<Draw>(`${base}/draws/latest`, signal),
  )
  const numbers = useQuery(`${base}/analytics/numbers?${query}`, (signal) =>
    api<NumbersResponse>(`${base}/analytics/numbers?${query}`, signal),
  )
  const special = useQuery(`${base}/analytics/numbers?${query}&number_kind=special`, (signal) =>
    game!.id === 'lotto_535'
      ? api<NumbersResponse>(`${base}/analytics/numbers?${query}&number_kind=special`, signal)
      : Promise.resolve(null),
  )
  const pairs = useQuery(`${base}/analytics/pairs?${query}&page_size=5`, (signal) =>
    api<PairsResponse>(`${base}/analytics/pairs?${query}&page_size=5`, signal),
  )
  const recent = useQuery(`${base}/draws?page_size=3`, (signal) =>
    api<Page<Draw>>(`${base}/draws?page_size=3`, signal),
  )
  const max = Math.max(0, ...(numbers.data?.items.map((item) => item.frequency) ?? []))
  const specialMax = Math.max(0, ...(special.data?.items.map((item) => item.frequency) ?? []))
  const frequent = [...(numbers.data?.items ?? [])]
    .sort((a, b) => b.frequency - a.frequency || a.number - b.number)
    .slice(0, 6)
  const gaps = [...(numbers.data?.items ?? [])]
    .filter((item) => item.current_gap !== null)
    .sort((a, b) => (b.current_gap ?? -1) - (a.current_gap ?? -1) || a.number - b.number)
    .slice(0, 5)
  return (
    <>
      <PageHead
        title={`${game!.label} Overview`}
        description="Historical statistics from recorded draws."
      />
      <WindowSelector />
      {numbers.data && <ScopeSummary context={numbers.data.context} subject="Main numbers" />}
      <div className="dashboard-hero">
        <Card
          className="latest-card"
          title="Latest Result"
          action={
            <Link className="link-arrow" to={`/history${search}`}>
              History <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        >
          <div className="latest-result">
            <DataState {...latest} hasData={!!latest.data} empty="No draws recorded yet.">
              {latest.data && (
                <>
                  <p className="latest-meta">
                    <span>Draw {latest.data.draw_id}</span>
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
        </Card>
      </div>
      <div className="dashboard-sections">
        <Card
          title="Number Frequency"
          action={
            <Link className="link-arrow" to={`/numbers${search}`}>
              View all <ArrowRight size={14} />
            </Link>
          }
        >
          <DataState
            {...numbers}
            hasData={!!numbers.data}
            empty="No number analysis data available."
          >
            {numbers.data && (
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
            )}
          </DataState>
        </Card>
        <Card
          title="Frequent Pairs"
          className="pairs-summary"
          action={
            <Link className="link-arrow" to={`/pairs${search}`}>
              View pairs <ArrowRight size={14} />
            </Link>
          }
        >
          <DataState {...pairs} hasData={!!pairs.data} empty="No pairs found in selected window.">
            {pairs.data && (
              <div className="stack">
                {pairs.data.items.map((pair) => (
                  <div className="draw-row" key={pair.numbers.join('-')}>
                    <PairLink pair={pair} />
                    <strong>{pair.frequency} draws</strong>
                  </div>
                ))}
                {pairs.data.items.length === 0 && (
                  <p className="muted">No pairs found in selected window.</p>
                )}
              </div>
            )}
          </DataState>
        </Card>
        <Card
          title="Longest Current Gaps"
          action={
            <Link className="link-arrow" to={`/numbers${search}`}>
              Number analysis <ArrowRight size={14} />
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
              <p className="muted">No gaps to display.</p>
            )}
          </DataState>
        </Card>
        <Card
          title="Recent Draws"
          action={
            <Link className="link-arrow" to={`/history${search}`}>
              All-time history <ArrowRight size={14} />
            </Link>
          }
        >
          <DataState {...recent} hasData={!!recent.data} empty="No draws recorded yet.">
            {recent.data && <DrawRows draws={recent.data.items} game={game!} />}
          </DataState>
        </Card>
      </div>
      {game!.id === 'lotto_535' && (
        <Card
          title="Lotto 5/35 Special Numbers (01–12)"
          action={
            <Link className="link-arrow" to={`/numbers${search}&number_kind=special`}>
              Details <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
        >
          <DataState {...special} hasData={!!special.data}>
            {special.data && (
              <>
                <ScopeSummary context={special.data.context} subject="Special numbers" />
                <div className="number-grid special-grid">
                  {special.data.items.map((item) => (
                    <FrequencyTile
                      key={item.number}
                      number={item.number}
                      frequency={item.frequency}
                      maximum={specialMax}
                      special
                      to={`/numbers/${item.number}${search}&number_kind=special`}
                    />
                  ))}
                </div>
              </>
            )}
          </DataState>
        </Card>
      )}
    </>
  )
}
