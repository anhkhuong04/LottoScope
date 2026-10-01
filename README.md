# LottoScope — Vietlott Analytics

Ứng dụng phân tích dữ liệu lịch sử Lotto 5/35 và Mega 6/45. Hiện repository ở
**P2: domain và lưu trữ draw**; chưa có collector hoặc endpoint nghiệp vụ.
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
ứng dụng. Tests xóa dữ liệu trong các bảng P2 của **test database** giữa các ca.
Lệnh import lịch sử/collector sẽ được thêm ở P3.

Khi nguồn trả cùng `(game, draw_id)` với nội dung khác, repository lưu correction
`pending` và giữ draw hiện tại. Người vận hành xem bản ghi trong
`draw_corrections`, đối chiếu nguồn, rồi áp dụng có lý do bằng:

```powershell
uv run --locked python -m app.commands.apply_correction 123 --reason "Đã đối chiếu nguồn"
```

Lệnh chạy với `LOTTO_DATABASE_URL` hiện hành, cập nhật draw, audit và version
trong cùng transaction. Không dùng lệnh này trước khi kiểm tra nội dung nguồn.

## Cấu trúc

- `backend/app/`: FastAPI, domain, repository và DB session boundary.
- `backend/migrations/`: Alembic migrations.
- `backend/tests/`: domain và PostgreSQL integration tests; CI chạy quality gates.
- `docs/`: đặc tả sản phẩm, domain, analytics, pipeline, schema, API và ADR.
- `.agent/`, `AGENTS.md`: quy tắc bắt buộc cho agent.

Mọi thay đổi code đi qua quality gates trong
[.agent/WORKFLOW.md](.agent/WORKFLOW.md). `uv.lock` và migration được commit.
