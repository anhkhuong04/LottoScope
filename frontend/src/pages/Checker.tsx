import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api, globalSearch, type CheckResponse } from '../api'
import { useApp } from '../state'
import { Ball, Balls, Card, DrawRows, PageHead, Pager, WindowSelector, formatPercent } from '../ui'

export function validateNumbers(
  numbers: number[],
  min: number,
  max: number,
  count: number,
): string | null {
  if (numbers.some((number) => !Number.isInteger(number) || number < min || number > max))
    return `Chỉ chọn số nguyên từ ${min} đến ${max}.`
  if (new Set(numbers).size !== numbers.length) return 'Có số bị trùng.'
  if (numbers.length !== count) return `Cần đúng ${count} số chính; hiện có ${numbers.length}.`
  return null
}

export function Checker() {
  const { game, window } = useApp()
  const [selected, setSelected] = useState<number[]>([])
  const [input, setInput] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [similarPage, setSimilarPage] = useState(1)
  const [result, setResult] = useState<{ key: string; data: CheckResponse } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
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
      setInputError(`Chỉ nhập số nguyên từ ${game!.main_min} đến ${game!.main_max}.`)
      return
    }
    if (new Set([...selected, ...parsed]).size !== selected.length + parsed.length) {
      setInputError('Có số bị trùng.')
      return
    }
    if (selected.length + parsed.length > game!.main_count) {
      setInputError(`Chỉ chọn ${game!.main_count} số chính.`)
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
  const validation = validateNumbers(selected, game!.main_min, game!.main_max, game!.main_count)
  const run = async (page = similarPage) => {
    if (validation) {
      setInputError(validation)
      return
    }
    controller.current?.abort()
    const request = new AbortController()
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
        setError(cause instanceof Error ? cause.message : 'Không kiểm tra được bộ số.')
    } finally {
      if (!request.signal.aborted) setLoadingKey(null)
    }
  }
  const data = result?.key === key ? result.data : null
  const visibleError = result?.key === key ? error : null
  return (
    <>
      <PageHead
        kicker="Kiểm tra bộ số"
        title="Đối chiếu với lịch sử"
        description="So sánh số chính của bộ bạn chọn với các kỳ đã lưu; không bao gồm số đặc biệt."
      />
      <WindowSelector />
      <div className="grid cols-2">
        <Card
          title={`Chọn ${game!.main_count} số chính`}
          subtitle={`Miền ${game!.main_min}–${game!.main_max}; có thể nhập nhiều số cách nhau bằng dấu cách.`}
        >
          <div className="token-box">
            {selected.length ? (
              selected.map((number) => (
                <button
                  key={number}
                  className="btn ghost"
                  aria-label={`Bỏ số ${number}`}
                  onClick={() => toggle(number)}
                >
                  <Ball value={number} /> ×
                </button>
              ))
            ) : (
              <span className="muted">Chưa chọn số nào</span>
            )}
          </div>
          <div className="toolbar">
            <label className="field">
              Nhập số
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
            <button className="btn" onClick={addInput}>
              Thêm số
            </button>
          </div>
          {inputError && (
            <div className="notice error" role="alert">
              {inputError}
            </div>
          )}
          <div className="picker" aria-label="Chọn số chính">
            {Array.from(
              { length: game!.main_max - game!.main_min + 1 },
              (_, i) => game!.main_min + i,
            ).map((number) => (
              <button
                key={number}
                className={selected.includes(number) ? 'selected' : ''}
                aria-pressed={selected.includes(number)}
                aria-label={`Số ${String(number).padStart(2, '0')}`}
                disabled={!selected.includes(number) && selected.length >= game!.main_count}
                onClick={() => toggle(number)}
              >
                {String(number).padStart(2, '0')}
              </button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 15 }}>
            {selected.length}/{game!.main_count} số đã chọn
          </p>
          <button className="btn primary" disabled={loading || !!validation} onClick={() => run()}>
            {loading ? 'Đang đối chiếu…' : 'Kiểm tra lịch sử'}
          </button>
        </Card>
        <Card title="Kết quả đối chiếu">
          <div aria-live="polite">
            {!data && !loading && !visibleError && (
              <p className="muted">Chọn đủ số rồi bắt đầu kiểm tra.</p>
            )}
            {loading && <p className="muted">Đang đối chiếu dữ liệu…</p>}
            {visibleError && (
              <div className="notice error" role="alert">
                {data ? 'Kết quả cũ trong cùng phạm vi. ' : ''}
                {visibleError} <button onClick={() => run()}>Thử lại</button>
              </div>
            )}
          </div>
          {data && (
            <div className="stack">
              <Balls values={data.main_numbers} large />
              <span className="pill">Đối chiếu {data.history_draw_count} kỳ trong lịch sử</span>
              <h2>Trùng chính xác: {data.exact_match_count} kỳ</h2>
              {data.last_exact_match ? (
                <div>
                  Kỳ gần nhất:{' '}
                  <Link
                    to={`/history/${data.last_exact_match.draw_id}${globalSearch(game!.id, window)}`}
                  >
                    {data.last_exact_match.draw_id}
                  </Link>
                </div>
              ) : (
                <p className="muted">
                  Không có kỳ trùng chính xác; đây là kết quả kiểm tra hợp lệ.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
      {data && (
        <div className="stack result-group">
          <Card title="Mức trùng số" subtitle="Số kỳ có đúng từng mức trùng số chính">
            <div className="grid cols-3">
              {Array.from({ length: game!.main_count + 1 }, (_, count) => (
                <div className="result-item" key={count}>
                  <strong>{count} số trùng</strong>
                  <div>{data.overlap_histogram[`match_${count}`] ?? 0} kỳ</div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Các kỳ trùng nhiều số">
            <div className="stack">
              {data.similar_draws.items.map((item) => (
                <div key={item.draw.draw_id}>
                  <span className="pill">Trùng {item.overlap_count} số</span>
                  <DrawRows draws={[item.draw]} game={game!} />
                </div>
              ))}
              {data.similar_draws.items.length === 0 && (
                <p className="muted">Không có kỳ tương tự.</p>
              )}
            </div>
            <Pager
              page={data.similar_draws.page}
              total={data.similar_draws.total}
              pageSize={data.similar_draws.page_size}
              setPage={(page) => run(page)}
            />
          </Card>
          <Card title="Thống kê từng số">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Số</th>
                    <th>Tần suất</th>
                    <th>Tỷ lệ</th>
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
          <Card title="Các cặp trong bộ số">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cặp</th>
                    <th>Số kỳ</th>
                    <th>Tỷ lệ</th>
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
