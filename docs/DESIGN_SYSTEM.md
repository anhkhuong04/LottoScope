# LottoScope — Modern clean workspace

Áp dụng theo yêu cầu người dùng ngày 29/10/2026 và
[UI/UX audit](UI_UX_AUDIT.md). Đây là presentation system cho các màn hình
hiện tại; domain/API và [wireframe](wireframe.md) vẫn giữ thẩm quyền tương ứng.

## Nhận diện và typography

- Navy `#102b36`, teal `#006d67`, mint `#57d5bd`; nền sáng và card trắng.
- Main/special có label riêng; amber hỗ trợ nhận diện special. Màu tần suất
  chỉ biểu diễn số kỳ đã xuất hiện, không diễn giải khả năng thắng.
- Brand mark dùng chung `/lottoscope.svg` trong sidebar/mobile/favicon.
- Outfit cho heading/số nổi bật, DM Sans cho nội dung, system fallback;
  số liệu dùng tabular numerals. Heading ngắn, mô tả và metadata phân cấp rõ.
- Card radius 16 px, viền nhẹ; chỉ card kết quả mới nhất có tint/gradient nhẹ.
  Card tĩnh không có hiệu ứng nâng lên khi hover để tránh gợi ý có thể bấm.

## Bố cục và controls

- Header giữ game selector và thao tác Tải dữ liệu; mobile dùng icon kèm
  accessible name. Thông báo đồng bộ giữ tên game đã yêu cầu và cho phép đóng.
- Dashboard: kết quả mới nhất trước KPI; mobile KPI 2 × 2. Card không bị ép
  cùng chiều cao với nội dung dài bên cạnh. Có tóm tắt 6 số tần suất cao,
  5 cặp, 5 gap, 3 kỳ gần đây; đường dẫn tới phân tích/lịch sử đầy đủ.
- Chi tiết thời gian đồng bộ/data version mở rộng bằng details; không có
  badge “Live” khi nguồn đang lỗi. Dashboard dùng một nút refresh chỉ đọc;
  retry riêng vẫn có ở từng phần lỗi.
- Toolbar phạm vi/sort/view dùng một nhóm có label; date-range giữ validation
  và URL như trước. Bảng desktop có vùng scroll/header sticky và keyboard
  focus; mobile bỏ giới hạn chiều cao, bảng phụ có thể cuộn ngang.
- Number tile có số, tần suất và thanh tỷ lệ theo maximum trong cùng phạm vi;
  legend ghi rõ cách đọc. Có table view để đọc đầy đủ chỉ số.
- Checker có slot minh họa và số lượng đã chọn; kết quả không bị giả lập.
  Submit thành công trang đầu đưa focus tới kết quả, phân trang similar không
  kéo focus trở lại đầu phần kết quả.

## Loading, navigation và motion

- Skeleton chỉ xuất hiện khi chưa có dữ liệu, có status/busy cho screen reader.
  Sau 8 giây có giải thích đang kết nối; không hứa thời gian tải. Refresh cùng
  context giữ dữ liệu, lỗi có thông báo stale/retry; đổi context không giữ nhầm.
- Menu Thêm là popover điều hướng, không trap focus. Mở focus link đầu;
  Escape đóng và trả focus trigger; chạm ngoài đóng. Route mới focus main,
  điều hướng PUSH/REPLACE về đầu; không ép scroll với POP hoặc đổi query.
- Skip link, visible focus và target chính ≥44 px theo chuẩn dự án.
- Motion tokens 140/220 ms: hover/press controls, phản hồi chart/hero nhẹ;
  animation dùng opacity/transform. Số liệu hiện ngay, không count-up/quay số
  trong analytics. Physics lồng cầu giữ nguyên trong module riêng.
- Reduced motion tắt các animation trang/chart/skeleton/spinner và dịch chuyển
  hover/press; trạng thái tải vẫn có chữ và disabled/busy. Lồng cầu giữ tùy
  chọn ẩn hình ảnh chuyển động đã có.

## Implementation và kiểm chứng

Base styles ở `frontend/src/index.css`, lớp presentation mới ở
`frontend/src/theme.css`; controls dùng lại trong `ui.tsx`. Không thêm
dependency animation/chart. Kiểm chứng trước release gồm frontend gates,
E2E desktop/tablet/mobile, breakpoint edges, axe và kiểm hình ảnh thật.
Nguồn trạng thái triển khai/giới hạn ở `task.md` và biên bản deployment.
