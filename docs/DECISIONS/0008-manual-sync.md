# 0008 — Đồng bộ bằng nút Tải dữ liệu

- Status: accepted
- Date: 2026-10-20
- Scope: collector API, frontend và vận hành local.
- Source: yêu cầu chuyển từ lịch cố định sang nút tải dữ liệu của người dùng.

## Quyết định

Nút **Tải dữ liệu** dùng game đang chọn, gọi collector latest-only hiện có,
lưu PostgreSQL rồi làm mới dữ liệu hiển thị. Không quét toàn lịch sử Power.
Các nút tải lại từng vùng chỉ đọc dữ liệu đã lưu và được đổi nhãn cho rõ.

API POST chạy service trong worker thread, trả kết quả sau khi collector xong;
không tạo hệ thống queue/worker riêng. Tái sử dụng giới hạn 20 ID, validation,
prizes, checkpoint và correction policy của pipeline hiện có. PostgreSQL
advisory lock chặn manual request trùng trên mọi game/process; lock ingestion
theo game vẫn bảo vệ trước import. Cooldown mỗi game 60 giây sau một lượt
collector hoàn tất, kể cả lỗi, được kiểm tra từ DB trước khi gọi nguồn.

Giao diện khóa nút khi chạy, nêu rõ game đã yêu cầu; đổi game không gán kết
quả cũ cho game mới. Kết thúc luôn tải lại dữ liệu đã lưu, kể cả khi một phần
đã lưu trước lỗi. Partial chỉ vì backlog cũ được trả thành công kèm số ID còn
thiếu; lỗi nguồn/parse hoặc correction conflict không được gán thành công.

Hai task Windows tự động đều tắt; Docker scheduler vẫn false. Script cài lịch
cũ chỉ dùng khi chủ động muốn quay lại chế độ tự động. Không tự bật lịch khi
đăng nhập hoặc Docker khởi động. Backend trực tiếp đọc nguồn; nếu Vietlott
chặn Docker, hiển thị lỗi và vẫn giữ dữ liệu; lệnh host thủ công còn dùng được.

## Kiểm chứng

- Ruff lint/format, Pyright và **192 backend tests pass** trên PostgreSQL test
  riêng, gồm ba game, cooldown/idempotence, overlap và source failure. Không
  có migration hoặc thay đổi schema. 10 deprecation warnings có sẵn.
- Frontend lint/format/typecheck/build, **19 unit tests pass** (Vitest threads;
  lần thử fork worker bị timeout khởi tạo, không tính là test pass).
- Compose build/readiness đạt; runtime scheduler false, hai task Windows
  Disabled. Review độc lập không phát hiện vấn đề trọng yếu.
- Bấm nút thật trên Compose: run **462**, response 200, thêm **2 Lotto**, latest
  **00956 ngày 19/10/2026**, không có backlog. UI hiện đúng thông báo và số
  liệu sau refresh; đã xem desktop/mobile screenshot, mobile không overflow.
- E2E lượt đầu 65 pass/4 skip; ba ca Power retry còn tìm nhãn refresh cũ.
  Đã sửa selector sang “Làm mới hiển thị”; cả ba ca rerun pass. Tổng cộng
  **68 ca E2E đã pass, 4 skip theo thiết bị**, gồm sáu ca manual sync mới.
