# Ảnh minh họa LottoScope

Chụp từ https://lottoscope-sable.vercel.app ngày **30/10/2026 (giờ Việt Nam)**,
không dùng dữ liệu mock hoặc chỉnh sửa nội dung ảnh. Dữ liệu trong ảnh là
snapshot tại thời điểm chụp; không dùng để xác định kỳ mới nhất hiện tại.

| File | Màn hình / trạng thái | Kích thước viewport |
| --- | --- | --- |
| `dashboard.png` | Tổng quan Mega 6/45, 30 kỳ gần nhất, nguồn cộng đồng hiển thị rõ | 1440 × 1040 |
| `numbers.png` | Lưới tần suất Mega 6/45 trong 30 kỳ | 1440 × 1040 |
| `checker.png` | Đối chiếu main `01 09 11 28 33 42`, một lần trùng chính xác trong lịch sử | 1440 × 1040, chụp toàn trang |
| `draw-machine.png` | Lồng Lotto 5/35 và vùng special, sẵn sàng trước khi quay | 1440 × 1040 |
| `mobile-dashboard.png` | Tổng quan Mega 6/45, menu di động | 390 × 844 |

Khi cập nhật ảnh, dùng cùng tên file để giữ link trong [README chính](../../../README.md).
Chờ dữ liệu và lồng cầu tải xong trước khi chụp; giữ game và phạm vi áp dụng.
Ảnh hiện tại là snapshot UI cũ; UI từ 03/11/2026 ẩn tên nhà cung cấp theo ADR 0013,
cầu xanh/đỏ chữ trắng và thống kê special theo ADR 0014. Không sửa ảnh cũ để
giả lập giao diện mới; chỉ thay ảnh sau khi chụp lại bản đã triển khai.
Không đưa secrets, dashboard quản trị hoặc dữ liệu cá nhân vào ảnh.

## Thiết kế lồng cầu local — 03/11/2026

`machine-preview-static.png`: chụp canvas thật từ source local tại
`/generator/preview?game=power_655`, góc phối cảnh, 55 bóng teal bố trí tĩnh,
khung trắng/acrylic. Đây là bản duyệt thiết kế, **chưa tích hợp Rapier**, không
phải ảnh website online hoặc kết quả quay. Không thay ảnh `draw-machine.png`
của bản đang triển khai. Phân tích và phạm vi ở [DRAW_MACHINE_REDESIGN](../../DRAW_MACHINE_REDESIGN.md).

`machine-integrated.png`: bản Docker local sau khi tích hợp Rapier, viewport
1365 × 900, chụp toàn trang Power 6/55 hoàn tất 6 số chính. Phối cảnh cố định,
khung trắng/acrylic và bóng teal; kết quả do phiên mô phỏng thật trong browser,
không phải kỳ quay chính thức. Mẫu đã được duyệt; ảnh tĩnh phía trên giữ làm
mốc lịch sử. Chưa cập nhật website online hoặc các ảnh online cũ.
