# UI-06 — Cleanup giao diện

Thực hiện inline theo yêu cầu và bảng quyết định của người dùng. Quy tắc UX
ở DESIGN_SYSTEM và wireframe sẽ cập nhật theo kết quả; không đổi backend/API,
routes tính năng, domain, query windows hoặc thuật toán thống kê/vật lý.

- [x] Shell: bỏ slogan, caption sidebar và kicker trang. Chỉ liệt kê Lotto,
  Mega, Power trong selector; game chưa hỗ trợ không hiện hoặc được chọn qua URL.
- [x] Dashboard: bỏ bốn KPI trùng lặp; giữ kết quả mới nhất, tần suất, cặp, gap
  và kỳ gần đây. Tần suất/cặp giữ số liệu tại danh sách hiện có.
- [x] Dữ liệu: bỏ refresh thành công; giữ loading, empty, stale và retry lỗi,
  cùng nút Đồng bộ tự refresh sau thao tác. Gom data version/count thực tế vào
  details trạng thái, không lặp pill ở cuối trang.
- [x] Giải thích: di chuyển cảnh báo sidebar sang details Phương pháp thống kê
  cuối nội dung, có link từ sidebar và vẫn truy cập được trên mobile.
- [x] Presentation: scale spacing 4/8/12/16/24/32, card radius16, padding24/16,
  heading/body/metadata nhất quán; responsive, focus, target44px, reduced motion.
- [x] Kiểm thử RED→GREEN cho DataState/PageHead/context, shell cleanup, selector,
  thay bộ lọc tự cập nhật và retry; cập nhật tests dùng KPI/refresh cũ.
- [x] Chạy lint/format/typecheck/unit/build; E2E các trang desktop/tablet/mobile,
  axe và xem screenshot dashboard/numbers/checker. Review độc lập, commit nhóm
  UI-06. Không deploy/rebuild Docker hoặc gộp file riêng của người dùng.

## Ràng buộc kiểm tra

Giữ count thực tế trong trạng thái vì phạm vi yêu cầu có thể lớn hơn history.
Chỉ ẩn game frontend chưa hỗ trợ; không đổi definitions API. Giữ query keys,
thứ tự dữ liệu, main/special, lựa chọn bộ lọc và stale/late-response behavior.
CSS sửa tại rule hiện có, không bổ sung stylesheet/theme hoặc dependency mới.

## Kết quả

Review đã xử lý: metadata không phụ thuộc /status success và giữ đúng version
analytics, wrapper giữ layout latest ổn định qua loading/error, summary báo rõ
loading/stale/error ngay khi đóng. Test hồi quy ở cleanup-metadata.spec.ts.
Gates frontend đạt; 63 unit tests, 93 E2E liên quan đạt và 6 skip theo device.
Nghiệm thu, giới hạn và lượt kiểm tra lại ghi tại UI_REFRESH_ACCEPTANCE.md.
