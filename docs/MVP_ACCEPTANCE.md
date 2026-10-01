# Nghiệm thu MVP — 01/10/2026

Đối chiếu [12 điều kiện backend](PROJECT_OVERVIEW.md#15-definition-of-success) và [15 điều kiện frontend](wireframe.md#33-mvp-acceptance-criteria). File này lưu **bằng chứng chạy thật**, không định nghĩa lại công thức hay API. Lệnh vận hành ở [README](../README.md); phạm vi ở [MVP.md](MVP.md).

## Môi trường và quality gates

Windows/PowerShell, Docker Compose v2.40.3, PostgreSQL 16, Python 3.12.14/uv 0.12.21, Node 22.18.0/npm 10.9.3. Backend tests dùng PostgreSQL database riêng `lotto_test` đã migrate; URL host dùng `127.0.0.1` vì `localhost` bị treo kết nối trên máy kiểm chứng. Không dùng SQLite.

| Kiểm chứng | Kết quả |
| --- | --- |
| `uv sync --locked`; `ruff check .`; `ruff format --check .`; `pyright` | Đạt; Pyright 0 lỗi/0 cảnh báo |
| `alembic check` trên DB test; `alembic upgrade head` trên DB Compose trống | Đạt; head `0003_ingestion_tracking` |
| `pytest` với `LOTTO_TEST_DATABASE_URL` | 72 passed, 1 cảnh báo deprecation từ Starlette TestClient/httpx |
| `npm ci`; `npm run lint`; `npm run format:check`; `npm run typecheck`; `npm test`; `npm run build` | Đạt; 4 unit tests, bundle production build thành công |
| `npm run test:e2e` trên Vite + backend thật, desktop/tablet/mobile | 29 passed, 4 skips đúng điều kiện project |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8088 npm run test:e2e -- --project=desktop --project=mobile` trên bản Compose | 20 passed, 2 skips đúng điều kiện project; gồm axe WCAG A/AA trên 9 route và kiểm tra breakpoint 320–1365 px |

## Deploy, dữ liệu và phi chức năng

- Project Compose cô lập `lottoscope_p8`: `config --quiet`, build backend/frontend, PostgreSQL mới, `alembic upgrade head`, `up --wait` cả ba service đạt. `/health/ready`, `/api/v1/games`, frontend `/` và deep link `/numbers/1` trả 200. Giá trị `game_data_state.version=42` còn sau restart PostgreSQL. Đã dừng và dọn project test sau kiểm chứng; project ứng dụng chạy ba service healthy. Hướng dẫn rollback và giới hạn downgrade ở README.
- `pg_dump -Fc` tạo archive 244.020 byte từ DB ứng dụng, restore vào `lotto_restored` ở PostgreSQL cô lập. Snapshot lúc dump: **2.488 draws** (Lotto 919, Mega 1.569); count và checksum MD5 canonical toàn bộ draw đều khớp nguồn/restore (`cb22f3528aea40ee1bf530f8f31060c2`). Hai draw cuối cùng của snapshot khớp ID/date/main/special. Backend tạm trỏ DB restore trả readiness 200, latest `00919`/`01569` và total `919`/`1569`. Sau dump, import mới thêm Lotto `00920`; vì vậy count DB hiện hành cao hơn snapshot một draw.
- Import và audit từ nguồn Vietlott ngày 01/10/2026: [Lotto 5/35](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00920&nocatche=1) latest `00920` ngày 01/10 (main `07 11 24 28 34`, special `11`); [Mega 6/45](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645?id=01569&nocatche=1) latest `01569` ngày 30/09 (main `02 09 24 27 30 33`). Import Lotto thêm 1 draw, bỏ qua 919 đã có; Mega bỏ qua 1.569. Collector chạy **hai lượt/game**, mỗi lượt recheck 7 draw, không thêm duplicate/conflict. `audit_import` cho cả hai game: coverage đầy đủ `920/920` và `1569/1569`, 0 unscanned/unresolved/provenance/chronology/sample mismatch. Đây là ảnh chụp tại thời điểm kiểm tra; dữ liệu sẽ cần collector tiếp tục cập nhật.
- Qua frontend Compose `/api`: cả hai game trả latest, history page 2 (10 items), numbers (35/45), pairs, checker exact match và generator 2 kết quả có explanation. Dataset hiện tại 920/1.569 draws; history `page_size=100`, page sâu, date filter hoạt động; `page_size=101`, `page=0`, số/pair detail vượt limit đều HTTP 422. PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)`: history page sâu ~1,37 ms (seq scan/sort trên 2.489 rows), date-filter Mega dùng `ix_draws_game_date_seq` ~0,08 ms, pair containment dùng `ix_draws_main_numbers_gin` ~0,62 ms. Không có bottleneck quan sát được ở cỡ dataset MVP.
- Retry 3 lần, `Retry-After` bounded, interrupted import/resume và advisory lock khi job chồng nhau được kiểm bằng `test_ingestion_fetcher.py`/`test_ingestion_service.py`. Một backend container, một Uvicorn worker bật scheduler theo giờ Việt Nam; `test_scheduler.py` xác nhận lịch poll/reconcile. Chưa đo throughput nhiều người dùng hoặc triển khai public.

## Backend — overview mục 15

| # | Đạt | Bằng chứng |
| --- | --- | --- |
| 1 | ✓ | `audit_import` hai game, count/identity/provenance và mẫu nguồn như trên; `test_draw_domain.py`, `test_draw_repository.py` |
| 2 | ✓ | APScheduler poll/reconcile trong `app/jobs/collection.py` gọi cùng collector; kiểm lịch + collector lặp/idempotency ở tests và smoke live |
| 3 | ✓ | History latest/ID/date/page trên API thật; page sâu và query plan ở trên; `test_api_v1.py` |
| 4 | ✓ | API numbers theo window; công thức tính tay của hai game ở `test_analytics.py::test_frequency_gap_pair_formulas_and_ties` |
| 5 | ✓ | Current/average/max gap và never-seen theo fixture độc lập ở `test_analytics.py`; number detail qua API/browser |
| 6 | ✓ | Pair frequency/gap và pair detail theo fixture tính tay ở `test_analytics.py`; API/browser flow D |
| 7 | ✓ | Latest draw của mỗi game đưa vào checker: exact match ≥1; histogram/overlap/cutoff ở `test_combinations.py` |
| 8 | ✓ | Generator nhận rules, seed, bounds; test từng rule pass/fail, invalid/partial ở `test_combinations.py` |
| 9 | ✓ | Hai kết quả/game qua API đều có explanation; test threshold/observed/passed và browser flow C |
| 10 | ✓ | 72 backend tests, gồm analytics fixture PostgreSQL; kết quả gate ở trên |
| 11 | ✓ | Compose sạch, migration, health, volume restart, frontend/API request như trên |
| 12 | ✓ | Game definition tập trung ở `app/games/definitions.py`, analytics thuần ở `app/analytics/`, HTTP ở `app/api/`; hai game dùng chung repository/service và test chung. Thêm game mới vẫn cần definition, validation/schema migration phù hợp, không phải viết lại core analytics. |

## Frontend — wireframe mục 33

| # | Đạt | Màn hình/flow/test |
| --- | --- | --- |
| 1 | ✓ | Game selector trong shell; Playwright flow A chuyển Lotto → Mega, kiểm 45 number tiles |
| 2 | ✓ | `/dashboard` latest draw + analytics summary; Playwright flow A và axe route |
| 3 | ✓ | Window selector, URL/deep link/back-forward; flow A và `analysis window survives deep link` |
| 4 | ✓ | `/history` date filter, nút trang sau đổi URL/page 2; test `history date filter` và `cross-screen draw links`; backend page contract |
| 5 | ✓ | `/numbers` frequency/current gap, 35/45 tiles; flow A và API numbers smoke |
| 6 | ✓ | `/numbers/:number` timeline và draws; flow A, cross-screen draw links |
| 7 | ✓ | `/pairs` pair frequency; flow D và API pairs smoke |
| 8 | ✓ | `/pairs/:a-:b` draws chứa pair; flow D |
| 9 | ✓ | `/checker` chọn đúng số theo game; `validateNumbers` unit test cả hai game, API invalid input tests |
| 10 | ✓ | Checker exact match và overlap histogram; flow B, API smoke cả hai game |
| 11 | ✓ | `/generator` bật/tắt, chỉnh giá trị rules; flow C bật overlap rule |
| 12 | ✓ | Result mở explanation dialog với rule threshold/observed; flow C, API smoke |
| 13 | ✓ | `DataState` loading/empty/error/stale/retry; Playwright `network error`, `empty and invalid-input`; unit test bỏ response cũ khi đổi game |
| 14 | ✓ | Browser trên desktop/tablet/mobile, mobile nav/touch targets ≥44 px, không overflow ở breakpoint 320–1365 px; axe không báo WCAG A/AA violation trên 9 route |
| 15 | ✓ | UI ghi rõ “Số liệu mô tả kết quả đã công bố; không dự đoán kỳ tiếp theo”, generator ghi “không phải dự đoán hoặc khuyến nghị”; rà `frontend/src` không có claim đảm bảo trúng/thắng |

## Bàn giao và giới hạn

ADR: [0001 kiến trúc](DECISIONS/0001-mvp-architecture.md), [0002 frontend](DECISIONS/0002-frontend-stack.md), [0003 Compose frontend](DECISIONS/0003-compose-frontend.md). Migrations: `0001_baseline`, `0002_draw_storage`, `0003_ingestion_tracking`. Cảnh báo deprecation của Starlette TestClient/httpx còn mở; không ảnh hưởng 72 tests nhưng cần xử lý khi nâng dependency. Chưa quan sát một lần scheduler tự kích hoạt đúng giờ trong kiểm chứng này; lịch và collector cùng đường chạy đã được kiểm riêng. Chưa có TLS/public ingress, giám sát production, kiểm tải nhiều người dùng. Phase 2 (strategy, backtest, random baseline, saved picks) chưa triển khai; methodology backtest cần specification trước. Không suy diễn kết quả lịch sử thành xác suất trúng trong tương lai.
