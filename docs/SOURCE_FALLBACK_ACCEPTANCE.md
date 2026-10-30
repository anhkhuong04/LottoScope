# SOURCE — Khôi phục cập nhật dữ liệu cloud

Ngày 30/10/2026, nhánh `deploy/free-cloud`, phạm vi theo
[ADR 0012](DECISIONS/0012-community-source-fallback.md).

- [x] SOURCE-01: xác định nguyên nhân official Cloudflare challenge trên Render;
  cùng collector local trả 200, cloud 503, audit Neon xác nhận challenge.
- [x] SOURCE-02: fallback opt-in append-only, audit/provenance, UI thông báo nguồn;
  backend Ruff/format/Pyright, 240 pytest với PostgreSQL; frontend lint/format/
  typecheck/build và 60 unit tests đạt. Không migration. Compose config hợp lệ.
- [ ] SOURCE-03: release Render/Vercel và xác nhận cập nhật dữ liệu thực qua gateway.

## Kiểm thử trước release

26 regression tests mới dùng feed cố định, không phụ thuộc GitHub/Vietlott live.
Bao phủ ba game, giữ riêng main/special, không suy giờ quay, strict integer,
duplicate/range/count/date, duplicate ID, bỏ qua nội dung lịch sử ngoài đuôi,
anchor mismatch, thiếu ID, chronology rollback, batch >20, append/idempotence,
provenance lịch sử không đổi, audit lỗi, flag và loại lỗi kích hoạt, advisory lock.
Full suite 240 tests đạt; sau khi bổ sung thêm 2 ca history thiếu/không có
reference, toàn bộ 26 regression tests đạt. Playwright sync 6/6 đạt trên desktop,
tablet và mobile; thông báo và link nguồn cộng đồng hiển thị đúng.

Full pytest chạy trên PostgreSQL local dedicated `lotto_cloud_20261029_test`,
không dùng Neon production để truncate/test. 10 warnings deprecation hiện có
từ Starlette/Alembic. Build frontend còn cảnh báo bundle DrawScene lớn hiện có.
Frontend build dùng Vite 8.3.2 theo lockfile hiện tại.

## Giới hạn và rollback

Nguồn cộng đồng không bảo đảm cập nhật tức thì; validation overlap không thay
đối chiếu chính thức cho từng kỳ mới. Thiếu prize/time giữ null. Khi validation
hoặc fetch lỗi, giữ DB và báo lỗi. Tắt `LOTTO_COMMUNITY_FALLBACK_ENABLED` để
ngừng nhập fallback, không xóa hoặc sửa các kỳ đã nhập. History/corrections
vẫn theo policy cũ. Không thêm cron/worker trả phí hoặc dependency vào PC.
