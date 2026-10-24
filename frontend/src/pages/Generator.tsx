import { useEffect, useRef, useState } from 'react'
import { api, type GenerateResponse, type GeneratedItem } from '../api'
import { useApp } from '../state'
import { Balls, Card, PageHead, WindowSelector } from '../ui'
import DrawMachine from '../features/draw-machine/DrawMachine'

type RuleId =
  | 'exclude_exact_within_days'
  | 'max_overlap_previous_draw'
  | 'minimum_historical_pair_frequency'
  | 'exclude_bottom_frequency_numbers'
  | 'odd_even_ratio'
  | 'sum_range'
type Values = Record<string, number>
const ruleLabels: {
  id: RuleId
  label: string
  help: string
  fields: { name: string; label: string; min: number }[]
}[] = [
  {
    id: 'exclude_exact_within_days',
    label: 'Loại bộ trùng gần đây',
    help: 'Không lấy bộ số chính đã trùng chính xác trong số ngày đã chọn.',
    fields: [{ name: 'days', label: 'Số ngày', min: 1 }],
  },
  {
    id: 'max_overlap_previous_draw',
    label: 'Giới hạn trùng kỳ trước',
    help: 'Số chính trùng với kỳ quay gần nhất không vượt ngưỡng.',
    fields: [{ name: 'max', label: 'Trùng tối đa', min: 0 }],
  },
  {
    id: 'minimum_historical_pair_frequency',
    label: 'Cặp từng xuất hiện',
    help: 'Ít nhất một cặp trong bộ có tần suất lịch sử đạt ngưỡng.',
    fields: [{ name: 'min_count', label: 'Số kỳ tối thiểu', min: 1 }],
  },
  {
    id: 'exclude_bottom_frequency_numbers',
    label: 'Bỏ nhóm tần suất thấp',
    help: 'Không chọn số thuộc nhóm có tần suất thấp nhất trong phạm vi.',
    fields: [{ name: 'n', label: 'Số lượng loại', min: 0 }],
  },
  {
    id: 'odd_even_ratio',
    label: 'Tỷ lệ chẵn lẻ',
    help: 'Yêu cầu đúng số lượng số lẻ và số chẵn.',
    fields: [
      { name: 'odd', label: 'Lẻ', min: 0 },
      { name: 'even', label: 'Chẵn', min: 0 },
    ],
  },
  {
    id: 'sum_range',
    label: 'Khoảng tổng',
    help: 'Tổng các số chính nằm trong khoảng từ–đến.',
    fields: [
      { name: 'min', label: 'Tổng từ', min: 1 },
      { name: 'max', label: 'Tổng đến', min: 1 },
    ],
  },
]

function initialValues(count: number): Values {
  return {
    days: 30,
    max: 3,
    min_count: 1,
    n: 1,
    odd: Math.floor(count / 2),
    even: Math.ceil(count / 2),
    min: 60,
    max_sum: 120,
  }
}

export function Generator() {
  const { game, window } = useApp()
  return game!.id === 'mega_645' || game!.id === 'power_655' ? (
    <DrawMachine key={game!.id} game={game!} analysisWindow={window} />
  ) : (
    <RuleGenerator />
  )
}

function RuleGenerator() {
  const { game, window } = useApp()
  const [enabled, setEnabled] = useState<RuleId[]>([])
  const [values, setValues] = useState<Values>(() => initialValues(game!.main_count))
  const [count, setCount] = useState(5)
  const [seed, setSeed] = useState('')
  const [result, setResult] = useState<{ key: string; data: GenerateResponse } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [active, setActive] = useState<GeneratedItem | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const formKey = `${game!.id}:${JSON.stringify(window)}:${JSON.stringify(enabled)}:${JSON.stringify(values)}:${count}:${seed}`
  const loading = loadingKey === formKey
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    controller.current?.abort()
  }, [formKey])
  useEffect(() => {
    if (active) dialog.current?.showModal()
    else dialog.current?.close()
  }, [active])
  const ruleBody: Record<string, object> = {}
  for (const id of enabled) {
    if (id === 'exclude_exact_within_days') ruleBody[id] = { days: values.days }
    if (id === 'max_overlap_previous_draw') ruleBody[id] = { max: values.max }
    if (id === 'minimum_historical_pair_frequency') ruleBody[id] = { min_count: values.min_count }
    if (id === 'exclude_bottom_frequency_numbers') ruleBody[id] = { n: values.n }
    if (id === 'odd_even_ratio') ruleBody[id] = { odd: values.odd, even: values.even }
    if (id === 'sum_range') ruleBody[id] = { min: values.min, max: values.max_sum }
  }
  const invalid =
    !Number.isInteger(count) ||
    count < 1 ||
    count > 20 ||
    (seed !== '' && (!Number.isSafeInteger(Number(seed)) || Number(seed) < 0)) ||
    enabled.some((id) =>
      ruleLabels
        .find((rule) => rule.id === id)!
        .fields.some((field) => {
          const value = values[id === 'sum_range' && field.name === 'max' ? 'max_sum' : field.name]
          return !Number.isInteger(value) || value < field.min
        }),
    ) ||
    (enabled.includes('odd_even_ratio') && values.odd + values.even !== game!.main_count) ||
    (enabled.includes('sum_range') && values.min > values.max_sum) ||
    (enabled.includes('max_overlap_previous_draw') && values.max > game!.main_count) ||
    (enabled.includes('exclude_bottom_frequency_numbers') &&
      values.n > game!.main_max - game!.main_count)
  const run = async () => {
    if (invalid) return
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setLoadingKey(formKey)
    setError(null)
    try {
      const data = await api<GenerateResponse>(
        `/games/${game!.id}/combinations/generate`,
        request.signal,
        {
          analysis_window: window,
          requested_count: count,
          ...(seed === '' ? {} : { seed: Number(seed) }),
          rules: ruleBody,
        },
      )
      if (!request.signal.aborted) setResult({ key: formKey, data })
    } catch (cause) {
      if (!request.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'Không tạo được bộ số.')
    } finally {
      if (!request.signal.aborted) setLoadingKey(null)
    }
  }
  const data = result?.key === formKey ? result.data : null
  return (
    <>
      <PageHead
        kicker="Tạo bộ số"
        title="Khám phá theo quy tắc"
        description="Chọn các điều kiện minh bạch; kết quả không phải dự đoán hoặc khuyến nghị."
      />
      <WindowSelector />
      <div className="generator-layout">
        <Card title="Cấu hình quy tắc" subtitle="Chỉ quy tắc được bật mới gửi đến API.">
          {ruleLabels.map((rule) => (
            <div className="rule" key={rule.id}>
              <label className="rule-title">
                <input
                  type="checkbox"
                  checked={enabled.includes(rule.id)}
                  onChange={(event) => {
                    controller.current?.abort()
                    setEnabled((current) =>
                      event.target.checked
                        ? [...current, rule.id]
                        : current.filter((id) => id !== rule.id),
                    )
                  }}
                />
                {rule.label}
              </label>
              <p className="rule-help">{rule.help}</p>
              {enabled.includes(rule.id) && (
                <div className="rule-fields">
                  {rule.fields.map((field) => {
                    const name =
                      rule.id === 'sum_range' && field.name === 'max' ? 'max_sum' : field.name
                    return (
                      <label className="field" key={field.name}>
                        {field.label}
                        <input
                          type="number"
                          min={field.min}
                          max={
                            rule.id === 'max_overlap_previous_draw' ? game!.main_count : undefined
                          }
                          value={values[name]}
                          onChange={(event) => {
                            controller.current?.abort()
                            setValues((current) => ({
                              ...current,
                              [name]: event.target.value === '' ? NaN : Number(event.target.value),
                            }))
                          }}
                        />
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          <div className="toolbar" style={{ marginTop: 16 }}>
            <label className="field">
              Số bộ cần tạo
              <input
                type="number"
                min="1"
                max="20"
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </label>
            <label className="field">
              Seed (tùy chọn)
              <input
                type="number"
                min="0"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                placeholder="API tự chọn"
              />
            </label>
          </div>
          {invalid && (
            <div className="notice error" role="alert">
              Kiểm tra số lượng, seed và ngưỡng quy tắc. Tỷ lệ chẵn lẻ phải đủ {game!.main_count}{' '}
              số.
            </div>
          )}
          <button className="btn primary" disabled={invalid || loading} onClick={run}>
            {loading ? 'Đang tạo…' : 'Tạo bộ số'}
          </button>
        </Card>
        <Card title="Kết quả" subtitle="Mỗi bộ có giải thích riêng; chọn một bộ để xem chi tiết.">
          <div aria-live="polite">
            {loading && <p className="muted">Đang tìm bộ phù hợp…</p>}
            {error && (
              <div className="notice error" role="alert">
                {data ? 'Kết quả cũ trong cùng cấu hình. ' : ''}
                {error} <button onClick={run}>Thử lại</button>
              </div>
            )}
            {!data && !loading && !error && (
              <p className="muted">Chọn quy tắc và bấm “Tạo bộ số”.</p>
            )}
          </div>
          {data && (
            <>
              <div className="notice">
                {data.generated_count}/{data.requested_count} bộ ·{' '}
                {data.status === 'partial'
                  ? 'Chỉ tạo được một phần trong giới hạn thử.'
                  : 'Hoàn tất.'}{' '}
                Seed {data.seed} · {data.attempted_count} lần thử.
              </div>
              {data.items.length === 0 && (
                <p className="muted">Không tìm được bộ đáp ứng tất cả quy tắc đã bật.</p>
              )}
              <div className="result-list">
                {data.items.map((item, index) => (
                  <div className="result-item" key={item.main_numbers.join('-')}>
                    <strong>Bộ {index + 1}</strong>
                    <Balls values={item.main_numbers} />
                    <button className="btn" onClick={() => setActive(item)}>
                      Xem giải thích
                    </button>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ marginTop: 15 }}>
                Phạm vi: {data.context.actual_draw_count} kỳ · phiên bản thuật toán{' '}
                {data.algorithm_version} · ngày tham chiếu {data.reference_date}
              </p>
            </>
          )}
        </Card>
      </div>
      <dialog
        ref={dialog}
        className="drawer-dialog"
        onClose={() => setActive(null)}
        onClick={(event) => {
          if (event.target === dialog.current) setActive(null)
        }}
      >
        <div className="drawer">
          <div className="drawer-head">
            <h2>Giải thích bộ số</h2>
            <button className="btn" onClick={() => setActive(null)}>
              Đóng
            </button>
          </div>
          {active && (
            <>
              <Balls values={active.main_numbers} large />
              <p className="muted" style={{ marginTop: 17 }}>
                Các số liệu dưới đây mô tả phạm vi lịch sử đã chọn.
              </p>
              <h3>Tần suất từng số</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Số</th>
                      <th>Số kỳ</th>
                      <th>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {active.explanation.number_frequency.map((item) => (
                      <tr key={item.number}>
                        <td>{String(item.number).padStart(2, '0')}</td>
                        <td>{item.frequency}</td>
                        <td>{item.current_gap ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 style={{ marginTop: 20 }}>Cặp số lịch sử</h3>
              <div className="stack">
                {active.explanation.historical_pairs.map((pair) => (
                  <div key={pair.numbers.join('-')}>
                    {pair.numbers.map((number) => String(number).padStart(2, '0')).join(' · ')} —{' '}
                    {pair.frequency} kỳ
                  </div>
                ))}
              </div>
              <h3 style={{ marginTop: 20 }}>Điều kiện</h3>
              {active.explanation.rule_results.length ? (
                active.explanation.rule_results.map((rule) => (
                  <div className="result-item" key={rule.rule_id}>
                    <strong>
                      {ruleLabels.find((item) => item.id === rule.rule_id)?.label ?? rule.rule_id}
                    </strong>
                    <div>
                      Ngưỡng: {JSON.stringify(rule.threshold)} · Quan sát:{' '}
                      {JSON.stringify(rule.observed)} · {rule.passed ? 'Đạt' : 'Không đạt'}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">Không bật quy tắc lọc.</p>
              )}
              <p className="muted" style={{ marginTop: 20 }}>
                Trùng chính xác trong số ngày chọn:{' '}
                {active.explanation.exact_match_within_days ?? 'Không áp dụng'} · Mức trùng cao nhất
                với các kỳ gần đây:{' '}
                {active.explanation.maximum_recent_overlap ?? 'Không có dữ liệu'}
              </p>
            </>
          )}
        </div>
      </dialog>
    </>
  )
}
