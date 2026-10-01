# Hướng dẫn bắt buộc cho agent — Vietlott Analytics

Áp dụng cho toàn bộ repository và mọi thay đổi code, test, cấu hình, migration,
tài liệu hoặc quyết định kỹ thuật. Đọc file này trước khi làm việc.

## Quy trình đọc bắt buộc

1. Đọc [.agent/README.md](.agent/README.md) và
   [.agent/WORKFLOW.md](.agent/WORKFLOW.md).
2. Đọc [.agent/PROJECT_ANALYSIS.md](.agent/PROJECT_ANALYSIS.md) để hiểu phạm vi,
   trạng thái tài liệu và các điểm chưa được chốt.
3. Trước khi generate/review code, đọc các bộ quy tắc liên quan theo bảng trong
   `.agent/README.md` và các specification gốc tương ứng trong `docs/`.
4. Kiểm tra hướng dẫn `AGENTS.md` trong thư mục con nếu có; hướng dẫn cục bộ
   phải giữ các invariants của dự án và không tự mở rộng phạm vi sản phẩm.

## Các ràng buộc không được bỏ qua

- Xây dựng công cụ phân tích lịch sử, không thêm prediction, opaque AI score,
  mua vé tự động hoặc tuyên bố bảo đảm sinh lời.
- Domain rules tập trung theo game; không trộn `special_number` với main numbers.
- PostgreSQL là nguồn dữ liệu bền vững duy nhất; ingestion phải idempotent.
- Route chỉ xử lý HTTP; business logic nằm ở service/domain/analytics.
- Analytics phải deterministic; backtest chỉ nhìn dữ liệu trước kỳ đánh giá.
- Không tự chốt nghiệp vụ chưa có specification hoặc đưa Phase 2 vào MVP.
- Hoàn tất các kiểm chứng liên quan trong `.agent/WORKFLOW.md`; không báo kiểm
  chứng thành công khi chưa chạy hoặc còn lỗi.
- Sau khi hoàn thành một nhóm task lớn/mốc triển khai, tạo commit theo quy tắc
  version control trong `.agent/WORKFLOW.md`; không gộp thay đổi chưa kiểm chứng.

## Thứ tự giải quyết mâu thuẫn

Luôn tuân thủ chỉ dẫn hệ thống và yêu cầu trực tiếp hiện hành của người dùng.
Trong tài liệu dự án, ưu tiên: domain → architecture → feature specification
→ automated tests → implementation, theo `docs/PROJECT_OVERVIEW.md`, mục 16.
`docs/wireframe.md` có thẩm quyền về frontend experience, không ghi đè domain.
`.agent` diễn giải và bổ sung quy tắc engineering, không âm thầm thay requirement
trong `docs/`. Khi phát hiện mâu thuẫn, ghi rõ nguồn và xử lý theo
`.agent/WORKFLOW.md`.

Các quy tắc trong `.agent` là bắt buộc, không chỉ là tài liệu tham khảo.
