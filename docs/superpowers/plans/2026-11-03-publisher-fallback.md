# Thay nguồn dự phòng và đơn giản hóa giao diện đồng bộ

> Thực hiện inline theo yêu cầu hiện hành; áp dụng executing-plans và TDD.

**Goal:** Bỏ GitHub JSONL, dùng Minh Chính cho Lotto và Minh Ngọc cho Mega/Power.
**Architecture:** Adapter HTML riêng; giữ service append-only, 20 anchors, tối đa
20 kỳ mới, transaction, challenge gate, khóa và cooldown. Giữ provenance trong
DB/API/audit, bỏ tên/đường dẫn nhà cung cấp trên UI theo yêu cầu mới.
**Tech Stack:** HTMLParser chuẩn Python, httpx hiện có, React và Lucide hiện có.
**Spec:** Yêu cầu người dùng 03/11/2026; DATA_PIPELINE, DOMAIN, ADR 0012 và bản cập
nhật ADR 0013 trong cùng milestone. Không thay production state hoặc deploy.

## Ràng buộc và review

- Không suy ID từ vị trí/ngày; Minh Chính công bố ID không padding, adapter chỉ
  thêm zero để khớp identity 5 chữ số, không thay giá trị ID.
- HTML trực tiếp chưa đủ bóng phải lỗi; không nhập số placeholder.
- Pagination chỉ theo liên kết đã thấy, host/path allowlist, tối đa 12 trang/lượt.
- Hai kỳ Lotto cùng ngày phải giữ hai ID; special tách riêng, được trùng main.
- Lỗi trang sau hoặc dữ liệu overlap lệch phải không ghi bất kỳ kỳ nào.
- Bỏ tên nguồn trên dashboard/history/notice nhưng giữ timestamp thu thập.

## Task 1 — Adapter và ingestion

- [x] Viết tests HTML fixture ba game, ID/date/domain, pagination, bounds và
  provenance; đổi fixture integration JSONL thành HTML, giữ tests atomic/idempotent.
- [x] Chạy tests mới, xác nhận đỏ trước implementation.
- [x] Tạo `backend/app/ingestion/publishers.py`: `feed_url(game)`,
  `parse_feed(body, game, lower, retrieved)`, `load_draws(fetcher, game, lower)`.
  Service community giữ tên/API cũ để tương thích cấu hình; bỏ parser/URL GitHub.
- [x] Chạy Ruff, Pyright và toàn bộ backend pytest với PostgreSQL *_test.

## Task 2 — UI và tài liệu

- [x] Đổi tests SyncControls/E2E: nút Đồng bộ, notice không tên nguồn, dấu ×
  góc phải có accessible name và target 44px; dismiss cả success/error.
- [x] Chạy tests đỏ; sửa SyncControls, Dashboard, History, api helper và CSS.
- [x] Chạy frontend lint/type/format/unit/build và E2E sync desktop/mobile.
- [x] Cập nhật contract nguồn, ADR, README và nghiệm thu, dẫn chiếu thay vì lặp.
- [x] Review diff, kiểm chứng, commit riêng các file task; giữ nguyên thay đổi
  có sẵn của người dùng (xóa task.md/task-deloy.md và logo.png).

## Tiến độ / quyết định

- Baseline: deploy/free-cloud @573da0d; làm trong workspace hiện tại để các thay
  đổi hiển thị trong IDE đang dùng, không đổi branch hoặc tác động file người dùng.
- Bằng chứng nguồn: Minh Chính 00965–00984 khớp DB local 20/20; không suy ra
  Render truy cập được từ kiểm tra local. Live checks bổ sung, tests dùng fixtures.
- Ruling: tăng giới hạn từ 8 lên 12 trang vì Minh Chính thường có 5–6 cards,
  pagination lặp boundary; cần đủ 20 anchors + 20 kỳ mới, vẫn bounded I/O.

- Hoàn tất: backend 271 tests; frontend 60 tests, sync E2E 6/6 và prizes 12/12.
  Review redirect đã sửa và kiểm tra lại; nghiệm thu chi tiết ở SOURCE_FALLBACK_ACCEPTANCE.
