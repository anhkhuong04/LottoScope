# Kế hoạch thực hiện MVP — Vietlott Analytics

Trạng thái: P0–P1 hoàn tất ngày 01/10/2026; P2–P8 chưa thực hiện. Chỉ đánh dấu
`[x]` khi có sản phẩm bàn giao và bằng chứng kiểm chứng tương ứng.

Nguồn: [PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) (đặc biệt mục 4–11,
15–17), [wireframe.md](docs/wireframe.md) (mục 3–14, 19–33) và
[quy tắc agent](AGENTS.md). Các câu hỏi nghiệp vụ cần chốt được liệt kê trong
[PROJECT_ANALYSIS.md](.agent/PROJECT_ANALYSIS.md), Q01–Q10. Khi tài liệu/contract
được quyết định, cập nhật checklist này và các quy tắc `.agent` chịu ảnh hưởng.

## Cách dùng và ranh giới MVP

- Mỗi mã task có phạm vi, sản phẩm và điều kiện kiểm chứng ngay trong mô tả.
  Có thể triển khai các task độc lập song song, nhưng không vượt qua dependency
  ghi ở đầu từng giai đoạn.
- **MVP backend** theo overview: thu thập, lưu trữ, truy vấn, analytics, checker,
  generator và explanation; không bao gồm frontend implementation.
- **MVP frontend** theo wireframe là luồng riêng: shell và 8 màn hình chức năng
  cùng trải nghiệm desktop/mobile, kết nối API thực. Nếu mục tiêu bàn giao là
  ứng dụng có giao diện, hoàn tất cả hai luồng. `P0-01` chốt mốc nào cần nghiệm
  thu trước; không đánh dấu MVP tổng thể chỉ vì hoàn tất một luồng.
- Strategy management, backtesting, random baseline, saved picks, triplets,
  export, notifications, thêm game, ML/prediction, mobile native, auth nhiều
  người dùng, payment và ROI/profit tracking không thuộc checklist MVP.
  Định nghĩa ranh giới thời gian/cutoff trong MVP để không cản trở Phase 2.
- Mọi task code tuân thủ [WORKFLOW.md](.agent/WORKFLOW.md): test có expected
  result độc lập, không dùng dữ liệu giả thay kết quả thật, báo đúng check đã
  chạy. Ví dụ trong docs không tự động thành default hay dữ liệu production.

## P0 — Chốt hợp đồng sản phẩm và nghiệp vụ

**Điều kiện vào:** hai tài liệu nguồn đã có. **Điều kiện ra:** những khái niệm
ảnh hưởng trực tiếp đến MVP được định nghĩa bằng văn bản, ví dụ và acceptance.
Các contract P0 ở `docs/` là nguồn quyết định; các giả định về nguồn ngoài
phải được kiểm tra lại khi triển khai P3.

- [x] **P0-01 — Chốt phạm vi bàn giao.** Tạo `docs/MVP.md`: mốc backend MVP,
  mốc frontend MVP, thứ tự ưu tiên, danh sách use case bắt buộc và tiêu chí
  nghiệm thu riêng; giải quyết Q01 mà không sửa ngầm ý nghĩa hai tài liệu gốc.
- [x] **P0-02 — Chốt domain và thời gian kỳ quay.** Tạo `docs/DOMAIN.md` cho
  Lotto 5/35, Mega 6/45, draw/combination identity, main/special, `draw_id`,
  timezone, thiếu `draw_time`, thứ tự kỳ quay/tie-break và date boundary;
  có ví dụ nhiều kỳ cùng ngày và input không hợp lệ (Q03, Q06).
- [x] **P0-03 — Chốt metric và cửa sổ phân tích.** Tạo `docs/ANALYTICS.md`:
  last-N/date range/all-time, trường hợp thiếu N kỳ/empty, frequency %, gap
  current/average/max/never-seen/window clipping, pair frequency/gap nếu dùng,
  Hot/Cold ranking, exact match/overlap buckets; có fixture nhỏ và kết quả
  tính tay cho cả hai game (Q04–Q06).
- [x] **P0-04 — Chốt rule generator.** Ghi trong `docs/ANALYTICS.md` hoặc spec
  riêng: ý nghĩa từng rule MVP, phạm vi dữ liệu, previous draw/recent overlap,
  điều kiện minimum pair, tie-break bottom frequency, N ngày/reference time,
  cấu hình mâu thuẫn, seed, giới hạn attempts và kết quả thiếu quota (Q07).
- [x] **P0-05 — Chốt nguồn và luồng dữ liệu.** Tạo `docs/DATA_PIPELINE.md`:
  nguồn lịch sử/kỳ mới cho từng game, lịch collector, timeout/retry, cách nhận
  biết thiếu kỳ, provenance, parse lỗi, duplicate/correction, transaction và
  scheduler ownership; ghi bằng chứng khả năng truy cập nguồn (Q02, Q10).
- [x] **P0-06 — Chốt schema/kiến trúc.** Tạo `docs/DATA_MODEL.md` và
  `docs/ARCHITECTURE.md`: representation draw/numbers/source, constraints,
  indexes, session/transaction, module boundaries, migration, deploy/backup;
  version Python và dependency/tooling đã chọn; ADR cho quyết định dài hạn
  (Q09–Q10).
- [x] **P0-07 — Chốt HTTP contract.** Tạo `docs/API.md`: game identifiers,
  window/as-of/actual draw count, endpoints, request/response, paging/sort,
  timezone, empty/null, errors/status, generator limits, explanation và ví dụ
  cho checker/analytics/history; đối chiếu tất cả dữ liệu wireframe cần (Q08).
- [x] **P0-08 — Rà soát chéo tài liệu.** Kiểm tra domain → architecture →
  feature/API → wireframe không mâu thuẫn; cập nhật `.agent` khi quyết định
  mới thay quy tắc; lưu quyết định lớn trong `docs/DECISIONS/`.

## P1 — Khởi tạo repository và nền tảng chạy được

**Phụ thuộc:** P0-01, P0-02, P0-06; P0-07 trước endpoint. **Điều kiện ra:**
backend rỗng có cấu hình, test, migration và môi trường PostgreSQL hoạt động.

- [x] **P1-01 — Thiết lập quản lý mã nguồn.** Khởi tạo Git nếu chưa có,
  `.gitignore` cho Python, frontend/tool caches, build artifacts, `.env` và
  credentials; kiểm tra docs/quy tắc hiện có được giữ nguyên.
- [x] **P1-02 — Bootstrap backend.** Tạo `backend/` theo modular monolith,
  `pyproject.toml`, `uv.lock`, package/app entry point, typed settings từ
  environment và `.env.example` không có secret thật.
- [x] **P1-03 — Thiết lập quality gates.** Cấu hình Ruff, Pyright, pytest và
  CI chạy lệnh trong `.agent/WORKFLOW.md` với lockfile; có smoke test chứng
  minh import/app startup và các lệnh lint/format/type/test chạy được.
- [x] **P1-04 — Thiết lập PostgreSQL/Alembic.** Cấu hình DB session lifecycle,
  Alembic và migration baseline; kiểm tra upgrade trên PostgreSQL trống,
  không dùng `create_all()` thay migration production.
- [x] **P1-05 — Thiết lập Docker Compose tối thiểu.** Backend + postgres,
  persistent volume, health/readiness, env/config rõ; xác nhận backend khởi
  động và kết nối DB sau migration bằng Compose.
- [x] **P1-06 — Viết hướng dẫn chạy dự án.** README gốc hướng dẫn install,
  config, migration, test và chạy API bằng lệnh thực tế; nêu rõ import/jobs
  sẽ có ở P3, frontend tooling ở P7, không bịa lệnh chưa tồn tại.

Kiểm chứng P1 (01/10/2026): `uv sync --locked`, Ruff check/format, Pyright
(0 lỗi), pytest (1 passed); `docker compose config --quiet`, build backend,
Alembic `upgrade head`/`current` trên PostgreSQL 16, Compose healthy và
`/health/live`, `/health/ready` đều trả `ok`. Sau restart PostgreSQL,
`0001_baseline` vẫn là head và hai services healthy. Pytest có một warning
deprecation từ Starlette TestClient/httpx; test vẫn pass.

## P2 — Domain model và lưu trữ kết quả đúng

**Phụ thuộc:** P0-02, P0-06, P1-02, P1-04. **Điều kiện ra:** draw hợp lệ được
persist, truy vấn theo identity/thời gian và giữ bất biến trong DB.

- [x] **P2-01 — Game definitions tập trung.** Implement count/range/special
  rules cho Lotto 5/35 và Mega 6/45; API không dùng game không nhận diện;
  test invalid game và rule riêng của từng game.
- [x] **P2-02 — Normalize/validate domain.** Draw và combination main numbers
  canonical tăng dần, pair canonical, duplicate/range/count/type lỗi bị từ
  chối rõ; main và special độc lập; test permutations và invalid inputs.
- [x] **P2-03 — Schema + migration draw/source.** Tạo tables/constraints/index
  theo `DATA_MODEL.md`, unique `(game, draw_id)`, provenance, timestamps và
  chronological key; test PostgreSQL unique/rollback và upgrade migration.
- [x] **P2-04 — Repository draw.** Insert/query theo game+draw ID, date range,
  latest N và pagination/sort ổn định; test same-day ordering, game isolation,
  less-than-N, empty và tham số filter sai.
- [x] **P2-05 — Policy correction.** Implement hành vi đã chốt cho cùng
  identity nhưng content khác, audit/provenance và transaction; test không
  âm thầm overwrite hoặc báo success sai.

Kiểm chứng P2 (01/10/2026): Ruff check/format, Pyright (0 lỗi), pytest trên
PostgreSQL 16 riêng (24 passed); migration `0002` upgrade/downgrade/upgrade,
`alembic check` khớp metadata; DB unique/check, rollback, concurrent insert,
ordering và correction audit được test. Compose build và `/health/ready` trả `ok`.
Pytest còn warning deprecation từ Starlette TestClient/httpx.

## P3 — Import lịch sử và tự động thu thập kỳ mới

**Phụ thuộc:** P0-05, P2. **Điều kiện ra:** DB có lịch sử có nguồn rõ, chạy
import/collector lặp hoặc song song không tạo duplicate hay làm sai dữ liệu.

- [x] **P3-01 — Source adapters và fixtures.** Implement fetcher/parser riêng
  cho từng nguồn được chọn, lưu fixtures ổn định; test format hợp lệ, thiếu
  field, format thay đổi và lỗi nguồn mà không phụ thuộc live website.
- [x] **P3-02 — Pipeline ingestion.** Ghép fetch → parse → validate → normalize
  → persist; reject dữ liệu lỗi với context game/source/draw; test parse lỗi
  không bị xem là tập kết quả rỗng thành công.
- [x] **P3-03 — Historical import.** Command/job backfill có phạm vi game/date,
  transaction/resume policy và thống kê inserted/skipped/failed; đối chiếu
  mẫu với nguồn và số kỳ lưu trong DB.
- [x] **P3-04 — Idempotency/concurrency.** Dựa trên DB constraint và conflict
  handling; test chạy lại cùng batch, duplicate trong batch, concurrent job
  và same identity/different content theo policy.
- [x] **P3-05 — Retry/failure handling.** Timeout, bounded retry/backoff cho
  lỗi transient; parse/validation error không retry mù; job báo lỗi và giữ
  dữ liệu đã lưu theo transaction policy. Test các nhánh failure.
- [x] **P3-06 — Scheduled collection.** APScheduler hoặc cơ chế giai đoạn
  đầu đã chốt gọi cùng ingestion use case; tránh job overlap/multi-worker
  duplicate; test hoặc smoke test một kỳ chạy và trạng thái last success/fail.
- [x] **P3-07 — Kiểm tra dữ liệu nhập.** So sánh identity/count/sample draws
  cho cả hai game với nguồn chính thức, xác nhận main/special, provenance,
  thứ tự kỳ và không có lỗ hổng import không được báo cáo.

Kiểm chứng P3 (01/10/2026): Ruff check/format, Pyright (0 lỗi), 49 pytest pass
trên PostgreSQL 16; migration `0003` upgrade/downgrade/upgrade giữ draw P2,
`alembic check` khớp metadata; Compose build/readiness và scheduler startup đạt.
Backfill và resume thành công các kỳ timeout. Audit với nguồn chính thức xác nhận
Lotto 5/35 `919/919` (latest `00919`, 01/10/2026) và Mega 6/45 `1569/1569`
(latest `01569`, 30/09/2026); mỗi game có 8 kỳ mẫu khớp ID/ngày/main/special,
không có ID chưa quét, lỗi, provenance sai hoặc thứ tự ngày sai.

## P4 — History và analytics core

**Phụ thuộc:** P0-03, P2; P3 cung cấp dữ liệu tích hợp. **Điều kiện ra:** các
metric trả đúng theo cùng game/window và có tests với expected values tính tay.

- [x] **P4-01 — Analysis window service.** Select last 10/20/30/50/100,
  date range và all-time theo game/cutoff; trả requested window, actual draw
  count và as-of. Test endpoints thời gian, same-day, empty, thiếu N kỳ.
- [x] **P4-02 — Draw history use case.** Query latest draw, ID, date range,
  page/sort và draws chứa combination/main number/pair theo contract; test
  stable order, filtering và paging trên PostgreSQL.
- [x] **P4-03 — Number frequency.** Count cho toàn miền main (kể cả count 0),
  percentage/ranking theo formula đã chốt; test cả hai game, boundary window,
  denominator, ties và special không tham gia.
- [x] **P4-04 — Number gap/recency.** `current_gap`, `average_gap`, `max_gap`,
  `last_seen_draw` theo formula đã chốt; test latest appearance gap 0,
  never-seen, window clipping, same-day và game isolation.
- [x] **P4-05 — Pair analysis.** Canonical pair frequency, top pairs,
  `% of draws`, last seen và draws containing pair; pair gap nếu đã chốt cho
  màn Pair Detail. Test mỗi pair một lần/draw, ties, empty và special isolation.
- [x] **P4-06 — Number/pair details.** Timeline, recent draws containing
  number/pair và frequent partners với pagination/limits; đảm bảo cùng
  dataset/window với metric summary, test trên fixture rõ.
- [x] **P4-07 — Analytics consistency.** Với cùng dataset/parameters/cutoff,
  result và tie ordering giống nhau; sau ingestion/correction dữ liệu không
  cũ sai do cache (nếu có). Test chéo các use case chung window.

Kiểm chứng P4 (01/10/2026): 55 pytest pass trên PostgreSQL 16, Ruff và Pyright
đạt. Fixture tính tay cho cả hai game xác nhận window/cutoff, main-only metrics,
gap/pair, stable sort/paging, detail và cập nhật ngay sau correction. Smoke test
trên DB lịch sử: Lotto 919 draw/35 số/595 pair, Mega 1569 draw/45 số/990 pair;
window 30 kỳ và detail query thành công. HTTP endpoints thuộc P6.

## P5 — Combination checker và generator có giải thích

**Phụ thuộc:** P0-04, P4. **Điều kiện ra:** combination hợp lệ được kiểm tra
và sinh theo rule minh bạch, không vòng lặp vô hạn hoặc score suy đoán.

- [x] **P5-01 — Checker input contract.** Main numbers đúng count/range,
  canonical trước compare; optional special/full-ticket chỉ làm khi mode và
  identity đã được chốt. Test reorder, duplicate, invalid type và hai game.
- [x] **P5-02 — Exact match.** Count và last exact match theo identity/search
  range đã chốt, bao gồm no-match hợp lệ; test permutation, history trùng ở
  nhiều kỳ và special behavior theo mode.
- [x] **P5-03 — Historical overlap.** Tính số phần tử giao main, buckets theo
  contract, similar/recent draws có stable sort/paging; test 0..5/0..6,
  exact bucket và special không ảnh hưởng.
- [x] **P5-04 — Checker analytics.** Đưa frequency/gap/pair context theo
  window vào result có metadata; kiểm tra checker không tính metric khác
  analytics core trên cùng dataset.
- [x] **P5-05 — Rule engine.** Typed rule config, enabled/disabled và validate
  threshold/contradiction; implement từng rule MVP trong docs theo cùng
  semantic analytics/checker; test pass/fail và boundary từng rule.
- [x] **P5-06 — Generator.** Candidate hợp lệ/canonical, optional local seed,
  unique outputs, bounded attempts/work và số kết quả yêu cầu có giới hạn;
  test reproducibility cùng data/config/seed/time và rule set không khả thi.
- [x] **P5-07 — Structured explanation.** Mỗi result ghi rule/threshold/value,
  frequency/pairs/exact-match/recent-overlap liên quan, window/as-of và trạng
  thái partial/no-result; test explanation khớp chính kết quả lọc.

Kiểm chứng P5 (01/10/2026): checker và generator dùng cùng snapshot window,
main-only identity; tests PostgreSQL xác nhận exact/overlap, rule pass/fail ở
từng ngưỡng, seed tái lập, no-result/partial và giới hạn 1000–20000 attempts.

## P6 — HTTP API và tích hợp backend

**Phụ thuộc:** P0-07 và services P2–P5 tương ứng. **Điều kiện ra:** mọi use
case MVP backend gọi được qua FastAPI với schema/error/limits đã thống nhất.

- [x] **P6-01 — API shell.** FastAPI app, dependency injection cho session/
  service, typed schemas, error mapping và OpenAPI; route không chứa SQL,
  parsing nguồn hoặc thuật toán analytics.
- [x] **P6-02 — History endpoints.** Latest draw, danh sách/detail theo ID,
  date range, paging/sort và data freshness; test contract, game isolation,
  invalid filters, no-data và stable ordering.
- [x] **P6-03 — Analytics endpoints.** Frequency, gap, pairs, number detail,
  pair detail theo window; trả as-of/actual draw count và pagination cần
  thiết. Test dữ liệu API với core fixture cho cả hai game.
- [x] **P6-04 — Checker endpoint.** Validate server-side, exact/overlap/
  similar draws/number-pair context; test response/no match/errors và limits.
- [x] **P6-05 — Generator endpoint.** Typed rules, requested count/seed,
  explanation và partial/no-result; test invalid/contradictory input, bounded
  failure, reproducibility và response size limit.
- [x] **P6-06 — Cross-layer integration.** Từ fixture nguồn → ingest vào
  PostgreSQL → query API: kiểm tra lịch sử, frequency/gap/pairs, checker,
  generator và freshness cùng game/window; không lấy mock thay DB ở test này.
- [x] **P6-07 — API reliability.** Không lộ traceback/secret, không trả 200
  cho job/source failure, date/time serialize nhất quán và analytics CPU
  không chặn event loop theo mô hình đã chọn; kiểm tra cases liên quan.

Kiểm chứng P6 (01/10/2026): 72 pytest pass trên PostgreSQL 16, Ruff/Pyright
đạt; fixture HTML nguồn → ingestion → DB → API xác nhận cả hai game, window,
freshness, checker và generator. Test lỗi 404/409/422/500, không lộ secret và
timestamp UTC `Z`. Routes đồng bộ chạy trong FastAPI threadpool. Compose
config/build/readiness và smoke test API trên DB lịch sử đạt. MVP không có
endpoint trigger ingestion; collector failure được lưu trong status.

## P7 — Frontend MVP (luồng riêng theo wireframe)

**Phụ thuộc:** P0-01, P0-07; từng màn hình cần API P6 tương ứng. **Điều kiện
ra:** 15 acceptance criteria ở wireframe mục 33 được kiểm tra trên desktop và
mobile với dữ liệu API thật. Frontend stack chốt ở ADR 0002.

- [x] **P7-01 — Chọn và bootstrap frontend.** Ghi ADR cho framework/runtime,
  build/test tooling và cách gọi API; tạo app, lockfile, lint/type/build/test
  commands và cập nhật README/CI. Không xem một library cụ thể là đã chốt.
- [x] **P7-02 — Application shell/navigation.** `/` → `/dashboard`, desktop
  sidebar/top bar, mobile bottom nav/More, game selector toàn app; active
  navigation và keyboard focus rõ.
- [x] **P7-03 — Shared context/components.** Window selector (UI default 30),
  URL state cho filters/page/sort, API state key theo game/window, number ball,
  metric card, table và loading/empty/error; game switch reset input không
  hợp lệ và bỏ late response của game cũ.
- [x] **P7-04 — Dashboard.** Latest draw, tối đa 4 summary cards, frequency
  chart/grid, top pairs, highest gaps, recent draws, freshness; link drill-down
  hoạt động, mobile layout đọc được.
- [x] **P7-05 — History và draw detail.** Date/draw-ID filters, paging, sort,
  main/special/source/time rõ; desktop table, mobile cards/detail view;
  empty/error/retry đúng context.
- [x] **P7-06 — Numbers và number detail.** Grid/table/chart frequency/gap,
  sort; number detail có metrics, timeline, partners, recent draws; dữ liệu
  cùng game/window và chart có textual summary.
- [x] **P7-07 — Pairs và pair detail.** Minimum frequency/sort, count/%/last
  seen, pair detail/timeline/draws; stable deep links, paging và empty state.
- [x] **P7-08 — Checker.** Number picker/token input, client validation cho
  hai game; exact match → overlap → similar draws → per-number → pairs;
  no historical match hiện là kết quả bình thường.
- [x] **P7-09 — Generator.** Rule toggle/value/help, count và seed nếu API
  hỗ trợ, results với structured explanation; desktop drawer/mobile full
  screen, partial/no-result rõ, không gắn nhãn best/prediction.
- [x] **P7-10 — States và UX test.** Từng section có loading, no-data,
  network/server/invalid/stale/retry; refresh lỗi giữ dữ liệu cũ đúng context,
  đổi game không hiện nhầm dữ liệu. Test các flow A–D wireframe mục 31.
- [x] **P7-11 — Responsive/accessibility test.** Kiểm tra ≥1024px,
  768–1023px, <768px; primary flow mobile không ngang trang, touch target
  ≥44px, keyboard/form labels/focus/contrast/chart fallback; sửa lỗi phát hiện.

Kiểm chứng P7 (01/10/2026): `npm ci`, lint không warning, Prettier, TypeScript,
4 unit tests và Vite build đạt. Playwright với API/PostgreSQL địa phương đã nhập
lịch sử cả hai game: 29 pass, 4 skip theo thiết bị; flow A–D, deep links,
error/empty/invalid/stale/retry, breakpoint 320–1365px và quét axe WCAG A/AA
trên 9 routes desktop/tablet/mobile đạt. CI frontend chạy gates độc lập;
browser smoke cần backend có lịch sử như README.

## P8 — Hoàn thiện, triển khai thử và nghiệm thu

Bằng chứng chạy thật và đối chiếu từng tiêu chí: [docs/MVP_ACCEPTANCE.md](docs/MVP_ACCEPTANCE.md).
Lệnh vận hành: [README.md](README.md).

**Phụ thuộc:** P2–P6 cho mốc backend; thêm P7 cho mốc có giao diện. **Điều kiện
ra:** hệ thống có thể cài đặt lại, nhập dữ liệu, tự cập nhật và kiểm tra các
luồng theo acceptance với bằng chứng lưu lại.

- [x] **P8-01 — Chạy toàn bộ backend gates.** `uv sync --locked`, Ruff check/
  format, Pyright, pytest; PostgreSQL integration/migration tests pass;
  ghi lệnh, kết quả và môi trường thực tế. Không thay PostgreSQL bằng SQLite.
- [x] **P8-02 — Chạy frontend gates nếu P7 trong milestone.** Install theo
  lockfile, lint/type/test/build và browser checks cho các flow chính trên
  desktop/mobile; ghi lỗi còn lại và kết quả sửa.
- [x] **P8-03 — Kiểm tra migration/deploy trên môi trường sạch.** Compose
  config/build/up, DB volume tồn tại sau restart, migration upgrade, readiness
  và app phục vụ request; hướng dẫn rollback/giới hạn rollback.
- [x] **P8-04 — Kiểm tra backup/restore.** Backup PostgreSQL, restore vào DB
  khác, đối chiếu draw count, identity/sample và API query sau restore; ghi
  lệnh vận hành trong README/architecture.
- [x] **P8-05 — Smoke test end-to-end dữ liệu thực.** Import history hai game,
  chạy collector lặp, đối chiếu kỳ mới/source, truy vấn history/analytics/
  checker/generator; ghi source, thời điểm và hạn chế nếu source không sẵn.
- [x] **P8-06 — Kiểm tra phi chức năng mức MVP.** Paging/limits trên dataset
  lịch sử, queries/indexes chủ đạo, failure/retry và scheduler một instance;
  sửa bottleneck hoặc lỗi correctness được quan sát, không tối ưu suy đoán.
- [x] **P8-07 — Nghiệm thu backend.** Đánh dấu từng mục overview mục 15 bằng
  evidence: hai game đúng, update tự động, history, frequency, gap, pairs,
  checker, generator/explanation, automated tests, Compose và khả năng mở
  rộng game/analytics mà không sửa core rải rác.
- [x] **P8-08 — Nghiệm thu frontend nếu P7 trong milestone.** Đánh dấu từng
  mục wireframe mục 33 bằng màn hình/flow/test cụ thể; kiểm tra wording không
  gây hiểu là dự đoán và các trạng thái loading/empty/error.
- [x] **P8-09 — Bàn giao.** README và tài liệu phản ánh implementation,
  danh sách ADR/migration, các vấn đề còn mở, kết quả gates, hướng dẫn vận hành
  import/collector/backup/restore và phạm vi Phase 2 để triển khai tiếp.

## Bổ sung sau MVP — Giải thưởng kỳ quay (07/10/2026)

Thiết kế: [ADR 0005](docs/DECISIONS/0005-draw-prizes.md). Thực hiện lần lượt,
viết test thất bại trước code và tạo commit sau khi cả nhóm được kiểm chứng.

- [x] **PRIZE-01 — Parser và snapshot.** Fixture `535_00922_prizes.html`,
  `645_01570_prizes.html`; domain `PrizeTier`/`PrizeMatch`; parser trong
  `ingestion/prizes.py`, gọi từ `parse_result`. Test đúng 7/4 hạng, số 0,
  khuyến khích ba điều kiện, malformed/duplicate/wrong game; không ảnh hưởng
  canonical result hash. `uv run --locked pytest tests/test_draw_prizes.py`.
- [x] **PRIZE-02 — Persistence và API.** Migration `0004_draw_prizes`,
  model/repository enrich lần đầu, revision correction, counter `enriched`;
  service `DrawPrizeService.get(game, draw_id)` và endpoint `/prizes` với tiền
  chuỗi VND. PostgreSQL tests: giữ draw/hash/version cũ sau migration, enrich
  một lần, không xóa khi nguồn thiếu bảng, conflict/apply audit, không gọi nguồn
  khi snapshot có; 404/409/503 và kỳ cũ bổ sung đúng ID. Cập nhật domain/schema/
  pipeline/API docs ở nguồn tương ứng. Ruff check/format, Pyright, toàn pytest.
- [x] **PRIZE-03 — Giao diện và vận hành.** `DrawPrizes` trong chi tiết kỳ,
  tải độc lập, bảng 4 cột/nhấn mạnh giải cao nhất, VND chính xác, mobile cards;
  test cả game, 0/empty/error/retry và đổi context. Chạy lint/format/typecheck/
  build/unit/E2E frontend; backup, migration và rebuild Compose local, đối
  chiếu nguồn/database/API, kiểm tra enrichment chạy lặp, commit nhóm PRIZE.

## Bổ sung sau MVP — Power 6/55 (14/10/2026)

Thiết kế: [ADR 0006](docs/DECISIONS/0006-power-655.md). Triển khai lần lượt,
commit từng mốc sau kiểm chứng; nghiệm thu riêng với PostgreSQL và dữ liệu thật.

- [x] **POWER-01 — Contract.** Domain/main-only, source/lịch, schema/API/UX,
  ADR và consistency tài liệu đã rà; giữ nguyên bằng chứng MVP lịch sử.
- [x] **POWER-02 — Domain và migration.** Definition, special khác main,
  migration 0005, tests PostgreSQL/upgrade/downgrade và data preservation.
- [x] **POWER-03 — Ingestion và jobs.** Fixture nguồn, adapter Power, năm
  hạng giải, CLI registry, poll/reconcile/startup, idempotency/correction tests.
- [x] **POWER-04 — API/analytics/frontend.** Fixture tính tay, 55 numbers,
  1.485 pairs, checker/generator/main-only; hai Jackpot, game switch, E2E responsive.
- [ ] **POWER-05 — Vận hành/nghiệm thu.** Backup/restore, migration/build,
  full import/audit/repeat collectors, gates và source/DB/API/UI đối chiếu.
- [x] **POWER-06 — Import chỉ kết quả (24/10/2026).** CLI `--results-only`
  bỏ qua giải thưởng, giữ validation/snapshot cũ; 197 backend tests và gates
  đạt. Đã nhập thêm 16 kỳ chỉ kết quả, tổng 233/1.414. Nguồn lại challenge
  tại 00164; POWER-05 tiếp tục mở. Bằng chứng trong `POWER_ACCEPTANCE.md`.
- [x] **POWER-07 — Import file có ngày và rà soát thiếu (24/10/2026).**
  CLI offline validate toàn file, atomic/shared lock, idempotent, hash/nguồn
  rõ và giữ dữ liệu cũ. File nạp thêm 1.128 kỳ; tra cứu nguồn thêm 16 kỳ.
  Bảng bổ sung của người dùng nạp tiếp 37 kỳ `01362..01398` (run 477):
  **đủ 1.414/1.414 kỳ `00001..01414`, không còn ID thiếu trong dải này**.
  Đã đối chiếu cả 37 kết quả qua API và checksum dữ liệu cũ; chỉ nhập kết quả.
  Implementation trước đó đạt 208 backend tests và Ruff/Pyright/format;
  lượt bổ sung chỉ đổi dữ liệu/tài liệu, kiểm DB/API. POWER-05 vẫn mở cho
  full audit nguồn chính thức/hai collector; bằng chứng ở `POWER_ACCEPTANCE.md`.

POWER-02: `uv sync --locked`, Ruff lint/format, Pyright đạt; 136 pytest pass
trên PostgreSQL riêng `lotto_power_20261014_test` (10 deprecation warnings).
Upgrade DB trống/alembic check đạt; clone restore 2.518 draw giữ nguyên toàn
bộ row checksum ở sáu bảng sau migration. Chi tiết
[POWER_ACCEPTANCE.md](docs/POWER_ACCEPTANCE.md).

POWER-03: Ruff/Pyright/format và 151 backend tests pass trên PostgreSQL riêng;
Compose config đạt. Live httpx fetch/parse `00001`, `01385`, latest `01410`
khớp nguồn đủ năm hạng. Tests import/resume/collector lặp và prize correction
Power đạt; scheduler kiểm đủ ba game/startup cùng lịch thứ Ba/Năm/Bảy.

POWER-04: 156 backend tests và Ruff/Pyright/format pass; frontend lint/format/
typecheck/build và 4 unit tests pass. 15 ca Power E2E desktop/tablet/mobile đã
pass trên API clone (12 pass lượt đầu, ba ca checker pass sau sửa đồng bộ test
chờ picker game mới). Đã xem screenshot desktop/mobile; Axe detail không lỗi.

POWER-05 **chưa hoàn thành vì nguồn 429/Cloudflare**. Backup/restore, migration
ứng dụng, Compose build/readiness và runtime game/API/UI đã kiểm; 162 backend
tests pass, E2E Compose trực tiếp 56 pass/4 skip. Lượt đầu đã nhập 45 draw Power có
prizes (latest đã lưu `00048`, 18/11/2017), checkpoint `00071`, 26 failed;
upper bound đã đọc trước khi nguồn chặn là `01410` ngày 13/10/2026.
Audit đã chạy nhưng exit 1 do source 429; collector live cũng chưa đạt.
Cấu hình local giảm tốc 2 giây/request; giữ trạng thái failed và resume, không
coi dataset một phần là lịch sử đầy đủ. Bằng chứng/lệnh tiếp tục ở
[POWER_ACCEPTANCE.md](docs/POWER_ACCEPTANCE.md#power-05--phần-đã-kiểm-chứng-và-phần-bị-chặn).

Chạy lại POWER-05 lúc 08:16–08:21 ngày 14/10/2026: thêm 32 draw, tổng **77**
kỳ liên tục `00001`–`00077` (25/01/2018), đủ năm hạng giải; lấp hết 26 lỗi cũ.
Nguồn lại trả 429 từ `00078`; checkpoint `00101`, 24 failed, không còn run treo
hay correction pending. Schema/readiness đạt, **15 Power E2E passed** trực tiếp
trên Compose. Chưa chạy lại full audit/hai collector vì history còn thiếu;
POWER-05 tiếp tục mở. Chi tiết tại
[bằng chứng chạy lại](docs/POWER_ACCEPTANCE.md), mục “Chạy lại POWER-05”.

Tiếp tục lúc 08:39–08:40 ngày 14/10/2026: host và Compose đều HTTP 429 ngay
tại latest page dù giảm tốc xuống 5 giây/request (run `301`, `302`, exit 1).
Không thêm kỳ mới; PostgreSQL vẫn 77 draw đủ bảng giải, checkpoint `00101`,
24 failed, không có run treo. POWER-05 giữ mở, chờ nguồn truy cập lại để resume;
full audit/hai collector chưa chạy. Bằng chứng trong `POWER_ACCEPTANCE.md`.
Thử thêm lúc 08:43: run `303` tiếp tục exit 1/HTTP 429 tại latest page,
không thêm draw; checkpoint và dữ liệu giữ nguyên, không có run treo.

Power recovery 20/10/2026: lượt đầu thêm 30 draw; thử tiếp một worker/interval
2 giây thêm 18 draw, tổng **215/1.412**, còn 1.197 ID thiếu. Tùy chọn CLI
`--workers 1` đã kiểm bằng 195 backend tests và Ruff/Pyright/format.
Nguồn vẫn Cloudflare challenge; **POWER-05 vẫn mở**. Backup và bằng chứng
bảo toàn dữ liệu/API ở [POWER_ACCEPTANCE.md](docs/POWER_ACCEPTANCE.md).

## Bổ sung UX — nhảy trực tiếp tới trang (14/10/2026)

- [x] **UX-PAGE-01:** Pager dùng chung thêm “Đến trang” + tổng trang + nút
  “Đi”; Enter để gửi, Escape khôi phục. Validate số nguyên 1..tổng trang,
  không request khi gõ/số sai/trang hiện tại; single-page vô hiệu hóa.
  Giữ trước/sau và URL/filter/back/forward hiện có; mobile wrap, hai mũi tên
  cùng nhóm, input/nút bấm tối thiểu 44px. Không đổi API hoặc dữ liệu.
- Kiểm chứng: lint, format, typecheck, build đạt; **17 unit tests pass**.
  E2E toàn bộ trên Vite local + API Compose: **62 pass, 4 skip theo thiết bị**,
  gồm 6 ca mới history/pairs trên desktop/tablet/mobile. Đã xem screenshot
  thanh phân trang desktop/mobile; Axe trên pager và các màn hình đạt,
  regression breakpoint không overflow. Không rebuild/deploy Compose trong
  task này; frontend container hiện tại chưa chứa thay đổi mới.

## Sửa đồng bộ kỳ mới — 15/10/2026

- [x] **SYNC-01 — Chặn retry storm và ưu tiên latest.** Challenge hoãn ngay;
  import dừng submit/drain in-flight đúng counters. Collector lưu latest từ
  trang đã validate, không refetch, giới hạn 20 ID, checkpoint an toàn ở cả
  đường lỗi; backlog xoay theo attempted_at, còn thiếu báo partial.
- [x] **SYNC-02 — Poll và vận hành local.** Poll latest 5 phút, ba game dùng
  chung throttle tuần tự. Hỗ trợ Windows local tasks (poll/logon + daily),
  một scheduler owner, đọc `.env` khi chạy, giữ PostgreSQL nguồn duy nhất.
  Đã cài trên máy hiện tại, tắt scheduler Docker, phục hồi latest ba game.
- [x] **SYNC-03 — Kiểm chứng và tài liệu.** 175 backend tests, Ruff/Pyright/
  format; frontend lint/type/build/format, 17 unit và Compose E2E 62 pass/
  4 skip. Backup trước recovery; source/DB/API latest khớp trong lượt nguồn
  truy cập được. Review độc lập, README/Data Pipeline/ADR đã cập nhật.

- [x] **SYNC-04 — Khôi phục lịch local và sửa báo lỗi (19/10/2026).** Bật lại
  `LottoScope-LocalSync` đang Disabled; latest-only không trả lỗi chỉ vì backlog
  cũ khi latest đã xử lý và không có lỗi hiện tại. Giữ DB `partial`, reconcile
  vẫn kiểm tra đầy đủ; cập nhật cảnh báo Dashboard và hướng dẫn vận hành.
  Đã phục hồi latest Lotto/Mega/Power **00954/01577/01412**. Lượt tự động 11:27
  trả 0, ba nguồn 200, không tạo trùng. 185 backend tests, Ruff/Pyright/format,
  frontend lint/format/typecheck/build và 17 unit tests đạt; Compose healthy,
  E2E 62 pass/4 skip theo thiết bị.

- [x] **SYNC-05 — Đổi lịch local (19/10/2026).** Cài hai trigger hằng ngày
  18:30/21:15 UTC+07; bỏ lịch 5 phút/logon/catch-up, tắt reconcile tự động
  07:00. Kiểm tra XML task, trạng thái Ready/NextRun 18:30, PowerShell syntax
  và Docker scheduler vẫn tắt; chưa tới giờ để kiểm chứng trigger thực chạy.

- [x] **SYNC-06 — Đồng bộ thủ công từ UI (20/10/2026).** Nút Tải dữ liệu
  đồng bộ latest-only cho game đang chọn, pending/error/success và refresh
  query theo context. POST dùng service/pipeline hiện có, PG lock và cooldown
  60 giây; giữ partial backlog, correction policy và idempotence. Hai task
  Windows Disabled, Compose mặc định scheduler false. 192 backend tests,
  Ruff/Pyright/format, frontend lint/typecheck/build/format và 19 unit đạt.
  E2E 68 ca pass/4 skip (ba ca retry đã rerun sau sửa selector nhãn cũ).
  Bấm thật thêm hai Lotto, latest 00956. Chi tiết kiểm chứng/giới hạn ở
  [ADR 0008](docs/DECISIONS/0008-manual-sync.md).

Bằng chứng, tốc độ đo và giới hạn nguồn ở [ADR 0007](docs/DECISIONS/0007-fast-collection.md).
Vietlott vẫn có thể trả 429 cả từ host; lịch tự động đã chạy nhưng không cam kết
nguồn luôn mở. Power đã có latest 01412, full history/audit POWER-05 còn mở.

## Lồng cầu vật lý — 24/10/2026

- [x] **SIM-01 — Cơ chế Rapier:** thành rỗng/cửa/vật lý bóng; chỉ ghi nhận
  crossing thực, giữ thứ tự và dừng sáu main, timeout/pause/reset an toàn.
- [x] **SIM-02 — Giao diện Mega/Power:** cảnh React Three Fiber lazy-load,
  responsive, controls, reduced motion/lỗi WebGL, copy/checker; giữ UI Lotto.
- [x] **SIM-03 — Nghiệm thu:** quality gates và browser desktop/tablet/mobile,
  review, cập nhật docs/agent và commit. Contract ở
  [DRAW_SIMULATION.md](docs/DRAW_SIMULATION.md), quyết định ở
  [ADR 0009](docs/DECISIONS/0009-physical-draw-simulation.md).

Kiểm chứng SIM: lint/format/typecheck/build đạt, **32 unit tests pass**;
suite E2E đầy đủ **83 pass/4 skip theo thiết bị**. Sau chỉnh vị trí controls,
rerun UI unit đạt và **10 feature E2E pass trực tiếp trên Compose** (desktop/
mobile, vật lý thật, cả hai game, reset/context loss, checker/copy, Axe).
Đã xem ảnh desktop/mobile, review độc lập không còn finding trọng yếu.
Frontend image đã build/up; ba service healthy. Không đổi backend/schema/
ingestion; số draw Lotto/Mega/Power giữ **964/1.577/1.414**.

## Lotto DrawMachine — 25/10/2026

- [x] **SIM-04 — Thay RuleGenerator Lotto:** dùng chung DrawMachine, truyền
  `main_max`/`main_count` từ API xuống cảnh/vật lý; 35 bóng, đúng 5 main,
  kết quả/copy/checker và bố cục theo game. Đồng bộ docs/agent, kiểm chứng
  desktop/tablet/mobile và quality gates, rồi commit.

Kiểm chứng SIM-04: lint/format/typecheck/build đạt; **42 unit tests pass**.
Full E2E **86 pass/4 skip theo thiết bị**; sau bổ sung đổi game giữa phiên
Lotto đã có bóng ra, chạy lại ca này trên desktop/tablet/mobile **3 pass**.
Quay Rapier thật đủ 5 main Lotto và 6 main Mega/Power; kiểm copy/checker,
game/window, không gọi generator API, Axe và ảnh Lotto desktop/mobile.
Regression cột thứ sáu thừa và constructor tự suy luận count đã RED → GREEN.
Lượt unit chạy đồng thời browser từng timeout; chạy riêng full suite đạt với
timeout giữ nguyên. Review độc lập không có finding quan trọng. Cảnh 3D vẫn
có cảnh báo bundle lớn/deprecation đã có; chưa kiểm FPS trên điện thoại thật.
Không deploy hoặc thay backend, schema, ingestion; generator API giữ contract.

## Lotto số đặc biệt và frontend đang chạy — 25/10/2026

- [x] **SIM-05 — Lotto special:** 5 main rồi 1 special vật lý từ lồng 1–12,
  tách state/hiển thị/copy, checker main-only; pause/reset/lỗi/context an toàn.
  Kiểm chứng, rebuild/recreate frontend cổng 8088 và xác nhận browser trên
  container thực; không thay backend/PostgreSQL.

Kiểm chứng SIM-05: **51 unit pass**, lint/format/typecheck/build đạt; review
độc lập không có finding quan trọng. Rebuild/recreate riêng frontend healthy,
bundle `index-BvfNwtcn.js` thay `index-BYogNF0A.js` cũ ở cổng 8088; backend và
PostgreSQL không bị recreate, không đổi dữ liệu/schema. Full E2E trên bản
Compose **86 pass/4 skip theo thiết bị**, gồm Lotto 5+1 vật lý, pause/resume
ở special, copy, checker main-only, game/window, reduced motion, WebGL, Axe.
Đã xem ảnh desktop/mobile; mobile là Chromium emulation, chưa đo máy thật.
README bổ sung cách cập nhật image frontend; tab cũ cần tải lại bundle.

## Chia sẻ Wi-Fi — 25/10/2026

- [x] **LAN-01 — Frontend qua Wi-Fi:** overlay opt-in, giữ localhost, backend/
  PostgreSQL loopback; kiểm effective firewall, áp dụng runtime, kiểm HTTP/API
  và browser qua IP LAN, ghi rõ giới hạn kiểm tra từ thiết bị thứ hai.

Kiểm chứng LAN-01: base Compose chỉ loopback; overlay yêu cầu IP, merge thành
`127.0.0.1:8088` + `192.168.1.2:8088`, backend `8000`/PostgreSQL `5432` chỉ
loopback. Chỉ recreate frontend; ba service healthy. HTTP localhost và LAN
200, API qua Nginx đủ ba game. E2E flow A/B desktop/mobile **4 pass**, Lotto
vật lý mobile qua LAN **1 pass** (5+1, pause/resume/checker, Axe/overflow).
Review độc lập không có finding quan trọng. Người dùng ban đầu không mở được,
sau đó xác nhận **đã truy cập được từ thiết bị khác bằng `http://`**; host có
kết nối từ client LAN `192.168.1.19`. Rule Docker Public hiện có phù hợp nên
không sửa firewall/profile; không mở router/Internet. Không thay source app,
backend, DB hoặc chạy lại unit/build không liên quan. `.env` local giữ IP và
`COMPOSE_FILE`; hướng dẫn bật/tắt/DHCP/HTTP ở README, quyết định ở ADR 0010.

## Cloud Free — 29/10/2026

- [x] **CLOUD-01 — Cấu hình opt-in:** Vercel SPA + Node gateway cùng origin,
  Render Blueprint Free, Neon direct URL/psycopg, cloud origin token bắt buộc,
  không publish docs, scheduler tắt; local giữ nguyên. ADR 0011 và runbook
  DEPLOYMENT_FREE.md thay proposal Cloudflare cũ cho hướng đã chọn.
- [x] **CLOUD-02 — Kiểm chứng local:** full backend/frontend gates, gateway
  regression, Docker cloud command, PostgreSQL migration/backup-restore riêng,
  schema config và HTTP qua gateway tới container thật.
- [x] **CLOUD-03 — Kết nối/provision:** xác nhận account access, Free quotas,
  repository/branch consent; tạo Neon/Render/Vercel, secrets và backup ngoài máy.
- [ ] **CLOUD-04 — Chuyển dữ liệu/go-live:** restore Neon trống/đối chiếu,
  readiness, deploy theo SHA, HTTP/browser/edge routing/cold start/source sync,
  quota và rollback. Website đã live; source sync bị challenge, cold start
  sau idle chưa đo nên chưa đánh dấu toàn bộ acceptance hoàn thành.
- [x] **CLOUD-04A — Go-live đã kiểm chứng:** restore/đối chiếu, deploy SHA,
  HTTP/gateway, browser desktop/mobile, 10 concurrent reads, restart giữ dữ liệu,
  backup ngoài máy; [biên bản](docs/DEPLOYMENT_ACCEPTANCE.md).
- [ ] **CLOUD-04B — Nghiệm thu vận hành còn lại:** nguồn Vietlott từ Render
  trả Cloudflare challenge cho cả ba game; cần sync thành công và kiểm live
  idempotence khi nguồn truy cập được. Chưa đo cold start sau idle tự nhiên
  hoặc RAM/tải kéo dài trên Render thật; không thay bằng số đo local/restart.

Kiểm chứng CLOUD-01..02: backend uv sync locked, Ruff lint/format, Pyright,
Alembic upgrade/check trên `lotto_cloud_20261029_test`, **216 tests pass**
(10 warnings có sẵn). Frontend lint/format/typecheck/build và **57 tests pass**,
gồm 6 gateway tests; bundle lớn DrawScene là warning có sẵn. Render/Vercel
configured values pass published schema validation (vendor Vercel schema
không pass full draft metaschema của check-jsonschema; instance validation
chạy trực tiếp bằng jsonschema, không bỏ cấu hình sai).

Backup custom-format dùng exported snapshot READ ONLY từ local, restore sang
`lotto_cloud_restore_20261029_test`: **7 bảng, counts/content SHA-256 và sequences
khớp; 3.968 draws**. Không thay source DB. Migration trên clone đạt. Docker
image riêng `lottoscope-cloud:local`, chạy command Render trên loopback 18081,
giới hạn **512 MiB / 0.1 CPU**: origin guard, liveness/readiness, ba game,
gateway GET/query/POST checker, JSON 404 và 10 concurrent reads đạt. Không dùng
điều này để cam kết latency/SLA Render thật. Compose config đạt; không recreate
ứng dụng đang chạy. Backup/fingerprint nằm trong backups ignored, không commit.

Tại mốc CLOUD-01..02 mới kiểm local. Resource, chuyển dữ liệu và bằng chứng
cloud bổ sung ở CLOUD-03..04 bên dưới. Không thêm logo untracked.

### CLOUD-03/CLOUD-04 — Go-live và giới hạn nghiệm thu

CLI chính thức đã xác thực cả ba tài khoản (plugin đã cài nhưng phiên không
nhận service tools). Vercel team khuong8: Hobby; Neon org: Free. Đã tạo Neon
project `falling-pine-80552402`, PostgreSQL 16, Singapore, 0.25 CU cố định,
scale-to-zero mặc định; restore **976 Lotto / 1.577 Mega / 1.415 Power** từ
snapshot READ ONLY. Cả 7 bảng/counts/content hashes/sequences khớp, migration
head/check đạt. Local source không bị sửa. Secrets giữ ở .env.cloud ignored.

Đã tạo Render `srv-dbhmfidg1s2s73aevs40`, Singapore, plan free, auto-deploy off;
Vercel `prj_w0vXLhOQwZmoa3cpnrK2xSyc5fqf`, root frontend, Node 22/Fluid,
sin1, production server secrets, public access; Git auto-deployment disabled.
Vercel cuối cùng deploy release 9cc7226; backend Render release 24720a5.

Render build đạt nhưng startup đầu thất bại vì nested shell quoting; thay
dockerCommand bằng `python -m app.commands.serve`, đọc PORT trực tiếp.
Ruff lint/format, Pyright và **9 ingress/smoke tests pass**; entrypoint thật
đã kiểm custom PORT/liveness/guard ở process riêng. Không đổi domain/schema
hoặc chạy lại full suite không liên quan.

Render commit 24720a5 đã live sau khi chủ tài khoản lưu Docker Command qua
dashboard (API update bị automatic approval chặn, CLI không hỗ trợ trường
Docker Command). Public liveness 200, protected readiness 200, direct API 401
khi thiếu token và 200 khi có token. Backup off-machine đã upload cùng manifest
lên **draft release trong repository GitHub private**; không publish hoặc bật
lịch tự động. Không lưu credentials trong dump/manifest.

Vercel runtime phát hiện ESM import `.ts` còn giữ sau compile thành `.js`, gây
FUNCTION_INVOCATION_FAILED. Đổi import sang `.js`, import node:process rõ ràng
và thêm types node ở root tsconfig do Vercel compiler không dùng project
references. Lint/format/typecheck và **57 tests pass** trong Vercel build thật;
build cuối không còn TypeScript diagnostics, artifact có dependency gateway.js.
Đã deploy bản sửa: **https://lottoscope-sable.vercel.app**. HTTP smoke thật
qua Vercel/Render/Neon đạt cho ba game, gateway/query/404/no-store/deep links;
**6 Playwright desktop/mobile tests pass** với cloud API không mock. Burst
10 concurrent reads đạt 932 ms; sau restart Render đạt 984 ms, readiness 200,
3.968 draws/latest và migration head giữ nguyên. Không coi burst này là SLA.

Sync thực cả ba game từ Render trả 503 `sync_source_unavailable`; audit trên
Neon ghi `Cloudflare challenge; deferred`. Lotto gọi lại trả 429 cooldown,
không lặp tiếp hoặc bypass. Dữ liệu lịch sử giữ nguyên; source sync live
**chưa đạt**. Cold start sau idle tự nhiên và RAM/tải dài trên Render thật
**chưa đo**. Backup ngoài máy một lần đã có, **chưa có lịch tự động**. Chi tiết
resources/versions/rollback/giới hạn ở [biên bản](docs/DEPLOYMENT_ACCEPTANCE.md).

## Favicon — 29/10/2026

- [x] **ICON-01 — Nhận diện trên tab:** SVG kính lúp/biểu đồ với palette
  navy/teal/mint hiện có; fallback ICO 16/32/48 px và Apple touch PNG 180 px.
  Khai báo trong HTML dùng absolute paths để hoạt động trên deep links.
  Build/typecheck, format, SVG XML và kích thước assets đạt; đã xem bản render
  16/32/180 px. Không thay logo.png untracked của người dùng.
- [x] **ICON-02 — Cloud:** Vercel release `14f8a8a`, deployment
  `dpl_AsW2g6MCYuUKy5ehYVmycSYG68fy` ready tại URL production hiện có;
  build gates và 57 tests pass. SVG/ICO/PNG trả 200, đúng MIME và bytes khớp;
  browser desktop 1440 px/mobile 390 px kiểm deep link, title, link icons và
  decode ảnh đạt. Cloud HTTP smoke ba game/gateway/deep links vẫn đạt.

## UI/UX audit — 29/10/2026

- [x] **UX-AUDIT-01 — Đánh giá theo ui-ux-pro-max:** review sáu màn hình
  cloud ở desktop/mobile (12 trạng thái), axe không ghi nhận violation tự
  động và không tràn ngang; kiểm thêm lưới Power 320/768/1024 px, menu
  Escape/outside/focus, loading giả lập và reduced motion. Có bằng chứng
  layout và đề xuất ưu tiên ở [UI_UX_AUDIT.md](docs/UI_UX_AUDIT.md).
  Chỉ phân tích/đề xuất; chưa đổi UI, chưa triển khai redesign.

## Trạng thái nghiệm thu MVP ban đầu

- [x] **Backend MVP hoàn thành:** P0–P6 và P8-01, P8-03–P8-07, P8-09 đạt;
  nghiệm thu theo overview mục 15. P7/P8-02/P8-08 có thể còn mở nếu
  `docs/MVP.md` chốt bàn giao backend trước.
- [x] **Frontend MVP hoàn thành:** P7, P8-02 và P8-08 đạt trên API backend
  đã nghiệm thu; 15 mục wireframe mục 33 có bằng chứng.
- [x] **MVP ứng dụng hoàn thành:** hai mốc trên đạt, luồng người dùng từ xem
  lịch sử đến phân tích/checker/generator hoạt động với dữ liệu thật, Compose
  chạy được và tài liệu bàn giao P8-09 đã cập nhật.
