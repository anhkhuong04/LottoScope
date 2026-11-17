import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, globalSearch, type CheckResponse } from '../api'
import { useApp } from '../state'
import { Ball, Balls, Card, DrawRows, PageHead, Pager, WindowSelector, formatPercent } from '../ui'
import { parseCombination } from '../features/draw-machine/checkerLink'

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
  const { game, window } = useApp()
  const [search] = useSearchParams()
  const [selected, setSelected] = useState<number[]>(() =>
    parseCombination(search.get('numbers'), game!.main_min, game!.main_max, game!.main_count),
  )
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [similarPage, setSimilarPage] = useState(1)
  const [result, setResult] = useState<{ key: string; data: CheckResponse } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const resultFocus = useRef<HTMLDivElement>(null)
  const focusOnResult = useRef(false)
  const contextKey = `${game!.id}:${JSON.stringify(window)}:${[...selected].sort((a, b) => a - b).join(',')}`
  const key = `${contextKey}:${similarPage}`
  const loading = loadingKey?.startsWith(`${contextKey}:`) ?? false
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    controller.current?.abort()
  }, [key])
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
    controller.current?.abort()
    setSelected([...selected, ...parsed].sort((a, b) => a - b))
    setInput('')
    setInputError(null)
    setSimilarPage(1)
  }
  const toggle = (number: number) => {
    controller.current?.abort()
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
    controller.current?.abort()
    setSelected([])
    setInput('')
    setInputError(null)
    setSimilarPage(1)
  }
  const validation = validateNumbers(selected, game!.main_min, game!.main_max, game!.main_count)
  const run = async (page = similarPage) => {
    if (validation) {
      setInputError(validation)
      return
    }
    controller.current?.abort()
    const request = new AbortController()
    focusOnResult.current = page === 1
    controller.current = request
    const requestKey = `${game!.id}:${JSON.stringify(window)}:${selected.join(',')}:${page}`
    setLoadingKey(requestKey)
    setError(null)
    try {
      const data = await api<CheckResponse>(
        `/games/${game!.id}/combinations/check`,
        request.signal,
        {
          main_numbers: selected,
          analysis_window: window,
          similar_page: page,
          similar_page_size: 10,
        },
      )
      if (!request.signal.aborted) {
        setResult({ key: requestKey, data })
        setSimilarPage(page)
      }
    } catch (cause) {
      if (!request.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Failed to check combination.')
    } finally {
      if (!request.signal.aborted) setLoadingKey(null)
    }
  }
  const data = result?.key === key ? result.data : null
  const visibleError = result?.key === key ? error : null
  useEffect(() => {
    if (data && focusOnResult.current) {
      resultFocus.current?.focus()
      focusOnResult.current = false
    }
  }, [data])
  return (
    <>
      <PageHead
        title="Combination Checker"
        description="Compare your selected main numbers against recorded draws; excludes special number."
      />
      <WindowSelector />
      <div className="grid cols-2">
        <Card
          title={`Select ${game!.main_count} main numbers`}
          subtitle={`Range ${game!.main_min}–${game!.main_max}; multiple numbers can be separated by spaces.`}
        >
          <div className="token-box">
            {selected.length ? (
              selected.map((number) => (
                <button
                  key={number}
                  className="btn ghost"
                  aria-label={`Remove number ${number}`}
                  onClick={() => toggle(number)}
                >
                  <Ball value={number} /> ×
                </button>
              ))
            ) : (
              <span className="muted">No numbers selected</span>
            )}
          </div>
          <div className="toolbar checker-input-toolbar">
            <label className="field">
              Enter numbers
              <input
                inputMode="numeric"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addInput()
                  }
                }}
                placeholder="01 02 03"
              />
            </label>
            <div className="checker-input-actions">
              <button className="btn btn-sm" onClick={addInput}>
                Add
              </button>
              <button
                className="btn btn-sm"
                disabled={selected.length === 0}
                onClick={clear}
                aria-label="Clear selected numbers"
              >
                Clear
              </button>
            </div>
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
          <p className="muted" style={{ marginTop: 15 }}>
            {selected.length}/{game!.main_count} numbers selected
          </p>
          <div className="toolbar" style={{ marginTop: 15, marginBottom: 0 }}>
            <button
              className="btn primary"
              disabled={loading || !!validation}
              onClick={() => run()}
            >
              {loading ? 'Checking…' : 'Check history'}
            </button>
          </div>
        </Card>
        <Card title="Check Results">
          <div className="result-focus" ref={resultFocus} tabIndex={-1} aria-label="Check Results">
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
                  <h3>
                    {selected.length === game!.main_count
                      ? 'Combination ready'
                      : 'Start with your combination'}
                  </h3>
                  <p className="muted">
                    {selected.length}/{game!.main_count} main numbers selected. Select full set to
                    check.
                  </p>
                  <p className="muted">
                    View exact matches, match distribution, and statistical metrics across the
                    selected window.
                  </p>
                </div>
              )}
              {loading && <p className="muted">Comparing with history…</p>}
              {visibleError && (
                <div className="notice error" role="alert">
                  {data ? 'Previous result in same window. ' : ''}
                  {visibleError} <button onClick={() => run()}>Retry</button>
                </div>
              )}
            </div>
            {data && (
              <div className="stack">
                <Balls values={data.main_numbers} large />
                <span className="pill">
                  Checked against {data.history_draw_count} historical draws
                </span>
                <h2>Exact Matches: {data.exact_match_count} draw(s)</h2>
                {data.last_exact_match ? (
                  <div>
                    Latest match:{' '}
                    <Link
                      to={`/history/${data.last_exact_match.draw_id}${globalSearch(game!.id, window)}`}
                    >
                      {data.last_exact_match.draw_id}
                    </Link>
                  </div>
                ) : (
                  <p className="muted">No exact match found; this is a valid check result.</p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
      {data && (
        <div className="stack result-group">
          <Card
            title="Match Distribution"
            subtitle="Number of draws matching exact number of main balls"
          >
            <div className="grid cols-3">
              {Array.from({ length: game!.main_count + 1 }, (_, count) => (
                <div className="result-item" key={count}>
                  <strong>{count} matched</strong>
                  <div>{data.overlap_histogram[`match_${count}`] ?? 0} draws</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Similar Draws">
            <div className="stack">
              {data.similar_draws.items.map((item) => (
                <div key={item.draw.draw_id}>
                  <span className="pill">{item.overlap_count} matches</span>
                  <DrawRows draws={[item.draw]} game={game!} />
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
              setPage={(page) => run(page)}
            />
          </Card>
          <Card title="Individual Number Stats">
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
                        <Link to={`/numbers/${item.number}${globalSearch(game!.id, window)}`}>
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
          </Card>
          <Card title="Pairs in Combination">
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
                          to={`/pairs/${pair.numbers.join('-')}${globalSearch(game!.id, window)}`}
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
          </Card>
        </div>
      )}
    </>
  )
}
