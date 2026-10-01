import { Link, useLocation, useParams } from 'react-router'
import { api, globalSearch, params, type Draw, type Page } from '../api'
import { useApp, useQuery, useUrlField } from '../state'
import {
  BackLink,
  Balls,
  Card,
  DataState,
  DataTable,
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
        kicker="Lịch sử"
        title="Kết quả các kỳ quay"
        description="Tìm theo ngày hoặc mã kỳ; số đặc biệt được hiển thị riêng."
      />
      <div className="toolbar">
        <label className="field">
          Từ ngày
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="field">
          Đến ngày
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label className="field">
          Mã kỳ
          <input
            value={drawId}
            onChange={(event) => setDrawId(event.target.value)}
            placeholder="Ví dụ 00830"
          />
        </label>
        <label className="field">
          Thứ tự
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="desc">Mới trước</option>
            <option value="asc">Cũ trước</option>
          </select>
        </label>
      </div>
      {from && to && from > to ? (
        <div className="notice error">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</div>
      ) : (
        <Card>
          <DataState {...result} hasData={!!result.data} empty="Không có kỳ quay khớp bộ lọc.">
            {result.data && (
              <>
                <DataTable mobileHidden>
                  <thead>
                    <tr>
                      <th>Kỳ</th>
                      <th>Ngày / giờ</th>
                      <th>Số chính</th>
                      {game!.special_min !== null && <th>Đặc biệt</th>}
                      <th>Chi tiết</th>
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
                            Xem kỳ
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
                  <p className="muted">Không có kỳ quay khớp bộ lọc.</p>
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
      <BackLink to="/history" label="Về lịch sử" />
      <PageHead kicker="Chi tiết kỳ quay" title={`Kỳ ${drawId}`} description={game!.label} />
      <Card>
        <DataState {...result} hasData={!!result.data} empty="Không tìm thấy kỳ quay.">
          {result.data && (
            <div className="stack">
              <Balls
                values={result.data.main_numbers}
                special={game!.special_min === null ? null : result.data.special_number}
                large
              />
              <div>
                <strong>Ngày quay:</strong> {result.data.draw_date}
              </div>
              <div>
                <strong>Giờ quay:</strong> {result.data.draw_time ?? 'Không có dữ liệu'}
              </div>
              <div>
                <strong>Nguồn:</strong>{' '}
                <a href={result.data.source_url} target="_blank" rel="noreferrer">
                  Xem kết quả gốc
                </a>
              </div>
              <div>
                <strong>Thu thập lúc:</strong> {formatVietnamTime(result.data.source_retrieved_at)}
              </div>
              <div>
                <Link to={`/checker${globalSearch(game!.id, window)}`}>Kiểm tra một bộ số</Link>
              </div>
            </div>
          )}
        </DataState>
      </Card>
    </>
  )
}
