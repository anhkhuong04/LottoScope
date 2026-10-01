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

- [ ] **P5-01 — Checker input contract.** Main numbers đúng count/range,
  canonical trước compare; optional special/full-ticket chỉ làm khi mode và
  identity đã được chốt. Test reorder, duplicate, invalid type và hai game.
- [ ] **P5-02 — Exact match.** Count và last exact match theo identity/search
  range đã chốt, bao gồm no-match hợp lệ; test permutation, history trùng ở
  nhiều kỳ và special behavior theo mode.
- [ ] **P5-03 — Historical overlap.** Tính số phần tử giao main, buckets theo
  contract, similar/recent draws có stable sort/paging; test 0..5/0..6,
  exact bucket và special không ảnh hưởng.
- [ ] **P5-04 — Checker analytics.** Đưa frequency/gap/pair context theo
  window vào result có metadata; kiểm tra checker không tính metric khác
  analytics core trên cùng dataset.
- [ ] **P5-05 — Rule engine.** Typed rule config, enabled/disabled và validate
  threshold/contradiction; implement từng rule MVP trong docs theo cùng
  semantic analytics/checker; test pass/fail và boundary từng rule.
- [ ] **P5-06 — Generator.** Candidate hợp lệ/canonical, optional local seed,
  unique outputs, bounded attempts/work và số kết quả yêu cầu có giới hạn;
  test reproducibility cùng data/config/seed/time và rule set không khả thi.
- [ ] **P5-07 — Structured explanation.** Mỗi result ghi rule/threshold/value,
  frequency/pairs/exact-match/recent-overlap liên quan, window/as-of và trạng
  thái partial/no-result; test explanation khớp chính kết quả lọc.

## P6 — HTTP API và tích hợp backend

**Phụ thuộc:** P0-07 và services P2–P5 tương ứng. **Điều kiện ra:** mọi use
case MVP backend gọi được qua FastAPI với schema/error/limits đã thống nhất.

- [ ] **P6-01 — API shell.** FastAPI app, dependency injection cho session/
  service, typed schemas, error mapping và OpenAPI; route không chứa SQL,
  parsing nguồn hoặc thuật toán analytics.
- [ ] **P6-02 — History endpoints.** Latest draw, danh sách/detail theo ID,
  date range, paging/sort và data freshness; test contract, game isolation,
  invalid filters, no-data và stable ordering.
- [ ] **P6-03 — Analytics endpoints.** Frequency, gap, pairs, number detail,
  pair detail theo window; trả as-of/actual draw count và pagination cần
  thiết. Test dữ liệu API với core fixture cho cả hai game.
- [ ] **P6-04 — Checker endpoint.** Validate server-side, exact/overlap/
  similar draws/number-pair context; test response/no match/errors và limits.
- [ ] **P6-05 — Generator endpoint.** Typed rules, requested count/seed,
  explanation và partial/no-result; test invalid/contradictory input, bounded
  failure, reproducibility và response size limit.
- [ ] **P6-06 — Cross-layer integration.** Từ fixture nguồn → ingest vào
  PostgreSQL → query API: kiểm tra lịch sử, frequency/gap/pairs, checker,
  generator và freshness cùng game/window; không lấy mock thay DB ở test này.
- [ ] **P6-07 — API reliability.** Không lộ traceback/secret, không trả 200
  cho job/source failure, date/time serialize nhất quán và analytics CPU
  không chặn event loop theo mô hình đã chọn; kiểm tra cases liên quan.

## P7 — Frontend MVP (luồng riêng theo wireframe)

**Phụ thuộc:** P0-01, P0-07; từng màn hình cần API P6 tương ứng. **Điều kiện
ra:** 15 acceptance criteria ở wireframe mục 33 được kiểm tra trên desktop và
mobile với dữ liệu API thật. Stack frontend chưa được quyết định trong docs.

- [ ] **P7-01 — Chọn và bootstrap frontend.** Ghi ADR cho framework/runtime,
  build/test tooling và cách gọi API; tạo app, lockfile, lint/type/build/test
  commands và cập nhật README/CI. Không xem một library cụ thể là đã chốt.
- [ ] **P7-02 — Application shell/navigation.** `/` → `/dashboard`, desktop
  sidebar/top bar, mobile bottom nav/More, game selector toàn app; active
  navigation và keyboard focus rõ.
- [ ] **P7-03 — Shared context/components.** Window selector (UI default 30),
  URL state cho filters/page/sort, API state key theo game/window, number ball,
  metric card, table và loading/empty/error; game switch reset input không
  hợp lệ và bỏ late response của game cũ.
- [ ] **P7-04 — Dashboard.** Latest draw, tối đa 4 summary cards, frequency
  chart/grid, top pairs, highest gaps, recent draws, freshness; link drill-down
  hoạt động, mobile layout đọc được.
- [ ] **P7-05 — History và draw detail.** Date/draw-ID filters, paging, sort,
  main/special/source/time rõ; desktop table, mobile cards/detail view;
  empty/error/retry đúng context.
- [ ] **P7-06 — Numbers và number detail.** Grid/table/chart frequency/gap,
  sort; number detail có metrics, timeline, partners, recent draws; dữ liệu
  cùng game/window và chart có textual summary.
- [ ] **P7-07 — Pairs và pair detail.** Minimum frequency/sort, count/%/last
  seen, pair detail/timeline/draws; stable deep links, paging và empty state.
- [ ] **P7-08 — Checker.** Number picker/token input, client validation cho
  hai game; exact match → overlap → similar draws → per-number → pairs;
  no historical match hiện là kết quả bình thường.
- [ ] **P7-09 — Generator.** Rule toggle/value/help, count và seed nếu API
  hỗ trợ, results với structured explanation; desktop drawer/mobile full
  screen, partial/no-result rõ, không gắn nhãn best/prediction.
- [ ] **P7-10 — States và UX test.** Từng section có loading, no-data,
  network/server/invalid/stale/retry; refresh lỗi giữ dữ liệu cũ đúng context,
  đổi game không hiện nhầm dữ liệu. Test các flow A–D wireframe mục 31.
- [ ] **P7-11 — Responsive/accessibility test.** Kiểm tra ≥1024px,
  768–1023px, <768px; primary flow mobile không ngang trang, touch target
  ≥44px, keyboard/form labels/focus/contrast/chart fallback; sửa lỗi phát hiện.

## P8 — Hoàn thiện, triển khai thử và nghiệm thu

**Phụ thuộc:** P2–P6 cho mốc backend; thêm P7 cho mốc có giao diện. **Điều kiện
ra:** hệ thống có thể cài đặt lại, nhập dữ liệu, tự cập nhật và kiểm tra các
luồng theo acceptance với bằng chứng lưu lại.

- [ ] **P8-01 — Chạy toàn bộ backend gates.** `uv sync --locked`, Ruff check/
  format, Pyright, pytest; PostgreSQL integration/migration tests pass;
  ghi lệnh, kết quả và môi trường thực tế. Không thay PostgreSQL bằng SQLite.
- [ ] **P8-02 — Chạy frontend gates nếu P7 trong milestone.** Install theo
  lockfile, lint/type/test/build và browser checks cho các flow chính trên
  desktop/mobile; ghi lỗi còn lại và kết quả sửa.
- [ ] **P8-03 — Kiểm tra migration/deploy trên môi trường sạch.** Compose
  config/build/up, DB volume tồn tại sau restart, migration upgrade, readiness
  và app phục vụ request; hướng dẫn rollback/giới hạn rollback.
- [ ] **P8-04 — Kiểm tra backup/restore.** Backup PostgreSQL, restore vào DB
  khác, đối chiếu draw count, identity/sample và API query sau restore; ghi
  lệnh vận hành trong README/architecture.
- [ ] **P8-05 — Smoke test end-to-end dữ liệu thực.** Import history hai game,
  chạy collector lặp, đối chiếu kỳ mới/source, truy vấn history/analytics/
  checker/generator; ghi source, thời điểm và hạn chế nếu source không sẵn.
- [ ] **P8-06 — Kiểm tra phi chức năng mức MVP.** Paging/limits trên dataset
  lịch sử, queries/indexes chủ đạo, failure/retry và scheduler một instance;
  sửa bottleneck hoặc lỗi correctness được quan sát, không tối ưu suy đoán.
- [ ] **P8-07 — Nghiệm thu backend.** Đánh dấu từng mục overview mục 15 bằng
  evidence: hai game đúng, update tự động, history, frequency, gap, pairs,
  checker, generator/explanation, automated tests, Compose và khả năng mở
  rộng game/analytics mà không sửa core rải rác.
- [ ] **P8-08 — Nghiệm thu frontend nếu P7 trong milestone.** Đánh dấu từng
  mục wireframe mục 33 bằng màn hình/flow/test cụ thể; kiểm tra wording không
  gây hiểu là dự đoán và các trạng thái loading/empty/error.
- [ ] **P8-09 — Bàn giao.** README và tài liệu phản ánh implementation,
  danh sách ADR/migration, các vấn đề còn mở, kết quả gates, hướng dẫn vận hành
  import/collector/backup/restore và phạm vi Phase 2 để triển khai tiếp.

## Mốc đánh dấu hoàn thành

- [ ] **Backend MVP hoàn thành:** P0–P6 và P8-01, P8-03–P8-07, P8-09 đạt;
  nghiệm thu theo overview mục 15. P7/P8-02/P8-08 có thể còn mở nếu
  `docs/MVP.md` chốt bàn giao backend trước.
- [ ] **Frontend MVP hoàn thành:** P7, P8-02 và P8-08 đạt trên API backend
  đã nghiệm thu; 15 mục wireframe mục 33 có bằng chứng.
- [ ] **MVP ứng dụng hoàn thành:** hai mốc trên đạt, luồng người dùng từ xem
  lịch sử đến phân tích/checker/generator hoạt động với dữ liệu thật, Compose
  chạy được và tài liệu bàn giao P8-09 đã cập nhật.
