# LottoScope — Vietlott Analytics

Ứng dụng xem và phân tích **kết quả đã công bố** của Lotto 5/35 và Mega 6/45. MVP gồm lịch sử, frequency/gap/pairs, checker và generator theo rule có giải thích; không dự đoán kỳ tiếp theo. Phạm vi ở [docs/MVP.md](docs/MVP.md), tiến độ ở [task.md](task.md), bằng chứng nghiệm thu ở [docs/MVP_ACCEPTANCE.md](docs/MVP_ACCEPTANCE.md).

## Chạy ứng dụng bằng Docker Compose

Cần Docker Desktop/Compose. Chạy PowerShell tại root repository:

```powershell
Copy-Item .env.example .env
# Sửa POSTGRES_PASSWORD và password đã URL-encode trong LOTTO_DATABASE_URL cho khớp.
docker compose config --quiet
docker compose build backend frontend
docker compose up -d postgres --wait
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend alembic upgrade head
docker compose up -d backend frontend --wait
Invoke-RestMethod http://127.0.0.1:8000/health/ready
Invoke-RestMethod http://127.0.0.1:8088/api/v1/games
```

Mở `http://127.0.0.1:8088` (frontend), `http://127.0.0.1:8000/docs` (API). Nginx phục vụ SPA deep links và proxy `/api/` cùng origin; có thể đổi `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT` trong `.env` nếu cổng bận. Các cổng chỉ bind loopback. `/health/live` kiểm tra process; `/health/ready` đòi PostgreSQL kết nối được và migration ở head. `docker compose down` giữ volume; **không dùng `down -v` nếu muốn giữ dữ liệu**. `.env` không được commit. Cấu hình này dành cho triển khai thử cục bộ, chưa bao gồm TLS/public ingress.

Sau khi cập nhật image, backup trước khi chạy migration mới, rồi chạy lại `alembic upgrade head` và `docker compose up -d backend frontend --wait`. Kiểm tra `docker compose ps`, `docker compose logs backend frontend postgres` và readiness. Một backend worker bật APScheduler; không scale backend khi scheduler còn nằm trong process này. Giờ poll có thể chỉnh bằng `LOTTO_LOTTO_POLL_FIRST`, `LOTTO_LOTTO_POLL_SECOND`, `LOTTO_MEGA_POLL`, `LOTTO_RECONCILE_POLL` (`HH:MM`, giờ Việt Nam).

## Nhập dữ liệu và vận hành collector

Migration phải hoàn tất trước khi import. Các lệnh chạy trong backend container nên dùng đúng URL database trong `.env`:

```powershell
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game lotto_535
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game mega_645
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.audit_import --game lotto_535
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.audit_import --game mega_645
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.collect --game lotto_535
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.collect --game mega_645
```

Import mặc định quét từ `00001` đến ID mới nhất ở [Vietlott Lotto 5/35](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535) hoặc [Mega 6/45](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645), tối đa một request/giây mỗi game; chạy lại bỏ qua item đã `found`. Có thể giới hạn bằng `--start-id`, `--end-id`, `--from-date`, `--to-date`; `--recheck` kiểm lại draw đã có. Import theo phạm vi mẫu không chứng minh lịch sử đầy đủ. `audit_import` exit 0 chỉ khi ID từ đầu đến latest nguồn được quét, không có lỗi và các draw mẫu khớp nguồn. Collector yêu cầu checkpoint đầy đủ, kiểm tra kỳ mới và đối chiếu lại 7 kỳ gần nhất; chạy lặp phải giữ count/identity. Lỗi nguồn, parse hoặc conflict được ghi trong `ingestion_runs`, `ingestion_items`, `draw_corrections`; không áp dụng correction trước khi đối chiếu nguồn. Sau khi xác minh correction `123`, áp dụng có lý do bằng `docker compose run --rm --no-deps backend python -m app.commands.apply_correction 123 --reason "Đã đối chiếu nguồn"`. Xem policy chi tiết tại [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md).

## Backup, restore và rollback

Tạo custom-format dump của database `lotto`; sao chép archive **ra ngoài container** và lưu ở vị trí backup được quản lý:

```powershell
docker compose exec -T postgres pg_dump -U lotto -d lotto -Fc --no-owner --no-acl -f /tmp/lotto.dump
$pgContainer = docker compose ps -q postgres
docker cp "${pgContainer}:/tmp/lotto.dump" .\lotto.dump
```

Restore vào database **khác**, không ghi đè database đang phục vụ. Kiểm tra tên `lotto_restore_check` chưa tồn tại trước khi tạo; bản dump chứa schema và Alembic version:

```powershell
docker compose exec -T postgres createdb -U lotto lotto_restore_check
$pgContainer = docker compose ps -q postgres
docker cp .\lotto.dump "${pgContainer}:/tmp/lotto_restore.dump"
docker compose exec -T postgres pg_restore -U lotto -d lotto_restore_check --no-owner --no-acl --exit-on-error /tmp/lotto_restore.dump
docker compose exec -T postgres psql -U lotto -d lotto -c "SELECT game,count(*),max(draw_id) FROM draws GROUP BY game ORDER BY game"
docker compose exec -T postgres psql -U lotto -d lotto_restore_check -c "SELECT game,count(*),max(draw_id) FROM draws GROUP BY game ORDER BY game"
```

Đối chiếu thêm `source_sha256`, main/special numbers và draw mẫu; kiểm tra API với một backend tạm trỏ tới DB restore. Có thể copy `.env` thành `.env.restore` (file này được Git ignore), đổi **chỉ** database cuối `LOTTO_DATABASE_URL` thành `lotto_restore_check`, rồi chạy:

```powershell
$restoreApi = docker compose --env-file .env.restore run -d --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false -p 127.0.0.1:18001:8000 backend
Invoke-RestMethod http://127.0.0.1:18001/health/ready
Invoke-RestMethod http://127.0.0.1:18001/api/v1/games/lotto_535/draws/latest
docker stop $restoreApi
```

Nếu release/migration lỗi, dừng traffic, giữ dump và image cũ, restore vào DB mới rồi trỏ bản image cũ sang DB đó sau khi đối chiếu. Không tự động `alembic downgrade`: downgrade `0003` xóa bảng tracking import, downgrade `0002` xóa cả draws/audit. Rollback code chỉ an toàn khi schema còn tương thích; nếu không, restore bản backup trước migration. Không xóa volume để rollback. Chi tiết schema và giới hạn ở [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

## Phát triển và kiểm tra

Backend cần uv/Python 3.12, frontend cần Node.js 22.12+. Quality gates:

```powershell
# Trong backend/
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked pyright
# LOTTO_TEST_DATABASE_URL phải trỏ tới DB *_test đã migrate, dùng 127.0.0.1 trên Windows.
uv run --locked pytest

# Trong frontend/
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Backend integration tests **truncate bảng trong test database**; tuyệt đối không trỏ `LOTTO_TEST_DATABASE_URL` vào DB ứng dụng. Tạo DB bằng `docker compose exec -T postgres createdb -U lotto lotto_test`, migrate với `LOTTO_DATABASE_URL` trỏ DB test trước khi chạy suite. Frontend dev dùng `npm run dev`, Vite proxy `/api` tới backend cổng 8000. Browser tests mặc định chạy Vite; đặt `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8088` để kiểm tra bản Compose đã build. API contract ở [docs/API.md](docs/API.md).

## Tài liệu và trạng thái

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) và [ADR 0001–0003](docs/DECISIONS/0003-compose-frontend.md): boundaries, stack và Compose frontend.
- Migrations: `0001_baseline`, `0002_draw_storage`, `0003_ingestion_tracking`.
- [docs/MVP_ACCEPTANCE.md](docs/MVP_ACCEPTANCE.md): phiên bản/môi trường, kết quả gates, dữ liệu nguồn, 12 tiêu chí backend, 15 tiêu chí frontend và giới hạn còn lại.
- Phase 2 gồm strategy management/backtesting/random baseline/saved picks; phương pháp backtest còn phải chốt trước khi làm. Prediction, mua vé, thanh toán, ROI không thuộc MVP.
