import { Trophy } from 'lucide-react'
import { api, ApiError, type PrizeMatch, type PrizeDetails } from '../api'
import { useQuery } from '../state'
import { Card, DataState, formatVietnamTime } from '../ui'

const integerFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const prizeErrorMessages: Record<string, string> = {
  prize_source_unavailable: 'Chưa lấy được bảng giải thưởng từ Vietlott. Vui lòng thử lại.',
  ingestion_busy: 'Dữ liệu đang được thu thập. Vui lòng thử lại sau ít phút.',
  prize_review_pending: 'Dữ liệu nguồn thay đổi và đang chờ đối chiếu.',
}

function PrizeCondition({ match }: { match: PrizeMatch }) {
  const description = match.main_count
    ? `Trùng ${match.main_count} số chính${match.special ? ' và số đặc biệt' : ''}`
    : 'Trùng số đặc biệt'
  return (
    <span className="prize-match" role="img" aria-label={description}>
      <span aria-hidden="true" className="prize-main-symbols">
        {Array.from({ length: match.main_count }, (_, index) => (
          <span key={index} className="prize-symbol" />
        ))}
      </span>
      {match.special && (
        <span aria-hidden="true" className="prize-special-symbols">
          {match.main_count > 0 && <span>+</span>}
          <span className="prize-symbol special" />
        </span>
      )}
    </span>
  )
}

export function DrawPrizes({ gameId, drawId }: { gameId: string; drawId: string }) {
  const path = `/games/${encodeURIComponent(gameId)}/draws/${encodeURIComponent(drawId)}/prizes`
  const result = useQuery(path, (signal) => api<PrizeDetails>(path, signal))
  const prizeError =
    result.error instanceof ApiError ? prizeErrorMessages[result.error.code ?? ''] : undefined
  const firstPrize = result.data?.items[0]
  const featuredPrizes = result.data?.items.filter(
    (prize, index) => index === 0 || /^Jackpot(?: [12])?$/.test(prize.name),
  )
  return (
    <Card
      title="Giải thưởng kỳ quay"
      subtitle="Số lượng và giá trị giải theo công bố của Vietlott."
      className="prize-card"
    >
      <DataState
        {...result}
        error={prizeError ? new Error(prizeError) : result.error}
        hasData={!!result.data}
        empty="Chưa có dữ liệu giải thưởng cho kỳ này."
      >
        {result.data &&
          (firstPrize ? (
            <>
              <div className="prize-highlights">
                {featuredPrizes?.map((prize) => (
                  <div className="prize-jackpot" key={prize.name}>
                    <span>
                      <Trophy size={21} aria-hidden="true" /> {prize.name}
                    </span>
                    <strong>{integerFormat.format(BigInt(prize.amount_vnd))} VND</strong>
                  </div>
                ))}
              </div>
              <table className="prize-table" aria-label="Bảng giải thưởng">
                <thead>
                  <tr>
                    <th scope="col">Giải thưởng</th>
                    <th scope="col">Kết quả</th>
                    <th scope="col">Số lượng giải</th>
                    <th scope="col">Giá trị giải (đồng)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((prize) => (
                    <tr key={prize.name}>
                      <th scope="row">{prize.name}</th>
                      <td>
                        <div className="prize-conditions">
                          {prize.matches.map((match) => (
                            <PrizeCondition
                              key={`${match.main_count}-${match.special}`}
                              match={match}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="prize-count">
                        <span className="prize-mobile-label" aria-hidden="true">
                          Số lượng giải
                        </span>
                        <span>{integerFormat.format(prize.winner_count)}</span>
                      </td>
                      <td className="prize-amount">
                        <span className="prize-mobile-label" aria-hidden="true">
                          Giá trị giải (đồng)
                        </span>
                        <span>{integerFormat.format(BigInt(prize.amount_vnd))}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted prize-source">
                <a href={result.data.source_url} target="_blank" rel="noreferrer">
                  Bảng giải thưởng gốc
                </a>
                {result.data.source_retrieved_at &&
                  ` · Thu thập ${formatVietnamTime(result.data.source_retrieved_at)}`}
              </p>
            </>
          ) : (
            <p className="muted">Chưa có dữ liệu giải thưởng cho kỳ này.</p>
          ))}
      </DataState>
    </Card>
  )
}
