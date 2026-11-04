# DATA-01 — Nghiệm thu thống kê special và Data Experience

Ngày: **03/11/2026**. Phạm vi đã chốt tại [ADR 0014](DECISIONS/0014-special-number-data-experience.md).

## Kết quả triển khai

- Lotto 5/35 có nhóm **Số đặc biệt 01–12** trong trang Số và widget Dashboard.
  List/detail dùng chung phạm vi phân tích; detail có lịch sử phân trang.
  Chỉ số và công thức được mô tả tại [ANALYTICS](ANALYTICS.md), contract tại [API](API.md).
- Dashboard, history, numbers và pairs dùng thanh lọc dưới heading. Thống kê
  hiển thị phạm vi response, số kỳ thực tế và cutoff; lịch sử hiển thị bộ lọc riêng.
  Các response độc lập có scope riêng khi refresh chỉ thành công một phần.
- Số/cặp đồng tần suất cùng hạng; danh sách Dashboard ghi rõ giới hạn và tie-break.
  Cầu chính xanh lá, cầu phụ đỏ, chữ trắng ở lịch sử, analytics và khay kết quả.
  Bóng trong máy 3D về sau theo mẫu đã duyệt tại [DRAW_MACHINE_REDESIGN](DRAW_MACHINE_REDESIGN.md).

## Kiểm chứng

- Backend: Ruff, format, Pyright; **280 tests passed** trên PostgreSQL `*_test`.
  Fixtures tính tay chứng minh main/special isolation, tỷ lệ/gap/rank, phân trang,
  cutoff cùng ngày, last-10 clipping, khoảng ngày rỗng và giới hạn API theo game.
- Frontend: lint, format, typecheck, production build; **64 tests passed**.
  Build còn cảnh báo kích thước chunk 3D lazy-load đã có.
- Browser regression trên desktop/tablet/mobile: **108 ca đã qua các lượt chạy**;
  6 ca chỉ dành cho một loại thiết bị được skip có điều kiện. Lượt cuối **12/12**
  bao phủ special list/detail, đổi nhóm khi response đến muộn, stale special và
  WCAG trên 9 route. Kiểm responsive 48 tổ hợp route/breakpoint chạy riêng đã qua.
  Liên kết inline đã thêm gạch chân; bài WCAG chờ dữ liệu/opacity ổn định thay vì
  quét giữa hiệu ứng hiện nội dung. Không tăng timeout hoặc bỏ kiểm tra contrast.
- Đã xem ảnh local Dashboard desktop/mobile, bảng special và detail với dữ liệu
  snapshot thật; đối chiếu phạm vi áp dụng, phân biệt màu/nhãn và bố cục.
- Hai phiên quay Lotto vật lý thật trong browser (desktop/mobile) đã qua:
  5 main + 1 special, màu khay xanh/đỏ chữ trắng, axe, copy và handoff checker.
  Không đổi engine vật lý hoặc dùng backend để chọn kết quả mô phỏng.

## Trạng thái vận hành

Tại mốc DATA-01 chỉ kiểm chứng source local: backend QA tắt scheduler/fallback, dùng bản sao
DB riêng; các lượt Đồng bộ trong browser test được mock, không gọi nhà cung cấp.
Không sửa DB ứng dụng, rebuild Docker, push hoặc deploy website online.
Ảnh trong README vẫn là snapshot online cũ, được ghi chú tại [screenshot README](images/screenshots/README.md).

Sau khi người dùng duyệt mô hình, Docker local được cập nhật cả backend/frontend
trong [DRAW-VIS-02](superpowers/plans/2026-11-03-draw-machine-integration.md).
Bằng chứng vận hành local nằm tại checklist đó. Public được cập nhật ngày
04/11/2026, ghi nhận tại [biên bản cloud](DEPLOYMENT_ACCEPTANCE.md).
