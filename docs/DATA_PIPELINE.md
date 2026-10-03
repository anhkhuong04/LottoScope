# Nguồn và pipeline kết quả quay

Domain/identity ở [DOMAIN.md](DOMAIN.md), lưu trữ ở
[DATA_MODEL.md](DATA_MODEL.md). Database là nguồn dữ liệu đã xác thực của ứng
dụng; website ngoài chỉ là nguồn nhập và đối chiếu.

## Nguồn MVP và bằng chứng truy cập

Nguồn chính cho cả lịch sử và kỳ mới là trang kết quả chính thức Vietlott:

| Game | Trang theo kỳ | Mẫu đã đọc trực tiếp ngày 01/10/2026 |
| --- | --- | --- |
| Lotto 5/35 | `https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id={draw_id}&nocatche=1` | [`00001`](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00001&nocatche=1) ngày 29/06/2025; [`00829`](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00829&nocatche=1) và [`00830`](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00830&nocatche=1) cùng 17/08/2026 |
| Mega 6/45 | `https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645?id={draw_id}&nocatche=1` | [`00001`](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645?id=00001&nocatche=1) ngày 20/07/2016; [`01530`](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645?id=01530&nocatche=1) ngày 01/07/2026 |

Ngày kiểm tra, HTTP GET từ môi trường dự án trả 200 và HTML có ID/ngày kỳ
được yêu cầu. **Quan sát quan trọng:** URL có `id` nhưng thiếu `nocatche=1`
có thể trả HTML kỳ mới nhất thay cho kỳ yêu cầu. Vì thế HTTP 200 chưa đủ:
parser phải so `game`, `draw_id`, ngày và đủ main/special từ nội dung. Trang
không là API ổn định; access, cấu trúc HTML và quyền sử dụng cần kiểm tra lại
khi triển khai P3. Không sử dụng một nguồn bên thứ ba im lặng khi nguồn chính
không truy cập được.

## Import lịch sử

1. Fetch trang mới nhất của từng game và parse `draw_id` làm upper bound;
   kiểm tra ID hợp lệ, không tin số kỳ ghi ở query nếu nội dung khác.
2. Từ `00001` đến upper bound, fetch từng ID 5 chữ số với `nocatche=1`.
   Throttle mặc định tối đa 1 request/giây mỗi nguồn; lưu checkpoint theo
   game/ID. Mỗi ID có `found`, `missing`, `invalid` hoặc `failed` rõ ràng;
   import giới hạn theo ngày có thêm `excluded`, không xem là đã persist.
3. Parse HTML qua adapter riêng → validate theo game → normalize → persist.
   Không tự suy số còn thiếu từ HTML lân cận hay cho qua trang 200 sai ID.
4. Cuối batch, đối chiếu số draw, first/latest ID, ngày và mẫu ngẫu nhiên
   với trang chính thức. Mọi lỗ hổng ID được ghi và retry/review; không tuyên
   bố import đầy đủ khi còn ID `missing/failed/invalid` chưa được giải thích.

Import là resumable; một transaction cho **một draw và cập nhật checkpoint**.
Draw lỗi không làm rollback toàn lịch sử, nhưng job tổng thể là `partial`/
`failed`, không báo `success`. Chạy lại không tạo bản sao.

## Collector kỳ mới

Lịch ban đầu theo giờ Việt Nam, có thể đổi bằng config khi lịch Vietlott đổi:
Lotto kiểm tra 14:00 và 22:30 hằng ngày; Mega kiểm tra 19:30 thứ Tư/Sáu/
Chủ nhật; cả hai reconcile 07:00 hằng ngày. Lịch công bố hiện tại được mô tả
trên trang [Lotto](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00830&nocatche=1)
và [Mega](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645?id=01530&nocatche=1).
Giờ poll là giờ **kiểm tra**, không là `draw_time` và không bảo đảm kết quả
đã được đăng đúng lúc đó.

Mỗi lần poll lấy latest ID, rồi backfill mọi ID từ ID đã xử lý gần nhất đến
latest và retry các lỗ hổng tồn. Nếu chưa có local history, dùng import riêng
thay vì ngầm backfill toàn lịch sử trong một poll. Không dùng điều kiện
"latest page không đổi" để bỏ qua các ID còn thiếu/correction. Reconcile
gần nhất kiểm tra lại 7 ID cuối; khác nội dung đi theo correction policy.

## Retry, duplicate, correction

- HTTP connect/read timeout 10 giây mỗi request; tối đa 3 attempts với
  exponential backoff có jitter cho timeout/429/5xx. `Retry-After` trên 60 giây
  được hoãn sang lượt sau, không retry sớm. 4xx khác 429, HTML
  không đúng schema, game/ID không khớp hoặc số sai được báo lỗi/quarantine,
  không retry mù. Tôn trọng `Retry-After` và giảm tốc nếu bị rate limit.
- `(game, draw_id)` unique ở PostgreSQL. Insert dùng transaction và DB
  conflict handling, không chỉ check-before-insert. Payload canonical bằng
  nhau: không đổi draw, ghi `attempted_at` trong `ingestion_items`; khác
  nhau: **không tự overwrite**.
- Content conflict tạo record correction chờ review gồm old/new payload,
  source URL, fetch time và hash; job báo `conflict`. Một lệnh apply correction
  có chủ đích cập nhật draw + audit revision trong cùng transaction, tăng
  `data_version`. Không có cơ chế tự suy rằng bản mới luôn đúng.
- Mọi job ghi started/finished, game, phạm vi, counters, status và lỗi có
  context. Log không chứa secret hoặc toàn HTML nguồn. Collector từ chối chạy
  khi lịch sử `00001..checkpoint` chưa được quét đầy đủ; import phạm vi mẫu
  không thể bị nhầm là toàn bộ lịch sử.

## Scheduler và vận hành

APScheduler chạy trong **một process** backend ở Compose MVP. Không mở nhiều
API workers cùng khởi scheduler; dùng advisory lock PostgreSQL theo game/job
để ngăn overlap kể cả trigger tay. Scheduler gọi cùng ingestion service với
manual import. Khi sau này scale backend, phải tách job runner hoặc đổi cơ chế
ownership trước; không nhân bản scheduler. Khi bật scheduler, mỗi lần backend
khởi động tạo một lượt collector nền cho mỗi game để bù kỳ bỏ lỡ lúc máy/Docker
tắt; không chặn HTTP và không chờ cron kế tiếp. Lượt này dùng checkpoint, retry
và khóa của collector hiện có; không tự import lịch sử trống. Nếu lỗi nguồn,
lượt sau theo lịch sẽ thử lại. Quyết định ở [ADR 0004](DECISIONS/0004-collector-startup-catchup.md).
`last_successful_ingestion_at` và
`last_failed_ingestion_at` được hiển thị riêng với `latest_draw_date`.
