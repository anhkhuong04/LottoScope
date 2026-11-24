import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, globalSearch, type CheckResponse } from '../api'
import { useApp } from '../state'
import { Ball, Balls, Card, PageHead, Pager, WindowSelector, formatPercent } from '../ui'
import { parseCombination } from '../features/draw-machine/checkerLink'

type DetailTab = 'similar' | 'numbers' | 'pairs'

export function validateNumbers(
  numbers: number[],
  min: number,
  max: number,
  count: number,
): string | null {
  if (numbers.some((number) => !Number.isInteger(number) || number < min || number > max))
    return `Only integers from ${min} to ${max} are allowed.`
  if (new Set(numbers).size !== numbers.length) return 'Duplicate numbers found.'
  if (numbers.length !== count)
    return `Must select exactly ${count} main numbers; currently ${numbers.length}.`
  return null
}

export function Checker() {
  const { game, window: analysisWindow } = useApp()
  const [search] = useSearchParams()
  const [selected, setSelected] = useState<number[]>(() =>
    parseCombination(search.get('numbers'), game!.main_min, game!.main_max, game!.main_count),
  )
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [similarPage, setSimilarPage] = useState(1)
  const [activeTab, setActiveTab] = useState<DetailTab>('similar')
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data: CheckResponse } | null>(null)
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const tabsId = useId()
  const sortedSelected = [...selected].sort((a, b) => a - b)
  const selectedSet = new Set(sortedSelected)
  const contextKey = `${game!.id}:${JSON.stringify(analysisWindow)}:${sortedSelected.join(',')}`
  const key = `${contextKey}:${similarPage}`
  const validation = validateNumbers(
    sortedSelected,
    game!.main_min,
    game!.main_max,
    game!.main_count,
  )
  const wasValid = useRef(!validation)
  const loading = !validation && (loadingKey?.startsWith(`${contextKey}:`) ?? false)

  useEffect(() => {
    const isNowValid = !validation
    if (
      isNowValid &&
      !wasValid.current &&
      typeof window !== 'undefined' &&
      window.innerWidth < 768
    ) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    wasValid.current = isNowValid
  }, [validation])

  useEffect(() => {
    if (validation) return
    const controller = new AbortController()
    const requestKey = key
    const numbers = [...sortedSelected]
    const page = similarPage
    const gameId = game!.id
    setLoadingKey(requestKey)
    setError(null)
    api<CheckResponse>(`/games/${gameId}/combinations/check`, controller.signal, {
      main_numbers: numbers,
      analysis_window: analysisWindow,
      similar_page: page,
      similar_page_size: 5,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data })
          setError(null)
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError({
            key: requestKey,
            message: cause instanceof Error ? cause.message : 'Failed to check combination.',
          })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingKey(null)
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, validation, attempt])

  const addInput = () => {
    const parts = input
      .trim()
      .split(/[\s,;]+/)
      .filter(Boolean)
    if (!parts.length) return
    const parsed = parts.map(Number)
    if (
      parts.some(
        (part, i) =>
          !/^\d+$/.test(part) ||
          !Number.isInteger(parsed[i]) ||
          parsed[i] < game!.main_min ||
          parsed[i] > game!.main_max,
      )
    ) {
      setInputError(`Enter integers from ${game!.main_min} to ${game!.main_max} only.`)
      return
    }
    if (new Set([...selected, ...parsed]).size !== selected.length + parsed.length) {
      setInputError('Duplicate numbers found.')
      return
    }
    if (selected.length + parsed.length > game!.main_count) {
      setInputError(`Select up to ${game!.main_count} main numbers.`)
      return
    }
    setSelected([...selected, ...parsed].sort((a, b) => a - b))
    setInput('')
    setInputError(null)
    setSimilarPage(1)
  }
  const toggle = (number: number) => {
    setSelected((values) =>
      values.includes(number)
        ? values.filter((value) => value !== number)
        : values.length < game!.main_count
          ? [...values, number].sort((a, b) => a - b)
          : values,
    )
    setInputError(null)
    setSimilarPage(1)
  }
  const clear = () => {
    setSelected([])
    setInput('')
    setInputError(null)
    setSimilarPage(1)
  }
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const order: DetailTab[] = ['similar', 'numbers', 'pairs']
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % order.length
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + order.length) % order.length
    if (nextIndex !== null) {
      event.preventDefault()
      setActiveTab(order[nextIndex])
      document.getElementById(`${tabsId}-tab-${order[nextIndex]}`)?.focus()
    }
  }
  const data = result?.key === key ? result.data : null
  const visibleError = error?.key === key ? error.message : null
  const matchCounts = Array.from({ length: Math.max(0, game!.main_count - 2) }, (_, i) => i + 3)

  return (
    <>
      <PageHead
        title="Combination Checker"
        description="Compare selected main numbers against recorded draws."
      />
      <WindowSelector />
      <div className="grid cols-2 checker-top-grid">
        <Card
          title={`Select ${game!.main_count} main numbers (${game!.main_min}–${game!.main_max})`}
          action={
            <div className="checker-picker-header-actions">
              <span className="pill checker-count-pill">
                {selected.length}/{game!.main_count}
              </span>
              <button
                className="btn btn-sm"
                disabled={selected.length === 0}
                onClick={clear}
                aria-label="Clear selected numbers"
              >
                Clear
              </button>
            </div>
          }
        >
          <div className="checker-input-bar">
            <input
              className="checker-quick-input"
              aria-label="Enter numbers"
              inputMode="numeric"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addInput()
                }
              }}
              placeholder="Quick enter: 04 11 21..."
            />
            <button className="btn btn-sm" onClick={addInput}>
              Add
            </button>
          </div>
          {inputError && (
            <div className="notice error" role="alert">
              {inputError}
            </div>
          )}
          <div className="picker" aria-label="Select main numbers">
            {Array.from(
              { length: game!.main_max - game!.main_min + 1 },
              (_, i) => game!.main_min + i,
            ).map((number) => (
              <button
                key={number}
                className={selected.includes(number) ? 'selected' : ''}
                aria-pressed={selected.includes(number)}
                aria-label={`Number ${String(number).padStart(2, '0')}`}
                disabled={!selected.includes(number) && selected.length >= game!.main_count}
                onClick={() => toggle(number)}
              >
                {String(number).padStart(2, '0')}
              </button>
            ))}
          </div>
        </Card>
        <div ref={resultsRef} className="checker-results-wrap">
          <Card title="Check Results">
            <div className="result-focus" aria-label="Check Results">
              <div aria-live="polite">
                {!data && !loading && !visibleError && (
                  <div className="checker-empty">
                    <div className="checker-slots" aria-hidden="true">
                      {Array.from({ length: game!.main_count }, (_, index) => (
                        <span className={selected[index] !== undefined ? 'filled' : ''} key={index}>
                          {selected[index] !== undefined
                            ? String(selected[index]).padStart(2, '0')
                            : '—'}
                        </span>
                      ))}
                    </div>
                    <h3>Start with your combination</h3>
                    <p className="muted">
                      Pick {game!.main_count} main numbers to run an automatic history check.
                    </p>
                  </div>
                )}
                {loading && !data && <p className="muted">Comparing with history…</p>}
                {visibleError && (
                  <div className="notice error" role="alert">
                    {visibleError} <button onClick={() => setAttempt((v) => v + 1)}>Retry</button>
                  </div>
                )}
              </div>
              {data && (
                <div className="stack checker-summary">
                  <Balls values={data.main_numbers} large />
                  <div className="checker-meta-row">
                    <span className="pill">Checked {data.history_draw_count} draws</span>
                    {data.exact_match_count > 0 && (
                      <span className="pill checker-exact-pill">
                        Exact match: {data.exact_match_count} draw
                        {data.exact_match_count > 1 ? 's' : ''}
                        {data.last_exact_match && (
                          <>
                            {' · '}
                            <Link
                              className="inline-link"
                              to={`/history/${data.last_exact_match.draw_id}${globalSearch(game!.id, analysisWindow)}`}
                            >
                              Draw {data.last_exact_match.draw_id}
                            </Link>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="checker-distribution" aria-label="Match Distribution">
                    <div className="checker-section-label">Match Distribution (3+ matched)</div>
                    <div
                      className="checker-stat-grid"
                      style={{
                        gridTemplateColumns: `repeat(${matchCounts.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {matchCounts.map((count) => (
                        <div className="checker-stat-box" key={count}>
                          <span className="checker-stat-label">{count} matched</span>
                          <strong className="checker-stat-value">
                            {data.overlap_histogram[`match_${count}`] ?? 0}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
      {data && (
        <section className="checker-detail-tabs" aria-label="Combination analysis details">
          <div className="checker-tablist" role="tablist" aria-label="Analysis views">
            <button
              id={`${tabsId}-tab-similar`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'similar'}
              aria-controls={`${tabsId}-panel-similar`}
              tabIndex={activeTab === 'similar' ? 0 : -1}
              className={`checker-tab${activeTab === 'similar' ? ' active' : ''}`}
              onClick={() => setActiveTab('similar')}
              onKeyDown={(event) => onTabKeyDown(event, 0)}
            >
              Similar Draws <span className="checker-tab-count">{data.similar_draws.total}</span>
            </button>
            <button
              id={`${tabsId}-tab-numbers`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'numbers'}
              aria-controls={`${tabsId}-panel-numbers`}
              tabIndex={activeTab === 'numbers' ? 0 : -1}
              className={`checker-tab${activeTab === 'numbers' ? ' active' : ''}`}
              onClick={() => setActiveTab('numbers')}
              onKeyDown={(event) => onTabKeyDown(event, 1)}
            >
              Numbers <span className="checker-tab-count">{data.number_analysis.length}</span>
            </button>
            <button
              id={`${tabsId}-tab-pairs`}
              type="button"
              role="tab"
              aria-selected={activeTab === 'pairs'}
              aria-controls={`${tabsId}-panel-pairs`}
              tabIndex={activeTab === 'pairs' ? 0 : -1}
              className={`checker-tab${activeTab === 'pairs' ? ' active' : ''}`}
              onClick={() => setActiveTab('pairs')}
              onKeyDown={(event) => onTabKeyDown(event, 2)}
            >
              Pairs <span className="checker-tab-count">{data.pair_analysis.length}</span>
            </button>
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
                        <Link
                          className="draw-id"
                          to={`/history/${item.draw.draw_id}${globalSearch(game!.id, analysisWindow)}`}
                        >
                          #{item.draw.draw_id}
                        </Link>
                        <span className="draw-date">{item.draw.draw_date}</span>
                      </div>
                      <span className="pill checker-match-pill">{item.overlap_count} matched</span>
                      <Link
                        className="link-arrow"
                        to={`/history/${item.draw.draw_id}${globalSearch(game!.id, analysisWindow)}`}
                      >
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
                setPage={(page) => setSimilarPage(page)}
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
                          <Link
                            to={`/numbers/${item.number}${globalSearch(game!.id, analysisWindow)}`}
                          >
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
                          <Link
                            to={`/pairs/${pair.numbers.join('-')}${globalSearch(game!.id, analysisWindow)}`}
                          >
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
      )}
    </>
  )
}
