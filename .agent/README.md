# Bộ quy tắc làm việc của agent

Thư mục này chứa quy tắc bắt buộc cho việc generate code, review và đưa quyết
định trong Vietlott Analytics. Điểm vào là [AGENTS.md](../AGENTS.md) ở gốc dự án.

`PHẢI` và `KHÔNG ĐƯỢC` là ràng buộc bắt buộc. `NÊN` là hướng ưu tiên; nếu chọn
cách khác, giải thích bằng use case hoặc bằng chứng cụ thể. Yêu cầu người dùng
hiện hành có ưu tiên cao hơn quy tắc repository; thay đổi đã được yêu cầu phải
được phản ánh nhất quán vào specification và quy tắc chịu ảnh hưởng.

## Bản đồ tài liệu

| File | Vai trò | Khi phải đọc |
| --- | --- | --- |
| [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | Phân tích sản phẩm, scope, khoảng trống và trình tự triển khai | Bắt đầu task, chọn milestone, thay đổi scope |
| [CODING_STANDARDS.md](CODING_STANDARDS.md) | Kiến trúc, Python, dependency và chất lượng code | Mọi task generate/review backend hoặc cấu hình |
| [DOMAIN_ANALYTICS.md](DOMAIN_ANALYTICS.md) | Game invariants, normalization, analytics, generator, backtest | Mọi thay đổi xử lý số, metric, rule hoặc dữ liệu kết quả |
| [DATA_API.md](DATA_API.md) | Ingestion, persistence, migration, API contract | Collector, repository, DB, API và tích hợp frontend/backend |
| [FRONTEND.md](FRONTEND.md) | Giao diện, state, accessibility và phạm vi frontend | Task frontend, UI review hoặc API phục vụ màn hình |
| [WORKFLOW.md](WORKFLOW.md) | Quy trình quyết định, kiểm chứng và Definition of Done | Mọi task |

Nguồn gốc hiện có:

- [PROJECT_OVERVIEW.md](../docs/PROJECT_OVERVIEW.md): WHAT/WHY, domain cơ bản,
  stack backend, MVP backend, Phase 2 và nguyên tắc engineering.
- [wireframe.md](../docs/wireframe.md): frontend structure, user flow, state,
  responsive behavior và acceptance criteria giao diện.

Các nguồn chuẩn P0 đã được tạo trong `docs/`: [MVP.md](../docs/MVP.md),
[DOMAIN.md](../docs/DOMAIN.md), [ANALYTICS.md](../docs/ANALYTICS.md),
[DATA_PIPELINE.md](../docs/DATA_PIPELINE.md),
[DATA_MODEL.md](../docs/DATA_MODEL.md),
[ARCHITECTURE.md](../docs/ARCHITECTURE.md),
[API.md](../docs/API.md) và [ADR](../docs/DECISIONS/0001-mvp-architecture.md).
Chỉ những phần được ghi rõ trong các file này mới được xem là quyết định đã chốt.

## Ranh giới của bộ quy tắc

- Các ràng buộc sản phẩm được rút từ hai tài liệu gốc; các chuẩn code, kiểm
  chứng và quy trình quyết định là quy ước engineering được thiết lập ở đây.
- Những nội dung còn mở được ghi rõ trong `PROJECT_ANALYSIS.md`, không được
  biến thành yêu cầu đã được duyệt bằng cách đưa vào code.
- Không nhân bản toàn bộ specification vào `.agent`; khi requirement đổi,
  cập nhật nguồn gốc và các quy tắc chịu ảnh hưởng trong cùng thay đổi.
- `AGENTS.md` giúp agent phát hiện hướng dẫn. CI backend ở
  `.github/workflows/backend.yml` chạy quality gates đã thiết lập trong P1;
  domain/API/ingestion tests được bổ sung theo từng giai đoạn sau.
