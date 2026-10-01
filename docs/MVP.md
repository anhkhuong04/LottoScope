# MVP: phạm vi và nghiệm thu

Nguồn: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md), mục 11/15 và
[wireframe.md](wireframe.md), mục 32/33. Hai tài liệu mô tả hai mốc khác nhau:
overview loại frontend implementation khỏi MVP backend; wireframe định nghĩa
MVP frontend. Dự án triển khai **backend trước, frontend sau**, rồi nghiệm thu
ứng dụng hoàn chỉnh. Tiến độ chi tiết ở [task.md](../task.md).

## Mốc B — Backend MVP

Hỗ trợ đúng hai game Lotto 5/35 và Mega 6/45. Luồng bắt buộc:

1. Import lịch sử từ nguồn xác định, lưu draw có nguồn và tự cập nhật kỳ mới;
   job chạy lại không nhân đôi dữ liệu.
2. Truy vấn latest draw, lịch sử theo ID/ngày/game và phân trang ổn định.
3. Phân tích frequency, gap, pair theo analysis window rõ ràng.
4. Kiểm tra main combination: exact match, overlap và lịch sử liên quan.
5. Sinh main combination theo rule được bật, có seed tùy chọn và explanation
   cho từng kết quả; báo rõ trường hợp không đủ kết quả.
6. FastAPI trả contract thống nhất; PostgreSQL/Alembic là nơi lưu dữ liệu;
   tests cho domain/analytics/ingestion và chạy được bằng Docker Compose.

Nghiệm thu mốc B theo 12 điều kiện ở overview mục 15, dựa trên dữ liệu kiểm
chứng của cả hai game và các check trong [task.md](../task.md), P8. Không dùng
việc route trả HTTP 200 thay bằng chứng dữ liệu đúng.

## Mốc F — Frontend MVP

Sau mốc B hoặc khi API tương ứng sẵn sàng, xây shell, dashboard, history,
numbers/detail, pairs/detail, checker và generator theo thứ tự wireframe mục 32.
Frontend đọc API thật, không tính lại nghiệp vụ. Nghiệm thu đủ 15 điều kiện
wireframe mục 33, bao gồm chuyển game/window, loading/empty/error, desktop và
mobile, input validation và explanation. Mốc F chỉ hoàn tất khi backend phục vụ
được các flow A–D ở wireframe mục 31.

## Mốc A — Ứng dụng MVP

Mốc B và F đều hoàn tất; người dùng có thể xem kết quả thực, phân tích, kiểm
tra và tạo combination từ một giao diện nhất quán. Checklist mốc ở cuối
[task.md](../task.md) là nơi đánh dấu tiến độ.

## Ngoài phạm vi

Strategy management/persistence, backtesting và random baseline là Phase 2.
Không gồm ML/AI prediction, score khả năng thắng, mua vé, multi-user, thanh
toán, saved picks, export, notification hay ROI. Domain và API MVP vẫn dùng
cutoff rõ để Phase 2 không cần diễn giải lại lịch sử.
