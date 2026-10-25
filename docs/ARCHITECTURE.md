# Kiến trúc MVP

Mốc sản phẩm ở [MVP.md](MVP.md); nghiệp vụ ở [DOMAIN.md](DOMAIN.md) và
[ANALYTICS.md](ANALYTICS.md); schema ở [DATA_MODEL.md](DATA_MODEL.md).
Quyết định dài hạn được ghi ở [ADR 0001](DECISIONS/0001-mvp-architecture.md).

## Runtime và phụ thuộc

Một modular monolith Python **3.12**, PostgreSQL **16**. FastAPI/Pydantic
cho HTTP, SQLAlchemy 2.x/Alembic cho persistence/migration; httpx cho nguồn
và APScheduler cho collector.
uv quản lý dependency/lock; Ruff/Pyright/pytest cho quality.
Polars/NumPy chỉ thêm khi phép tính bảng thực sự cần; core MVP tính bằng
Python/SQL. Backend dùng `uv.lock`; PostgreSQL dùng image `postgres:16`.

Frontend chọn React/TypeScript + Vite, React Router và `lucide-react` tại
[ADR 0002](DECISIONS/0002-frontend-stack.md). Bản build được Nginx phục vụ
cùng origin với `/api` theo [ADR 0003](DECISIONS/0003-compose-frontend.md).
UI chỉ gọi API, không giữ domain
analytics riêng.

Ngoại lệ cục bộ sau MVP: [lồng cầu](DRAW_SIMULATION.md) dùng Three.js/Fiber/Rapier
để mô phỏng chuyển động và lấy main theo game definition (Lotto năm số;
Mega/Power sáu số); Lotto tiếp tục quay một special từ lồng riêng 1–12.
Session controller giữ main/special riêng và thay pool vật lý giữa hai lượt;
không thay analytics backend hay schema.

## Luồng và boundaries

```text
Vietlott pages → source adapter/parser → domain validation → ingestion service
                                                        ↓
FastAPI routes → application services → repositories → PostgreSQL
                      ↓
            analytics / checker / generator
```

`api/` xử lý HTTP/validation/mapping; `games/` giữ game definitions;
`ingestion/` cô lập HTML và retry; `repositories/` giữ SQL; `analytics/`,
`generators/` là logic có input/output typed; `jobs/` chỉ trigger service.
Services điều phối transaction và policy, không đặt business logic trong route.
Phân chia module theo cấu trúc đề xuất overview mục 10, chỉ tạo phần được dùng.

Core analytics nhận draw records đã validate, game/window/cutoff/reference
date. Không import FastAPI, ORM session hay HTTP client vào phép tính pure.
Read query lấy dataset đúng window một lần trong use case; explanation dùng
cùng kết quả đã tính, không tính lại trên dataset khác. `data_version` dùng
để nhận diện dữ liệu thay đổi; không thêm cache trước khi có nhu cầu đo được.

## Chạy và vận hành

Docker Compose chạy `frontend` + `backend` + `postgres`, persistent volume và health
checks. MVP chạy một API worker nếu APScheduler nằm cùng backend process;
PostgreSQL advisory lock bảo vệ job overlap. Dùng env typed cho URL/secret,
không commit `.env` thật. Migration chạy explicit trước phục vụ traffic;
không `create_all()` production. Log có game/draw/run/source context; route
không lộ lỗi nguồn hoặc traceback. Schema/giới hạn rollback ở
[DATA_MODEL.md](DATA_MODEL.md); lệnh backup, restore vào DB riêng và đối chiếu API ở
[README](../README.md#backup-restore-và-rollback).

Gates chạy từ `backend/`: `uv sync --locked`, Ruff check/format, Pyright,
pytest (gồm integration PostgreSQL). CI và README dùng cùng commands.
Frontend gates theo ADR 0002 và CI frontend. Không thêm Redis/Celery,
microservices hoặc Kubernetes cho workload MVP.
