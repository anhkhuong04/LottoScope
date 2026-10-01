# Kiến trúc MVP

Mốc sản phẩm ở [MVP.md](MVP.md); nghiệp vụ ở [DOMAIN.md](DOMAIN.md) và
[ANALYTICS.md](ANALYTICS.md); schema ở [DATA_MODEL.md](DATA_MODEL.md).
Quyết định dài hạn được ghi ở [ADR 0001](DECISIONS/0001-mvp-architecture.md).

## Runtime và phụ thuộc

Một modular monolith Python **3.12**, PostgreSQL **16**. FastAPI/Pydantic
cho HTTP, SQLAlchemy 2.x/Alembic cho persistence/migration; httpx cho nguồn
và APScheduler cho collector.
uv quản lý dependency/lock; Ruff/Pyright/pytest cho quality.
Polars/NumPy chỉ thêm khi phép tính bảng thực sự cần; core MVP có thể tính
bằng Python/SQL. P1 khóa exact dependency versions trong `uv.lock`. Chọn
minor PostgreSQL 16 mới nhất có sẵn trong image đã kiểm tra khi bootstrap.

Frontend framework/runtime chưa chốt vì frontend là mốc F sau backend; P7-01
ghi ADR trước khi tạo app. UI chỉ gọi API, không giữ domain analytics riêng.

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

Docker Compose tối thiểu `backend` + `postgres`, persistent volume và health
checks. MVP chạy một API worker nếu APScheduler nằm cùng backend process;
PostgreSQL advisory lock bảo vệ job overlap. Dùng env typed cho URL/secret,
không commit `.env` thật. Migration chạy explicit trước phục vụ traffic;
không `create_all()` production. Log có game/draw/run/source context; route
không lộ lỗi nguồn hoặc traceback. Backup/restore thực hiện theo
[DATA_MODEL.md](DATA_MODEL.md).

Gates chạy từ `backend/`: `uv sync --locked`, Ruff check/format, Pyright,
pytest (gồm integration PostgreSQL). CI và README P1 dùng cùng commands.
Frontend gates được chọn sau ADR P7. Không thêm Redis/Celery, microservices
hoặc Kubernetes cho workload MVP.
