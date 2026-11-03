# 0013 — Thay nguồn dự phòng bằng các trang kết quả trực tiếp

- Status: accepted
- Date: 2026-11-03
- Scope: manual sync, source adapters, presentation
- Sources: yêu cầu người dùng thay GitHub bằng Minh Ngọc/Minh Chính và ẩn tên
  nguồn trên UI; thay phần lựa chọn publisher/presentation của ADR 0012.

## Decision

Vietlott vẫn là nguồn chính. Bỏ hoàn toàn fetch/parser GitHub JSONL; fallback:

| Game | Trang khởi đầu |
| --- | --- |
| Lotto 5/35 | https://www.minhchinh.com/xo-so-dien-toan-lotto-535.html |
| Mega 6/45 | https://www.minhngoc.net.vn/ket-qua-xo-so/dien-toan-vietlott/mega-6x45.html |
| Power 6/55 | https://www.minhngoc.net.vn/ket-qua-xo-so/dien-toan-vietlott/power-6x55.html |

HTML adapter chỉ đọc khối kết quả có mã kỳ/ngày và đủ main/special. Minh Chính
công bố `#985`: chuẩn hóa thành `00985`, không suy mã từ lịch hoặc vị trí bảng.
Chỉ theo dated links đã xuất hiện đúng host/path của game, tối đa 12 trang,
2 MB/trang. Trang chưa đủ bóng, conflict hoặc thiếu coverage phải lỗi.

Giữ nguyên bảo vệ tại ADR 0012: opt-in/challenge gate, 20 kỳ đối chiếu, tối đa
20 kỳ mới liên tiếp, append-only, transaction, cooldown và audit. Không tự lấy
giải thưởng hoặc giờ quay trong adapter này; không dùng fallback cho import.
Tên setting `LOTTO_COMMUNITY_FALLBACK_ENABLED` và API `source=community` giữ
để tương thích. Chúng chỉ nhóm nguồn bên thứ ba, không chỉ GitHub cũ.

UI không hiển thị tên/link nhà cung cấp; provenance thật vẫn lưu ở DB/API/audit,
kể cả URL GitHub của kỳ lịch sử. Nút ghi **Đồng bộ**; thông báo đóng bằng icon
× góc trên phải, accessible label giữ cho trình đọc màn hình.

## Validation và giới hạn

Fixtures và PostgreSQL regression tests phải kiểm identity, domain, paging,
rollback/idempotence, anchor mismatch và challenge gate. Kiểm chứng thực tế ở
[SOURCE_FALLBACK_ACCEPTANCE](../SOURCE_FALLBACK_ACCEPTANCE.md).
HTTP 200 từ local không chứng minh truy cập được từ Render; không cam kết độ
trễ hay availability của website ngoài. Không có migration, không sửa lịch sử.
