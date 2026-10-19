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

### Mở rộng Power 6/55 — 14/10/2026

Trang nguồn: `https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/655?id={draw_id}&nocatche=1`.
Đã đọc trực tiếp `00001` (01/08/2017, main `05 10 14 23 24 38`, special `35`)
và `01385` (15/08/2026, main `16 20 25 27 30 50`, special `02`).
Nguồn Power dùng CSS `mega645`/`maga645_table` như Mega; adapter phải kiểm
đúng cả path `655`, tiêu đề `Power 6/55`, ID và số, không suy game từ CSS.
Special có `active`; bảng Jackpot 2 dùng `O O O O O | <span class="active">O</span>`.
Parser kiểm đúng năm hạng và điều kiện `(6,false),(5,true),(5,false),(4,false),(3,false)`.
Core tests dùng fixture cố định; live fetch chỉ phục vụ import/audit/smoke.

Power poll mặc định 19:30 thứ Ba/Năm/Bảy (`LOTTO_POWER_POLL`), reconcile 07:00
hằng ngày và startup catch-up như các game hiện có. Lịch quay 18:00 lấy từ
[hướng dẫn chơi](https://vietlott.vn/vi/choi/power-6-55/cach-choi); giờ poll
không được lưu thành `draw_time`. Import phải quét `00001..latest` trước khi
collector chạy; missing/failed/invalid không được xem là lịch sử đầy đủ.

### Quy trình chung

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

Với scheduler trong Docker, ngoài cron còn kiểm tra latest mỗi 5 phút
(`LOTTO_LATEST_POLL_MINUTES`, 5–60). Ba game chạy tuần tự, chung fetcher/throttle; poll nhanh không recheck
lịch sử cũ. Cron/startup/lệnh `collect` vẫn đối chiếu recent và retry backlog.

Cấu hình local Windows hiện dùng hai lượt latest-only **18:30 và 21:15 mỗi
ngày, UTC+07**, thay lịch 5 phút/đăng nhập và reconcile tự động 07:00.
Docker scheduler tắt; thao tác cài lịch và đối chiếu thủ công ở
[README](../README.md#collector-trên-windows-khi-nguồn-chặn-docker).

Mỗi lần poll lấy latest ID, rồi bù các ID mới trong giới hạn batch. Lượt
cron/startup/`collect` đối chiếu thêm recent và các lỗ hổng tồn. Nếu chưa có local history, dùng import riêng
thay vì ngầm backfill toàn lịch sử trong một poll. Không dùng điều kiện
"latest page không đổi" để bỏ qua các ID còn thiếu/correction. Reconcile
gần nhất kiểm tra lại 7 ID cuối; khác nội dung đi theo correction policy.

Mỗi collector xử lý tối đa 20 ID: lưu draw latest đã validate ngay từ lần
fetch đầu, không tải lại cùng ID; sau đó bù ID chưa scan theo thứ tự tăng,
recent và backlog theo lần thử cũ nhất. Latest ghi trước không được đẩy
checkpoint qua ID chưa thử, kể cả khi persist latest lỗi. Chỉ nâng checkpoint
đến latest khi mọi ID trước đó đã scan. `remaining_unresolved` đếm ID chưa
found đến source latest; còn thiếu thì run `partial`, không tuyên bố history
đầy đủ. Quyết định/vận hành local ở [ADR 0007](DECISIONS/0007-fast-collection.md).

## Retry, duplicate, correction

### Bảng giải thưởng

Adapter đọc bảng `chitietketqua_table` đúng game cùng trang theo kỳ: 7 hạng
Lotto, 4 hạng Mega; validate heading, tên/thứ tự hạng, điều kiện main/special
và integer có dấu phân tách hàng nghìn. Thiếu bảng cho phép nhập kết quả quay
với snapshot chưa biết; bảng hiện diện nhưng malformed phải báo lỗi.

Collector/import lưu cả bảng nếu có. Kỳ đã lưu chưa có snapshot được bổ sung
bằng import giới hạn đúng ID, `recheck=True`, khi gọi API bảng giải; dùng cùng
advisory lock, throttle, retry, run/item và checkpoint. Counter `enriched` đếm
snapshot được bổ sung lần đầu, không tăng số draw/`inserted`. Conflict bảng
đã biết đi theo correction dưới đây; domain policy ở
[DOMAIN.md](DOMAIN.md#bảng-giải-thưởng-công-bố).

### Xử lý lỗi và thay đổi nguồn

- HTTP connect/read timeout 10 giây mỗi request; tối đa 3 attempts với
  exponential backoff có jitter cho timeout/429/5xx. `Retry-After` trên 60 giây
  được hoãn sang lượt sau, không retry sớm. 4xx khác 429, HTML
  không đúng schema, game/ID không khớp hoặc số sai được báo lỗi/quarantine,
  không retry mù. Tôn trọng `Retry-After` và giảm tốc nếu bị rate limit.
  `LOTTO_SOURCE_REQUEST_INTERVAL` mặc định 1 giây, chỉ cho phép >=1 và hữu hạn;
  tăng giá trị để giảm tốc cho import/collector/audit/enrichment. CLI host vẫn
  dùng cùng nguồn/adapter và PostgreSQL, không chuyển sang bên thứ ba. Khi
  website trả trang Cloudflare challenge/429, giữ trạng thái lỗi và retry sau,
  không coi HTML challenge là draw hoặc thay bằng dữ liệu tự dựng.
  Header `cf-mitigated: challenge` dừng ngay, không retry request đó. HTTP 429
  thường sau tối đa 3 attempts hoặc Retry-After quá dài cũng hoãn cả batch.
  Import ngừng submit ID mới, chờ tối đa 3 task đang chạy và ghi counters đúng;
  collector dừng ở ID lỗi. Không tiếp tục hàng nghìn request khi đã bị chặn.
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
