# LottoScope — Vietlott Analytics

Ứng dụng xem và phân tích **kết quả đã công bố** của Lotto 5/35, Mega 6/45 và Power 6/55. Gồm lịch sử, frequency/gap/pairs, checker và generator theo rule có giải thích; không dự đoán kỳ tiếp theo. Phạm vi ở [docs/MVP.md](docs/MVP.md), tiến độ ở [task.md](task.md), bằng chứng nghiệm thu MVP ở [docs/MVP_ACCEPTANCE.md](docs/MVP_ACCEPTANCE.md) và mở rộng Power ở [docs/POWER_ACCEPTANCE.md](docs/POWER_ACCEPTANCE.md).

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

Sau khi cập nhật image, backup trước khi chạy migration mới, rồi chạy lại `alembic upgrade head` và `docker compose up -d backend frontend --wait`. Kiểm tra `docker compose ps`, `docker compose logs backend frontend postgres` và readiness. Mặc định đồng bộ thủ công; nếu chủ động bật APScheduler, chỉ dùng một API worker và xem lịch/config tại [Data Pipeline](docs/DATA_PIPELINE.md#collector-kỳ-mới).

## Nhập dữ liệu và vận hành collector

Chi tiết `/history/:drawId` có bảng giải thưởng theo kỳ cho cả ba game.
Collector/import thu thập cùng kết quả quay; kỳ cũ chưa có bảng được bổ sung
khi mở chi tiết lần đầu và lưu PostgreSQL cho lần sau. Bảng có nguồn/thời điểm
riêng, tải độc lập và có thể thử lại khi Vietlott lỗi hoặc ingestion đang chạy.
Sau cập nhật Power, chạy migration `0005_power_655` theo quy trình ở trên.

Chọn game rồi nhấn **Tải dữ liệu** để backend lấy kỳ mới từ Vietlott, lưu
PostgreSQL và tải lại số liệu đang xem. Nút khóa trong lúc chạy; không có
kỳ mới thì báo đã kiểm tra nguồn. Mỗi game chờ ít nhất 60 giây giữa hai lượt;
nguồn lỗi thì giữ dữ liệu đã lưu và báo lỗi. Power còn thiếu lịch sử cũ sẽ
được nêu riêng, không quét toàn lịch sử khi bấm nút. **Làm mới hiển thị** ở
từng vùng chỉ đọc lại dữ liệu đã lưu.

Mặc định `LOTTO_SCHEDULER_ENABLED=false`; không có collector tự chạy khi
Docker khởi động. Máy đã từng cài task Windows cần tắt cả hai task bằng lệnh
bên dưới. Theo dõi backend bằng `docker compose logs -f backend`.

### Collector trên Windows khi nguồn chặn Docker

Ngày 15/10, Vietlott trả challenge/429 từ Docker; host Windows đọc được trong
lượt khôi phục nhưng cũng có thể bị chặn lại. Có thể dùng cùng collector trên
host, kết nối PostgreSQL Compose; không thay nguồn hoặc bypass challenge.

Đặt `LOTTO_SCHEDULER_ENABLED=false` trong `.env`, chạy `docker compose up -d
backend --wait`, rồi từ root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-local-sync.ps1 -Manual
Get-ScheduledTask -TaskName 'LottoScope*'
Get-ScheduledTaskInfo -TaskName 'LottoScope-LocalSync'
Get-Content .\collector-local.log -Tail 20
```

`-Manual` tắt `LottoScope-LocalSync` và `LottoScope-Reconcile`, không tạo lịch
mới hoặc chạy collector. Script không có `-Manual` là phương án tùy chọn để
khôi phục lịch 18:30/21:15 theo giờ Windows; không chạy lệnh đó nếu muốn giữ
đồng bộ thủ công. File `.env` được đọc lúc chạy, credential không nằm trong
task arguments. Poll latest trả exit 0 nếu latest đã được xác thực/lưu và chỉ
còn backlog lịch sử cũ; run trong DB vẫn `partial`. Với `-Reconcile`, còn
partial/failed vẫn exit 1. Lỗi nguồn, parse, DB hoặc conflict luôn báo lỗi;
exit 0 của poll không chứng minh history đầy đủ. Nguồn 429 giữ dữ liệu và đợi lượt sau.

Hai task ở trạng thái `Disabled` là đúng trong chế độ thủ công.

Chạy một lượt ngay: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
.\scripts\sync-local.ps1`; thêm `-Reconcile` để kiểm recent/backlog, tối đa
20 ID/game. Để chuyển về Docker: dừng/gỡ hai task bằng
`Unregister-ScheduledTask -TaskName 'LottoScope-LocalSync','LottoScope-Reconcile'
-Confirm:$false`, đặt `LOTTO_SCHEDULER_ENABLED=true`, recreate backend.

Import lịch sử có `--workers 1` để xử lý tuần tự (mặc định 3, tối đa 3).
Thêm `--results-only` nếu chỉ nhập ngày/kỳ quay, main numbers và special;
bỏ qua parser giải thưởng, không lưu snapshot/giá trị thưởng mới. Giải thưởng
đã lưu được giữ nguyên. Nguồn trả chung một trang HTML nên cờ này không giảm
số request hoặc bảo đảm tránh Cloudflare.
Kết hợp `LOTTO_SOURCE_REQUEST_INTERVAL=2.0` để giãn thời điểm bắt đầu request
ít nhất 2 giây; thời gian chờ nguồn có thể khiến mỗi kỳ lâu hơn. Đây là giới
hạn lưu lượng, không bảo đảm tránh Cloudflare. Challenge vẫn dừng batch và
giữ checkpoint; chi tiết lần thử ở [Power acceptance](docs/POWER_ACCEPTANCE.md).

Migration phải hoàn tất trước khi import. Các lệnh chạy trong backend container nên dùng đúng URL database trong `.env`:

```powershell
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game lotto_535
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game mega_645
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game power_655
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.audit_import --game lotto_535
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.audit_import --game mega_645
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.audit_import --game power_655
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.collect --game lotto_535
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.collect --game mega_645
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.collect --game power_655
```

Import mặc định quét từ `00001` đến ID mới nhất ở [Vietlott Lotto 5/35](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535) hoặc [Mega 6/45](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645), tối đa một request/giây mỗi game; chạy lại bỏ qua item đã `found`. Có thể giới hạn bằng `--start-id`, `--end-id`, `--from-date`, `--to-date`; `--recheck` kiểm lại draw đã có. Import theo phạm vi mẫu không chứng minh lịch sử đầy đủ. `audit_import` exit 0 chỉ khi ID từ đầu đến latest nguồn được quét, không có lỗi và các draw mẫu khớp nguồn. Collector yêu cầu checkpoint đầy đủ, kiểm tra kỳ mới và đối chiếu lại 7 kỳ gần nhất; chạy lặp phải giữ count/identity. Lỗi nguồn, parse hoặc conflict được ghi trong `ingestion_runs`, `ingestion_items`, `draw_corrections`; không áp dụng correction trước khi đối chiếu nguồn. Sau khi xác minh correction `123`, áp dụng có lý do bằng `docker compose run --rm --no-deps backend python -m app.commands.apply_correction 123 --reason "Đã đối chiếu nguồn"`. Xem policy chi tiết tại [docs/DATA_PIPELINE.md](docs/DATA_PIPELINE.md).

Power có sáu số chính trong 01–55 và một số đặc biệt khác main. Analytics,
checker và generator chỉ xử lý main; bảng giải mô tả Jackpot 2 là 5 main +
special, không tính thưởng vé. Nguồn Power là trang
[`655`](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/655?nocatche=1).
Import Power bắt đầu `00001` và dùng cùng throttle/resume/audit như hai game cũ.
Downgrade `0005` từ chối khi còn dữ liệu Power; dùng backup trước migration
nếu cần rollback. Không xóa dữ liệu Power hoặc volume để ép downgrade.

Nhịp truy cập nguồn mặc định là 1 giây/request. Có thể tăng
`LOTTO_SOURCE_REQUEST_INTERVAL` (ví dụ `2.0`) để giảm tốc khi Vietlott trả 429;
cấu hình từ chối giá trị dưới 1 giây. Import, collector, audit và bổ sung prizes
đều dùng cùng cấu hình. Giữ retry bounded/`Retry-After`; không tăng tốc hay
coi lượt nhập lỗi/partial là thành công. CLI có thể chạy từ `backend/` trên host
với `LOTTO_DATABASE_URL` trỏ đúng PostgreSQL ứng dụng ở `127.0.0.1` khi môi trường
container không truy cập được nguồn; giữ cùng adapter, validation và checkpoint.

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

Nếu release/migration lỗi, dừng traffic, giữ dump và image cũ, restore vào DB mới rồi trỏ bản image cũ sang DB đó sau khi đối chiếu. Không tự động `alembic downgrade`: downgrade `0004` xóa snapshot giải thưởng, `0003` xóa bảng tracking import, `0002` xóa cả draws/audit. Rollback code chỉ an toàn khi schema còn tương thích; nếu không, restore bản backup trước migration. Không xóa volume để rollback. Chi tiết schema và giới hạn ở [docs/DATA_MODEL.md](docs/DATA_MODEL.md).

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
- [ADR 0004](docs/DECISIONS/0004-collector-startup-catchup.md): đồng bộ sau khởi động; [ADR 0005](docs/DECISIONS/0005-draw-prizes.md): bảng giải thưởng theo kỳ.
- Migrations: `0001_baseline`, `0002_draw_storage`, `0003_ingestion_tracking`, `0004_draw_prizes`, `0005_power_655`.
- [ADR 0006](docs/DECISIONS/0006-power-655.md): game Power, special khác main và kế hoạch mở rộng.
- Mốc Power ngày 14/10/2026: code/deploy đã kiểm; full import/audit **còn mở do Vietlott 429/Cloudflare**. Dữ liệu Power hiện là lịch sử một phần, chưa có latest nguồn. Bằng chứng và lệnh resume ở [POWER_ACCEPTANCE.md](docs/POWER_ACCEPTANCE.md).
- [docs/MVP_ACCEPTANCE.md](docs/MVP_ACCEPTANCE.md): phiên bản/môi trường, kết quả gates, dữ liệu nguồn, 12 tiêu chí backend, 15 tiêu chí frontend và giới hạn còn lại.
- Phase 2 gồm strategy management/backtesting/random baseline/saved picks; phương pháp backtest còn phải chốt trước khi làm. Prediction, mua vé, thanh toán, ROI không thuộc MVP.
