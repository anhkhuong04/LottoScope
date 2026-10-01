# LottoScope — Vietlott Analytics

Ứng dụng phân tích dữ liệu lịch sử Lotto 5/35 và Mega 6/45. Hiện repository ở
**P3: import và collector**; chưa có endpoint nghiệp vụ cho history/analytics.
Tiến độ và điều kiện nghiệm thu: [task.md](task.md). Contract: [docs/](docs/).

## Chạy backend với Docker Compose

Cần Docker Desktop/Compose. Trong PowerShell tại root repository:

```powershell
Copy-Item .env.example .env
# Sửa POSTGRES_PASSWORD và LOTTO_DATABASE_URL trong .env cho khớp nhau.
docker compose build backend
docker compose up -d postgres
docker compose run --rm backend alembic upgrade head
docker compose up -d backend
Invoke-RestMethod http://localhost:8000/health/live
Invoke-RestMethod http://localhost:8000/health/ready
```

`/health/live` chỉ xác nhận process; `/health/ready` cần kết nối PostgreSQL
và migration đang ở head. API docs ở `http://localhost:8000/docs`. `POSTGRES_PORT`
và `BACKEND_PORT` trong `.env` chỉ bind loopback trên host. Nếu password có ký
tự đặc biệt, URL-encode phần password trong `LOTTO_DATABASE_URL`. File `.env`
được Git ignore; `.env.example` chỉ chứa placeholder.

Sau khi sửa code, chạy `docker compose build backend` rồi
`docker compose up -d backend`. Xem lỗi bằng
`docker compose logs backend postgres`. `docker compose down` dừng services
nhưng giữ volume; **không thêm `-v`** nếu muốn giữ dữ liệu.

## Phát triển backend tại máy

Cài [uv](https://docs.astral.sh/uv/getting-started/installation/) và Docker.
Từ `backend/`:

```powershell
uv python install 3.12
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked pyright
$env:LOTTO_TEST_DATABASE_URL = 'postgresql+psycopg://lotto:change-me@localhost:5432/lotto_test'
uv run --locked pytest
```

Để chạy API/migration từ host, khởi PostgreSQL qua Compose và đặt
`LOTTO_DATABASE_URL` bằng URL trong `.env` nhưng đổi host `postgres` thành
`localhost`, dùng `POSTGRES_PORT` nếu đổi port. Ví dụ PowerShell với password
placeholder ban đầu:

```powershell
$env:LOTTO_DATABASE_URL = 'postgresql+psycopg://lotto:change-me@localhost:5432/lotto'
uv run --locked alembic upgrade head
uv run --locked uvicorn app.main:app --reload
```

Integration tests cần database `lotto_test` riêng đã chạy `alembic upgrade head`;
ví dụ tạo bằng `docker compose exec -T postgres createdb -U lotto lotto_test`,
sau đó đặt `LOTTO_DATABASE_URL` trỏ tới `lotto_test` để migrate và đặt lại URL
ứng dụng. Tests xóa dữ liệu ingestion/draw trong **test database** giữa các ca.

## Nhập lịch sử và kiểm tra collector

Migrate DB trước, chạy lệnh sau từ `backend/` với `LOTTO_DATABASE_URL` trỏ đúng
DB ứng dụng. Import mặc định quét từ `00001` đến ID mới nhất trên Vietlott, tối
đa một request/giây mỗi game; hai game có thể chạy riêng. Trạng thái từng ID
và checkpoint lưu ở PostgreSQL, chạy lại sẽ bỏ qua ID đã `found` và thử lại ID
thiếu/lỗi. `--recheck` buộc đối chiếu lại nội dung đã lưu.

```powershell
uv run --locked python -m app.commands.import_history --game lotto_535
uv run --locked python -m app.commands.import_history --game mega_645
uv run --locked python -m app.commands.import_history --game lotto_535 --start-id 00829 --end-id 00830 --from-date 2026-08-17 --to-date 2026-08-17
uv run --locked python -m app.commands.ingestion_status --game lotto_535
uv run --locked python -m app.commands.audit_import --game lotto_535
uv run --locked python -m app.commands.audit_import --game mega_645
uv run --locked python -m app.commands.collect --game lotto_535
```

Mỗi ID và trạng thái item/checkpoint commit trong một transaction. `partial` hoặc
`failed` trả exit code khác 0; xem `ingestion_runs`, `ingestion_items` để xử lý
ID lỗi rồi chạy lại. `excluded` ghi ID ngoài date filter, không tính là đã nhập.
Collector chỉ chạy khi các ID từ `00001` đến checkpoint đã được quét và không
có `excluded`; khi đó nó kiểm tra kỳ mới, thử lại ID lỗi và đối chiếu 7 kỳ gần
nhất. Import một phạm vi mẫu không chứng minh toàn bộ lịch sử đã đầy đủ.
`audit_import` đối chiếu ID mới nhất, số draw/item, các ID chưa quét, trạng thái
lỗi, chronology, provenance và các kỳ mẫu với nguồn; exit code 0 chỉ khi toàn
dải từ `00001` đến latest khớp và không còn lỗ hổng/lỗi.

Compose bật APScheduler trong **một** backend worker, theo giờ Việt Nam. Giờ
poll có thể đổi bằng `LOTTO_LOTTO_POLL_FIRST`, `LOTTO_LOTTO_POLL_SECOND`,
`LOTTO_MEGA_POLL`, `LOTTO_RECONCILE_POLL` trong `.env` (định dạng `HH:MM`).
Import thủ công và scheduler dùng cùng PostgreSQL advisory lock theo game để
tránh chạy chồng. Nếu triển khai nhiều API worker, cần tách scheduler thành
một process có ownership riêng trước khi tăng số worker.

Khi nguồn trả cùng `(game, draw_id)` với nội dung khác, repository lưu correction
`pending` và giữ draw hiện tại. Người vận hành xem bản ghi trong
`draw_corrections`, đối chiếu nguồn, rồi áp dụng có lý do bằng:

```powershell
uv run --locked python -m app.commands.apply_correction 123 --reason "Đã đối chiếu nguồn"
```

Lệnh chạy với `LOTTO_DATABASE_URL` hiện hành, cập nhật draw, audit và version
trong cùng transaction. Không dùng lệnh này trước khi kiểm tra nội dung nguồn.

## Cấu trúc

- `backend/app/`: FastAPI, domain, ingestion, jobs, repository và DB boundary.
- `backend/migrations/`: Alembic migrations.
- `backend/tests/`: domain và PostgreSQL integration tests; CI chạy quality gates.
- `docs/`: đặc tả sản phẩm, domain, analytics, pipeline, schema, API và ADR.
- `.agent/`, `AGENTS.md`: quy tắc bắt buộc cho agent.

Mọi thay đổi code đi qua quality gates trong
[.agent/WORKFLOW.md](.agent/WORKFLOW.md). `uv.lock` và migration được commit.
