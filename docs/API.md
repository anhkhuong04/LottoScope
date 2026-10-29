# HTTP API contract — MVP v1

Base path `/api/v1`. Domain values/time ở [DOMAIN.md](DOMAIN.md); metric/rules
ở [ANALYTICS.md](ANALYTICS.md). API chỉ serialize kết quả service, không tính
lại analytics. Tất cả number trong JSON là integer; UI tự hiển thị `01`.

## Quy ước chung

- Cloud opt-in theo [ADR 0011](DECISIONS/0011-free-cloud-deployment.md): browser
  vẫn dùng `/api/v1` cùng origin Vercel. Render yêu cầu server token ở header
  `X-Lotto-Origin-Token` cho mọi path trừ GET `/health/live`; không token/sai
  → 401 `unauthorized`. Token không cấp cho browser. Local giữ access hiện có.
  Gateway giới hạn JSON POST 64 KiB, GET/POST, no-store, không retry writes;
  deadline 270 giây trả 504 `gateway_timeout`, outcome sync có thể chưa biết.
  Cloud tắt docs/OpenAPI. Website Vercel công khai theo yêu cầu người dùng.

- Path `game` là `lotto_535`, `mega_645` hoặc `power_655`. Game lạ → 404 `unknown_game`.
  Dates dùng `YYYY-MM-DD` theo Việt Nam; timestamps dùng RFC 3339 có `Z`.
  `draw_time` nếu có dùng `HH:MM:SS`, hiểu theo Việt Nam. `null` là thiếu
  dữ liệu/không áp dụng, không thay bằng 0 hoặc chuỗi rỗng.
- Pagination: `page` mặc định 1, `page_size` mặc định 25, tối đa 100; response
  `{items,page,page_size,total}`. Page ngoài phạm vi → `items: []` và total
  thật. Sort chỉ nhận enum document ở endpoint, không nhận tên SQL tùy ý.
  Sort tie theo chronological key với draws, theo number/pair tăng với metrics;
  gap `null` luôn đứng cuối.
- Endpoint analytics có `window=last_draws&count=10|20|30|50|100`, hoặc
  `window=date_range&from_date=...&to_date=...`, hoặc `window=all_time`.
  Gửi thừa/thiếu tham số không hợp lệ → 422; `date_range` tối đa 3650 ngày
  giữa hai đầu để giới hạn tài nguyên API. API yêu cầu window rõ; UI gửi
  `last_draws, count=30` theo default của wireframe. Có thể thêm
  `as_of_draw_id`; absent lấy latest đã lưu. Cutoff chỉ cùng game và inclusive.
- `analysis_window` trong POST body là object tương đương:
  `{"kind":"last_draws","count":30}` hoặc `{"kind":"date_range",
  "from_date":"...","to_date":"..."}` hoặc `{"kind":"all_time"}`.
- Analytics/checker/generator response có `context`:
  `{game, analysis_window, as_of_draw_id, actual_draw_count, data_version}`.
  Khi không có draw: `as_of_draw_id:null`, `actual_draw_count:0`.
  `data_version` tăng khi insert/correction, không là thời gian quay.
- Request validation server-side; invalid path/game/cutoff → 404; invalid
  field/window/rule/page → 422; history thiếu với rule bắt buộc → 409;
  lỗi upstream khi trigger ingestion → 502/503;
  internal error → 500. Không lộ traceback/SQL/secrets.
- Error JSON: `{"error":{"code":"invalid_window","message":"...",
  "details":{...}}}`. `code` ổn định cho client; `message` dễ đọc, không
  chứa HTML từ nguồn. Thông tin không có exact match là response 200 hợp lệ.

## Đồng bộ thủ công

`POST /games/{game}/sync`, JSON body `{}`. Chỉ đồng bộ game trong path bằng
collector latest-only hiện có, tối đa 20 ID/lượt; không nhập toàn lịch sử.
Request chạy trong worker thread và trả sau khi xử lý xong. Body thiếu,
form hoặc field lạ → 422; GET không kích hoạt đồng bộ.

Response 200: `{game,run_id,status,created,enriched,unchanged,remaining_unresolved}`.
`status` giữ nguyên `success|partial` của run trong DB. Partial chỉ vì backlog
cũ, latest đã xử lý và không có lỗi hiện tại vẫn trả 200; client phải nêu
`remaining_unresolved`, không diễn giải thành history đầy đủ. `created=0` có
thể là đã có kỳ mới nhất, không phải lỗi.

- 409 `ingestion_busy`: đang có lượt manual khác hoặc ingestion cùng game.
- 429 `sync_cooldown`, `Retry-After: 60`: một collector cùng game vừa hoàn
  tất trong 60 giây, kể cả thất bại; không gọi nguồn thêm.
- 503 `sync_source_unavailable`: lượt hiện tại chưa hoàn tất vì nguồn/parse
  hoặc validation. Phần đã commit vẫn giữ; client đọc lại DB nhưng báo lỗi.
- 409 `sync_review_pending`: nguồn khác dữ liệu đã lưu, cần correction review.

Endpoint dùng cùng origin với UI; cloud công khai opt-in theo ADR 0011 có
gateway bảo vệ origin, không thêm quyền quản trị theo user. Giao diện chặn click trùng,
giữ context và tải lại các query sau lượt sync kể cả khi lỗi. Collector vẫn
ghi run/counters và giữ idempotence/lock/correction policy hiện có.

## Endpoints đọc

| Method/path | Query chính | Response data |
| --- | --- | --- |
| `GET /games` | — | `items:[{id,label,main_count,main_min,main_max,special_min,special_max}]`; Mega special fields `null` |
| `GET /games/{game}/status` | — | `latest_draw_id`, `latest_draw_date`, `last_successful_ingestion_at`, `last_failed_ingestion_at`, `data_version` |
| `GET /games/{game}/draws/latest` | — | Một draw; 404 `no_draws` nếu DB rỗng |
| `GET /games/{game}/draws` | `from_date`, `to_date`, `draw_id`, `page`, `page_size`, `sort=asc|desc` | Paginated draws, default newest trước |
| `GET /games/{game}/draws/{draw_id}` | — | Một draw; 404 `draw_not_found` |
| `GET /games/{game}/draws/{draw_id}/prizes` | — | Snapshot giải; bổ sung đúng kỳ từ nguồn nếu chưa có; 404 `draw_not_found` |
| `GET /games/{game}/analytics/numbers` | Window + cutoff; `sort=number|frequency_desc|frequency_asc|gap_desc`; paging không cần vì tối đa 55 | `context`, `items:[{number,frequency,frequency_percent,frequency_rank,current_gap,average_gap,max_gap,last_seen_draw_id}]` |
| `GET /games/{game}/analytics/numbers/{number}` | Window + cutoff; `page`,`page_size` cho history | `context`, một number metrics, `appearance_draws` paginated, `pair_partners` top 10 và timeline draw IDs |
| `GET /games/{game}/analytics/pairs` | Window + cutoff; `min_frequency>=0`, `sort=frequency_desc|frequency_asc|pair`, paging | `context`, paginated `{numbers:[a,b],frequency,percent_of_draws,current_gap,last_seen_draw_id}` |
| `GET /games/{game}/analytics/pairs/{a}/{b}` | Window + cutoff; paging history | `context`, pair metrics, `appearance_draws` paginated, timeline draw IDs |

Draw JSON: `{draw_id,draw_date,draw_time,main_numbers,special_number,
source_url,source_retrieved_at}`. `source_url` chỉ đến trang kết quả cụ thể.
Prizes JSON: `{draw_id,currency:"VND",items:[{name,matches:[{main_count,special}],
winner_count,amount_vnd}],source_url,source_retrieved_at}`. `winner_count` là
integer kể cả 0; `amount_vnd` là **chuỗi thập phân** (ví dụ `"178900548500"`)
để client không làm tròn tiền. Nguồn không có bảng hợp lệ sau fetch thành công
→ `items:[]`, timestamp `null`; không tạo hạng/giá trị giả. Timestamp này riêng
với lúc thu thập kết quả quay. Endpoint chi tiết/latest/history hiện có giữ shape cũ.

Endpoint prizes đọc snapshot từ PostgreSQL khi có. Khi chưa có, service chạy
ingestion giới hạn đúng kỳ và lưu snapshot idempotent. Source lỗi/parse lỗi
→ 503 `prize_source_unavailable`; job khác đang chạy → 409 `ingestion_busy`,
thử lại sau; source khác nội dung đã lưu → 409 `prize_review_pending`, cần
correction review. Lỗi prizes không ảnh hưởng endpoint chi tiết kết quả quay.

Number/pair không trong miền hoặc pair trùng số → 422. Pair path đảo thứ tự
được canonical trước lookup. Detail history chỉ chứa draw trong window.

Ví dụ `GET /api/v1/games/lotto_535/draws?from_date=2026-08-17&to_date=2026-08-17&page=1&page_size=25`
trả hai kỳ `00830`, `00829` theo newest trước nếu chỉ hai kỳ đó trong dữ liệu;
không gộp chúng thành một record vì cùng ngày.

Ví dụ response rút gọn của numbers, **fixture giả lập** ở
[ANALYTICS.md](ANALYTICS.md):

```json
{
  "context": {"game":"lotto_535","analysis_window":{"kind":"last_draws","count":10},"as_of_draw_id":"90003","actual_draw_count":3,"data_version":1},
  "items": [{"number":2,"frequency":3,"frequency_percent":100.0,"frequency_rank":1,"current_gap":0,"average_gap":0.0,"max_gap":0,"last_seen_draw_id":"90003"}]
}
```

Response thực có đủ 35 số, từ 1 tới 35. Fixture IDs `90001`–`90003` là
dữ liệu test, không phải kết quả Vietlott.

## Checker

`POST /games/{game}/combinations/check` body:

```json
{"main_numbers":[7,19,25,29,33],"analysis_window":{"kind":"last_draws","count":30},"as_of_draw_id":null,"similar_page":1,"similar_page_size":25}
```

`as_of_draw_id:null` tương đương omitted. Không nhận special trong MVP;
unknown fields bị từ chối. Response gồm `context`, `main_numbers` canonical,
`exact_match_count`, `last_exact_match` (`draw` hoặc `null`),
`overlap_histogram` với `match_0`...`match_5`/`match_6`,
`similar_draws` paginated (mỗi item có `draw` và `overlap_count`),
`number_analysis` và `pair_analysis` cho candidate theo analysis window.
Exact/overlap/similar dùng **toàn lịch sử tới cutoff**; context
`actual_draw_count` mô tả window cho number/pair. Thêm
`history_draw_count` trong response để nêu denominator của histogram.

Ví dụ fixture Lotto trong analytics: checker `01 02 03 04 05` có
`exact_match_count=1`, `match_2=2`, `match_5=1`; Lotto special khác không
đổi kết quả. No match trả `exact_match_count=0`, `last_exact_match=null`.

## Generator

Contract backend này được giữ nguyên cho cả ba game. Frontend `/generator`
dùng [lồng cầu cục bộ](DRAW_SIMULATION.md), không gọi endpoint này để chọn số.

`POST /games/{game}/combinations/generate` body:

```json
{
  "analysis_window":{"kind":"last_draws","count":30},
  "requested_count":5,
  "seed":1234,
  "reference_date":"2026-10-01",
  "rules":{"max_overlap_previous_draw":{"max":3},"odd_even_ratio":{"odd":2,"even":3}}
}
```

`as_of_draw_id` tùy chọn như checker. `requested_count` 1–20; `seed` là
integer 0..2^63−1 hoặc omitted (server tạo seed và trả lại). `reference_date`
optional, default server local date chụp một lần; không được trước ngày cutoff.
Rule vắng mặt là tắt;
không dùng `enabled:false` có value mâu thuẫn. Rule IDs/thresholds xem
[ANALYTICS.md](ANALYTICS.md).

Response: `context`, `reference_date`, `algorithm_version`, `seed` thực dùng,
`requested_count`, `generated_count`, `attempted_count`, `status` là `complete`
hoặc `partial`, `reason` là `null` hoặc `search_limit`, và `items`. Mỗi item
có `main_numbers`, `explanation:{number_frequency,current_gaps,
historical_pairs,exact_match_within_days,maximum_recent_overlap,
rule_results:[{rule_id,threshold,observed,passed}]}`. Những field không áp
dụng do rule tắt có thể `null`, nhưng explanation vẫn nêu window/cutoff trong
`context`. `maximum_recent_overlap` dùng các draw trong analysis window,
khác rule `max_overlap_previous_draw` chỉ dùng một draw; nếu window rỗng trả
`null`. Không trả score hay nhãn khuyến nghị.

Không tìm đủ kết quả trong giới hạn thử → 200 `partial`, không trả duplicate
hoặc nới rule. Không có dữ liệu cho previous/pair/bottom-frequency rule đã
bật → 409 `insufficient_history`. Rule bất khả thi theo config → 422
`invalid_rules`. Cùng dữ liệu/version, window, cutoff, reference date, seed
và algorithm version phải tái lập cùng output.
