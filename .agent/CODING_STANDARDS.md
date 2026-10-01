# Quy tắc kiến trúc và coding

Nguồn stack/boundaries: `docs/PROJECT_OVERVIEW.md`, mục 8–10, 13.
Các quy ước coding chi tiết bên dưới bổ sung chuẩn engineering cho dự án.

## 1. Module boundaries

Giữ modular monolith. Ưu tiên cấu trúc `backend/app/` được overview đề xuất;
chỉ tạo module khi có implementation/use case thực tế.

| Module | Trách nhiệm | Không được chứa |
| --- | --- | --- |
| `api/`, `schemas/` | HTTP routing, request/response contract, dependency injection, mapping lỗi | Thuật toán analytics, SQL/query nghiệp vụ trong route |
| Application services | Điều phối use case, transaction, repository và domain | HTML parsing, presentation/UI |
| `games/` | Game definitions, validation và domain invariants tập trung | HTTP, scheduler, database session |
| `analytics/`, `generators/`, `strategies/`, `backtesting/` | Logic tính toán/rule, input và output có kiểu rõ | Network I/O, global DB session, UI formatting |
| `repositories/`, `models/`, `db/` | SQLAlchemy persistence, query, session/config DB | Scraping, HTTP response, prediction/scoring |
| `ingestion/sources/`, `parsers/`, `validators/` | Fetch/parse nguồn ngoài, chuyển sang domain input hợp lệ | Rule chiến lược hoặc logic route |
| `jobs/` | Trigger application use case, quản lý lifecycle job | Bản sao thuật toán ingestion/analytics |

Không bắt buộc tạo `services/` hoặc interface repository trống; nếu cần
application service, đặt tên và vị trí nhất quán, document trong architecture.
Logic tính toán không phụ thuộc ORM/FastAPI. Tách ORM model, API schema và
domain value khi ranh giới cần nó; không ép một object phục vụ mọi layer.

## 2. Python và naming

- PHẢI dùng type hints cho function/method và public data structures.
  Dữ liệu không tin cậy được validate/narrow type tại boundary trước vào core.
- Dùng `snake_case` cho module/function/variable, `PascalCase` cho class,
  `UPPER_SNAKE_CASE` cho constant; identifier tiếng Anh, tên theo domain.
- Ưu tiên hàm nhỏ, một trách nhiệm, early return và composition. Không viết
  helper/framework tổng quát khi chưa có use case lặp lại thực tế.
- Docstring giải thích contract, đơn vị đo, boundary cases và lý do; comment
  giải thích quyết định khó thấy, không diễn đạt lại từng dòng code.
- Không dùng mutable default arguments, global mutable state, implicit clock,
  global RNG hay import có side effect mở DB/network/start scheduler.
- Không dùng `Any`, `type: ignore` hoặc suppression lint để che thiếu modeling.
  Ngoại lệ boundary thư viện phải thu hẹp scope và có lý do.
- Không copy magic numbers game vào analytics/routes/UI/tests độc lập.
  Fixture có literal dữ liệu kỳ quay là hợp lệ; invariant/range phải lấy từ
  game definition, test vẫn có expected result tính tay độc lập.

## 3. I/O, errors và configuration

- Inject repository, source adapter, clock và RNG ở nơi cần để tests deterministic.
- Async dùng cho I/O phù hợp; không gọi synchronous HTTP hoặc analytics CPU
  nặng trực tiếp trong async route. Chọn cơ chế chạy dựa trên workload đo được.
- Bắt lỗi cụ thể tại boundary; không `except Exception: pass`, không trả success
  khi ingestion thất bại. Broad catch chỉ ở job/process boundary để log/report
  và giữ nguyên trạng thái failure.
- Domain error không phụ thuộc HTTP status; API layer map sang error contract.
- Settings typed và tập trung, lấy từ environment; không hard-code credentials,
  database URL thực, token hoặc ghi secret vào logs. `.env.example` chỉ placeholder.
- Log có context game/draw/job/source và failure reason; không log toàn request
  hoặc payload nguồn khi không cần. Không dùng `print` làm logging runtime.
- Mọi vòng lặp retry/generation và external I/O phải có giới hạn rõ.

## 4. Dependencies và tooling

- Dùng `uv` quản lý backend dependencies trong `pyproject.toml`; commit `uv.lock`
  khi khởi tạo project. Tách runtime/dev dependencies.
- Không thêm package nếu standard library hoặc dependency có sẵn giải quyết
  rõ ràng; giải thích mục đích khi thêm. Không đổi stack vì sở thích của agent.
- Chọn phiên bản Python và cấu hình Ruff/Pyright phù hợp trong task bootstrap;
  ghi decision, không tự xem một phiên bản chưa chọn là requirement gốc.
- Cấu hình Ruff lint/format, Pyright và pytest; type checking nghiêm cho core.
  Không hạ gate hoặc bỏ test để làm change pass.
- Polars/NumPy chỉ trong processing/analytics; API trả schema/DTO có kiểu rõ,
  không trả DataFrame trực tiếp. Không đưa thư viện analytics vào mọi module.
- Docker Compose ban đầu chỉ các service thực sự cần; scheduler ownership
  phải rõ khi backend chạy nhiều worker, tránh mỗi worker khởi chạy cùng job.

## 5. Phạm vi thay đổi

- Giải quyết use case được yêu cầu; không tự thêm auth, payment, shared base
  framework, caching/distributed queue hoặc scaffolding Phase 2.
- Giữ diff tập trung; không format/refactor toàn repository trong task cục bộ.
- Không sửa test hoặc docs chỉ để hợp thức hóa implementation sai.
- Breaking API/schema thay đổi phải có migration/compatibility plan phù hợp.
- Khi tối ưu, phải có bottleneck cụ thể; kết quả đúng và contract ổn định là
  điều kiện trước khi thay thuật toán hoặc thêm cache.
