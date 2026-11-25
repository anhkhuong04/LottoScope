import { useEffect, useId, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, globalSearch, type CheckResponse } from '../api'
import { useApp } from '../state'
import { Balls, Card, PageHead, WindowSelector } from '../ui'
import { parseCombination } from '../features/draw-machine/checkerLink'

import { CheckerDetails, type DetailTab } from '../features/checker/CheckerDetails'

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
  const { game, window: analysisWindow, dataRevision } = useApp()
  const [search] = useSearchParams()
  const [selected, setSelected] = useState<number[]>(() =>
    parseCombination(search.get('numbers'), game!.main_min, game!.main_max, game!.main_count),
  )
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
  }, [key, validation, attempt, dataRevision])

  const toggle = (number: number) => {
    setSelected((values) =>
      values.includes(number)
        ? values.filter((value) => value !== number)
        : values.length < game!.main_count
          ? [...values, number].sort((a, b) => a - b)
          : values,
    )
    setSimilarPage(1)
  }
  const clear = () => {
    setSelected([])
    setSimilarPage(1)
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
          title={`Select ${game!.main_count} main numbers`}
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
        <CheckerDetails
          data={data}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setPage={setSimilarPage}
          selectedSet={selectedSet}
          search={globalSearch(game!.id, analysisWindow)}
          tabsId={tabsId}
        />
      )}
    </>
  )
}
