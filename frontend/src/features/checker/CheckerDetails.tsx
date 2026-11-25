import type { KeyboardEvent } from 'react'
import { Link } from 'react-router'
import type { CheckResponse } from '../../api'
import { Ball, Balls, Pager, formatPercent } from '../../ui'

export type DetailTab = 'similar' | 'numbers' | 'pairs'

export function CheckerDetails({
  data,
  activeTab,
  setActiveTab,
  setPage,
  selectedSet,
  search,
  tabsId,
}: {
  data: CheckResponse
  activeTab: DetailTab
  setActiveTab: (tab: DetailTab) => void
  setPage: (page: number) => void
  selectedSet: ReadonlySet<number>
  search: string
  tabsId: string
}) {
  const tabs = [
    { id: 'similar', label: 'Similar Draws', count: data.similar_draws.total },
    { id: 'numbers', label: 'Numbers', count: data.number_analysis.length },
    { id: 'pairs', label: 'Pairs', count: data.pair_analysis.length },
  ] as const
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (nextIndex !== null) {
      event.preventDefault()
      const tab = tabs[nextIndex].id
      setActiveTab(tab)
      document.getElementById(`${tabsId}-tab-${tab}`)?.focus()
    }
  }
  return (
    <section className="checker-detail-tabs" aria-label="Combination analysis details">
      <div className="checker-tablist" role="tablist" aria-label="Analysis views">
        {tabs.map(({ id, label, count }, index) => (
          <button
            key={id}
            id={`${tabsId}-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`${tabsId}-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            className={`checker-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {label} <span className="checker-tab-count">{count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'similar' && (
        <div
          id={`${tabsId}-panel-similar`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-tab-similar`}
          className="checker-tabpanel"
        >
          <div className="checker-similar-list">
            {data.similar_draws.items.map((item) => (
              <div className="checker-similar-row" key={item.draw.draw_id}>
                <div className="checker-similar-head">
                  <div className="draw-meta">
                    <Link className="draw-id" to={`/history/${item.draw.draw_id}${search}`}>
                      #{item.draw.draw_id}
                    </Link>
                    <span className="draw-date">{item.draw.draw_date}</span>
                  </div>
                  <span className="pill checker-match-pill">{item.overlap_count} matched</span>
                  <Link className="link-arrow" to={`/history/${item.draw.draw_id}${search}`}>
                    Details →
                  </Link>
                </div>
                <Balls
                  values={item.draw.main_numbers}
                  special={item.draw.special_number}
                  highlighted={selectedSet}
                />
              </div>
            ))}
            {data.similar_draws.items.length === 0 && (
              <p className="muted">No similar draws found.</p>
            )}
          </div>
          <Pager
            page={data.similar_draws.page}
            total={data.similar_draws.total}
            pageSize={data.similar_draws.page_size}
            setPage={(page) => setPage(page)}
          />
        </div>
      )}

      {activeTab === 'numbers' && (
        <div
          id={`${tabsId}-panel-numbers`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-tab-numbers`}
          className="checker-tabpanel"
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Frequency</th>
                  <th>Rate</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {data.number_analysis.map((item) => (
                  <tr key={item.number}>
                    <td>
                      <Link to={`/numbers/${item.number}${search}`}>
                        <Ball value={item.number} />
                      </Link>
                    </td>
                    <td>{item.frequency}</td>
                    <td>{formatPercent(item.frequency_percent)}</td>
                    <td>{item.current_gap ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pairs' && (
        <div
          id={`${tabsId}-panel-pairs`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-tab-pairs`}
          className="checker-tabpanel"
        >
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Draws</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.pair_analysis.map((pair) => (
                  <tr key={pair.numbers.join('-')}>
                    <td>
                      <Link to={`/pairs/${pair.numbers.join('-')}${search}`}>
                        <Balls values={pair.numbers} />
                      </Link>
                    </td>
                    <td>{pair.frequency}</td>
                    <td>{formatPercent(pair.percent_of_draws)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
