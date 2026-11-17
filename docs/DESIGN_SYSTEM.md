# LottoScope — Modern clean workspace

Áp dụng theo yêu cầu người dùng ngày 29/10/2026 và
[UI/UX audit](UI_UX_AUDIT.md). Đây là presentation system cho các màn hình
hiện tại; domain/API và [wireframe](wireframe.md) vẫn giữ thẩm quyền tương ứng.

## Nhận diện và typography

- Navy `#102b36`, teal `#006d67`, mint `#57d5bd`; nền main layout trắng thuần `#ffffff`.
- Main/special có label riêng; cầu main xanh lá `#15803d`, special đỏ `#b91c1c`,
  chữ số trắng `#ffffff` theo yêu cầu 03/11/2026. Áp dụng badges và khay kết quả.
  Riêng bóng bên trong máy 3D dùng teal/số trắng theo mẫu đã duyệt tại
  [DRAW_MACHINE_REDESIGN](DRAW_MACHINE_REDESIGN.md). Màu tần suất
  chỉ biểu diễn số kỳ đã xuất hiện, không diễn giải khả năng thắng.
- Brand mark dùng chung `/lottoscope.svg` trong sidebar/mobile/favicon.
- Outfit cho heading/số nổi bật, DM Sans cho nội dung, system fallback;
  số liệu dùng tabular numerals. Heading ngắn, mô tả và metadata phân cấp rõ.
- Layout phẳng không bọc ô wrap (yêu cầu 17/11/2026): các section, bảng dữ liệu,
  bộ lọc và danh sách đặt trực tiếp trên nền trắng thuần; không dùng viền hộp,
  đổ bóng hoặc bo góc card wrap. Phân tách bằng đường hairline divider `1px solid var(--line)`
  và khoảng cách whitespace.
- Spacing scale 4/8/12/16/24/32px; heading 1.5–1.875rem, section title 1.125rem,
  body 1rem và metadata 0.875rem. Tokens và override presentation tại `theme.css`.

## Bố cục và controls

- Header giữ game selector và thao tác Đồng bộ; mobile dùng icon kèm
  accessible name. Thông báo đồng bộ giữ tên game đã yêu cầu và cho phép đóng.
- Bỏ slogan, caption trang trí và kicker; h1 và mô tả có ý nghĩa giữ lại.
- Dashboard: kết quả mới nhất trước phân tích; bỏ bốn KPI trùng thông tin.
  Card không bị ép cùng chiều cao với nội dung dài bên cạnh. Có tóm tắt 6 số tần suất cao,
  5 cặp, 5 gap, 3 kỳ gần đây; đường dẫn tới phân tích/lịch sử đầy đủ.
- Cleanup 17/11/2026: loại bỏ 2 khối details 'thông tin dữ liệu' tại Dashboard
  và 'phương pháp thống kê' ở chân trang/sidebar để giao diện tối giản, tập trung dữ liệu.
  Màu nút bấm chuyển sang xám nhạt `#eef2f5` trên nền trắng; thêm nút 'Clear' xóa nhanh số tại trang Kiểm tra.
- Game selector chỉ có ba game frontend hỗ trợ: Lotto/Mega/Power. Không hiển
  thị game tương lai chưa có giao diện; giữ API game definitions độc lập.
- Toolbar phạm vi/sort/view dùng một nhóm có label; date-range giữ validation
  và URL như trước. Bảng desktop có vùng scroll/header sticky và keyboard
  focus; mobile bỏ giới hạn chiều cao, bảng phụ có thể cuộn ngang.
- Data Experience theo ADR 0014: bộ lọc đặt dưới page heading, dùng FilterBar
  chung. Phạm vi áp dụng/số kỳ thực tế/cutoff luôn đọc từ response context;
  metadata version vẫn nằm trong details. History nêu bộ lọc lịch sử riêng.
  Cùng tần suất cùng dense rank, tie xếp số/cặp tăng dần; dashboard ghi rõ
  danh sách rút gọn. Lotto special có nhóm riêng, không trộn cặp hoặc main.
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
Nghiệm thu cleanup ở [UI_REFRESH_ACCEPTANCE](UI_REFRESH_ACCEPTANCE.md);
trạng thái triển khai ở biên bản deployment.
