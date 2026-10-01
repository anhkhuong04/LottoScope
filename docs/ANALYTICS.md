# Analytics và generator contract

Game/identity/time do [DOMAIN.md](DOMAIN.md) định nghĩa. Các công thức dưới
đây áp dụng cho main numbers; special được loại khỏi toàn bộ phép tính.
`W` là danh sách draw cùng game, theo thứ tự thời gian từ cũ đến mới, sau
cutoff. Cùng `W` và tham số phải cho cùng kết quả, kể cả thứ tự khi hòa.

## Analysis window

- `last_draws`: lấy tối đa `count` draw cuối; `count` thuộc 10, 20, 30, 50,
  100. Nếu lịch sử ngắn hơn, dùng tất cả hiện có và trả `actual_draw_count`.
- `date_range`: dùng cả `from_date` và `to_date`, lấy hai đầu inclusive, sau
  khi áp cutoff. Date range không giới hạn độ dài ở core; API có resource limit.
- `all_time`: toàn bộ draw đến cutoff. UI mặc định gửi `last_draws=30`; core
  không có window ngầm định.
- Nếu `W` rỗng, counts bằng 0, percentages/gaps/last-seen bằng `null`; không
  tạo draw giả. Response luôn nêu requested window, `actual_draw_count`, cutoff.

## Frequency và ranking

- `frequency(n,W)`: số draw trong `W` có main number `n`, kể cả số không
  xuất hiện thì count 0. `frequency_percent = 100 * count / |W|`, `null` khi
  `|W|=0`. Đây là phần trăm **kỳ quay**, không là xác suất kỳ tiếp theo.
- Sort nhiều→ít: count giảm, number tăng để tie ổn định. Sort ít→nhiều:
  count tăng, number tăng. Rank cùng count là cùng rank theo dense ranking;
  API trả count và rank. UI `Most/Least frequent` lấy số đầu theo sort này.
  MVP không tạo ngưỡng Hot/Cold riêng hoặc score dự đoán.

## Gap/recency

Đánh index `W` từ 0 đến `m-1`. Với mỗi số/pair, positions xuất hiện là
`p1 < ... < pk`:

- `current_gap = m-1-pk` nếu `k>0`, khác `null` nếu chưa thấy trong `W`.
  Xuất hiện ở draw mới nhất có gap 0.
- Khoảng giữa hai lần xuất hiện liên tiếp là `p(i+1)-p(i)-1` kỳ **không có**
  số/pair. `average_gap` là trung bình cộng các khoảng này; `max_gap` là lớn
  nhất. Cả hai `null` khi có dưới 2 lần xuất hiện.
- Không tính khoảng từ đầu window đến lần đầu, hay từ lần cuối đến cuối
  window vào average/max: chúng bị cắt bởi window. `last_seen_draw` là ID
  của `pk` hoặc `null`. Pair gap dùng cùng công thức trên các draw có cả pair.
- Gap chỉ tính theo số **kỳ**, không theo ngày. `null` khác gap 0 và khác
  "chưa từng xuất hiện toàn lịch sử"; UI cần nêu rõ phạm vi window.

## Pair, exact match và overlap

- Pair count: số draw trong `W` chứa cả hai main, mỗi draw cộng 1; pair
  `(a,b)` được chuẩn hóa `(min,max)`. Pair percent cũng là `100*count/|W|`,
  `null` khi `W` rỗng. Top pairs sort count giảm, rồi `a`, `b` tăng.
- `overlap(candidate, draw) = |candidate.main ∩ draw.main|`. Histogram
  `match_k` đếm **đúng k**, không phải ít nhất k. Checker trả 0..main_count;
  UI có thể chỉ hiển thị bucket 2..main_count. Similar draws mặc định là
  overlap ≥2, sort overlap giảm rồi chronological key giảm, có paging.
- Exact match main-only = overlap bằng main_count. `exact_match_count` và
  `last_exact_match` dùng toàn lịch sử của game đến cutoff, không chỉ analysis
  window; histogram/similar draws cũng dùng toàn lịch sử đến cutoff.
  Per-number/pair context của checker dùng analysis window được yêu cầu.

### Fixture tính tay (hoàn toàn giả lập)

Ba draw của mỗi game xếp từ cũ đến mới; Lotto L1/L2 cùng ngày, L3 hôm sau.
ID `90001`–`90003` thuộc **fixture giả lập**, không phải kết quả Vietlott thật.

| Game/draw | ID | Date | Main | Special |
| --- | --- | --- | --- | --- |
| Lotto L1 | 90001 | 2099-01-01 | 01 02 03 04 05 | 01 |
| Lotto L2 | 90002 | 2099-01-01 | 01 02 06 07 08 | 02 |
| Lotto L3 | 90003 | 2099-01-02 | 02 03 09 10 11 | 03 |
| Mega M1 | 90001 | 2099-01-01 | 01 02 03 04 05 06 | — |
| Mega M2 | 90002 | 2099-01-02 | 01 02 07 08 09 10 | — |
| Mega M3 | 90003 | 2099-01-03 | 02 03 11 12 13 14 | — |

Với window gồm cả 3 draw của từng game: số 02 có count 3, percent 100%,
current gap 0, average/max gap 0. Số 01 có count 2, percent 66.67%, current
gap 1, average/max gap 0. Số 03 có positions 0 và 2, average/max gap 1.
Số 04 có current gap 2, average/max `null`; số 35 (Lotto) và 45 (Mega)
count 0, current gap `null`. Pair (01,02) có count 2, percent 66.67%,
current gap 1. Lotto candidate `01 02 03 04 05` exact match 1 lần, overlap
histogram: `match_2=2`, `match_5=1`. Mega candidate `01 02 03 04 05 06`
cho `match_2=2`, `match_6=1`. Special `01` của L1 không làm count main 01 tăng.

## Generator MVP

Tạo main combinations theo game, không sinh special. Rule **chỉ áp dụng khi
được bật**, không có default ẩn. Rules và metric dùng cùng implementation
semantic với checker/analytics. `analysis_window` chỉ cấp dataset cho rule
frequency/pair/bottom-frequency và explanation; exact-within-days dùng toàn
lịch sử tới cutoff; previous draw là draw cuối trước/đến cutoff.

| Rule ID | Điều kiện để candidate qua |
| --- | --- |
| `exclude_exact_within_days` | Không có main-only exact match trong `days` ngày lịch inclusive kết thúc tại `reference_date`; `days>=1` |
| `max_overlap_previous_draw` | Overlap với đúng 1 draw mới nhất `<= max`, `max` từ 0 đến main_count |
| `minimum_historical_pair_frequency` | **Ít nhất một** pair của candidate có pair count trong analysis window `>= min_count`, `min_count>=1` |
| `exclude_bottom_frequency_numbers` | Candidate không chứa bất cứ số nào trong `n` số có frequency thấp nhất; tie chọn number tăng; `n` từ 0 đến max_main-main_count |
| `odd_even_ratio` | Số odd/even đúng `[odd,even]`, hai giá trị không âm và tổng bằng main_count |
| `sum_range` | Tổng main trong khoảng `[min,max]` inclusive, min ≤ max và giao được miền tổng có thể tạo |

`exclude_exact_within_days` lấy `draw_date >= reference_date-days+1` và
`<= reference_date`, sau cutoff. `reference_date` không được trước ngày cutoff.
Nếu bật previous/pair/bottom-frequency rule khi dataset cần thiết rỗng, API
trả `insufficient_history`; rule không tự bỏ qua. Cấu hình mâu thuẫn/ngoài
range là lỗi input. Rule exact days với lịch sử rỗng qua theo logic "không có
exact match" và explanation phải nêu không có kỳ nào được xét.

Generator trả tối đa 20 combinations/request, không duplicate. Thuật toán
thử candidate hữu hạn: tối đa `min(20000, max(1000, 1000*requested_count))`
attempts, trả `complete` hoặc `partial` cùng `attempted_count` và reason
`search_limit` nếu thiếu. Không tự nới rule. Seed tùy chọn áp RNG cục bộ;
reproduce cần cùng data snapshot/version, game, cutoff, window, rules,
reference date, seed và algorithm version. Explanation có observed values,
threshold, rule IDs, dataset context; các số count/gap/pair lấy cùng W.
