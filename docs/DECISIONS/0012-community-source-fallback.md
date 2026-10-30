# 0012 — Nguồn cộng đồng dự phòng cho cloud Free

- Status: accepted
- Date: 2026-10-30
- Scope: manual sync, ingestion provenance, giao diện nguồn dữ liệu
- Sources: người dùng cho phép fallback cộng đồng có ghi nguồn và validation;
  [Data Pipeline](../DATA_PIPELINE.md), [cloud runbook](../DEPLOYMENT_FREE.md).

## Context

Cùng collector chạy local thành công nhưng Render nhận Cloudflare challenge từ
Vietlott và dừng với `Cloudflare challenge; deferred`. DB và gateway hoạt động.
Yêu cầu tiếp tục $0, máy cá nhân có thể tắt. Không vượt challenge hay dùng proxy.

## Options

- Giữ official-only: không lấy được kỳ mới khi nguồn chặn cloud.
- Nhập từ PC: phụ thuộc máy cá nhân bật.
- Nguồn cộng đồng opt-in: chạy trên cloud nhưng phải công khai độ tin cậy thấp hơn.

## Decision

Ưu tiên Vietlott. Chỉ manual sync có `LOTTO_COMMUNITY_FALLBACK_ENABLED=true`
và lượt chính thức thất bại do Cloudflare mới đọc JSONL cố định của
[vietvudanh/vietlott-data](https://github.com/vietvudanh/vietlott-data).
`power535`, `power645`, `power655` tương ứng ba game hiện có.

- Tối thiểu 20 kỳ lưu gần nhất phải khớp ID/ngày/main/special, không suy giờ quay.
- Chỉ thêm đuôi ID liên tiếp, tối đa 20 kỳ/lượt; kiểm domain, strict integer,
  ngày không tương lai và không đảo thứ tự, trùng ID, giới hạn kích thước feed.
- Một transaction cho toàn bộ kỳ mới/checkpoint/items; lỗi thì rollback toàn bộ.
  Giữ advisory lock, cooldown, audit và data version hiện có.
- Không ghi đè lịch sử, không sửa bằng feed và không nhập toàn bộ history cộng đồng.
  Không bỏ qua lỗ hổng checkpoint hoặc báo backlog bằng 0 khi còn unresolved.
- Lưu URL nguồn kèm ID và retrieval timestamp từng kỳ; audit đánh dấu community,
  nguồn và lý do fallback; response sync có `source`. UI hiển thị nguồn từng kỳ.
- Default local tắt; cloud bật có chủ đích. Scheduler vẫn tắt. Không fallback
  cho lỗi parse, conflict, timeout hoặc rate limit chưa được duyệt.

Kiểm tra trước triển khai: 60 kỳ gần nhất (20/game) khớp Neon. Đối chiếu toàn bộ
feed với lịch sử lưu: Lotto 976 khớp; Mega 1380 kỳ giao khớp, thiếu 197 kỳ đầu;
Power 1414 khớp, kỳ cũ `00944` sai ngày và thiếu special. Vì vậy chỉ kiểm và nhập
đuôi mới, tuyệt đối không dùng feed thay thế lịch sử đã xác thực. Lỗi cũ ngoài
đuôi được giữ ngoài phạm vi nhập; mismatch trong đuôi phải dừng để review.

## Consequences

Không cần migration hoặc dịch vụ trả phí. Feed có thể chậm hoặc lỗi; khi đó
giữ DB và báo thất bại, không cam kết cập nhật ngay sau giờ quay. Các kỳ dự phòng
không được gọi là đã đối chiếu chính thức độc lập: overlap là kiểm tra liên tục
dữ liệu, không xác nhận tính đúng của mọi kỳ mới. Có thể tiếp tục nhận dữ liệu
cộng đồng ở lần sau, nhưng vẫn phải kiểm overlap và gắn provenance.

Feed không có giải thưởng/giờ quay: để null. Truy vấn giải thưởng vẫn dùng
Vietlott và có thể chưa khả dụng trên Render. Việc đối soát/sửa sai tiếp tục qua
correction review chính thức, không tự sửa lịch sử.

## Validation

Regression tests dùng JSONL cố định và PostgreSQL thật: ba game, strict validation,
anchor mismatch, ID gap, chronology rollback, batch bound, idempotence, giữ nguồn
cũ, opt-in/challenge gate, per-game lock. Kiểm thử UI nhãn cộng đồng và đồng bộ
desktop/mobile; kết quả thực tế ghi ở [nghiệm thu](../SOURCE_FALLBACK_ACCEPTANCE.md).
