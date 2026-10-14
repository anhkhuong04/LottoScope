# Nghiệm thu Power 6/55 — 14/10/2026

Scope [ADR 0006](DECISIONS/0006-power-655.md), tiến độ [task.md](../task.md).
File ghi kết quả chạy thực; các bước còn mở không được coi là hoàn thành.

## POWER-01 và POWER-02

- Contract/domain/API/schema/source/UX đã cập nhật. Domain có 6 main 1–55,
  special bắt buộc khác main; checker/generator tiếp tục main-only.
- `uv sync --locked`, Ruff check/format và Pyright đạt. Toàn backend tại mốc
  POWER-02: **136 pytest pass** trên PostgreSQL 16 riêng `lotto_power_20261014_test`.
  Còn warning Starlette/httpx hiện có và Alembic path_separator khi test migration.
- Migration `0005_power_655` upgrade DB trống và `alembic check` đạt.
  Tests chứng minh constraint special (NULL/range/trùng main), game isolation,
  correction/idempotency, upgrade/downgrade giữ payload/hash/prizes/version/audit
  và downgrade từ chối Power ở từng bảng mà không xóa row.
- Backup custom-format `lotto-before-power-20261014.dump` đã copy khỏi container.
  Restore vào DB riêng `lotto_power_restore_20261014`, upgrade 0004 → 0005.
  Count/checksum toàn row của draws/state/corrections/runs/items/checkpoints
  khớp trước/sau. Snapshot có **2.518 draws** (944 Lotto + 1.574 Mega).
  Draws checksum `4bbfff94f698d31889a3653a7565661d`; state
  `4642eb9ef3f636ecedf149f705a26d7c`; không có correction.

## POWER-03

- Source metadata giữ path/CSS/prize conventions theo game; URL/title/ID/count
  được validate cùng nhau. Power dùng CSS Mega nhưng title Power; Jackpot 2
  dùng `|`, điều kiện main/special năm hạng được kiểm chính xác.
- Fixture chính thức 655/00001 và 655/01385 giữ number/table source. Tests cho
  mất special markup, trùng main/out-of-range, title/path/ID sai, đổi ký hiệu/
  điều kiện/names, import/resume/collector lặp, correction và enrichment đạt.
- Ruff check/format, Pyright và **151 backend tests pass** trên PostgreSQL riêng;
  Compose config đạt. Scheduler tests giữ HTTP hoạt động khi startup catch-up,
  cả ba game qua hai lần restart, Power poll thứ Ba/Năm/Bảy và reconcile.
- Live smoke bằng `httpx`/fetcher/parser thật đọc thành công `00001` ngày 01/08/2017,
  `01385` ngày 15/08/2026 và latest `01410` ngày 13/10/2026. Mỗi draw có sáu
  main, một special và năm hạng giải. Chưa coi smoke ba kỳ là full-history audit.

## POWER-04

- **156 backend tests pass**, Ruff check/format/Pyright đạt. Fixture tính tay
  Power kiểm 55 numbers, 1.485 pairs, special không tham gia frequency/gap/
  appearances/checker, exact-k histogram, cutoff/date/pagination/game isolation,
  generator sáu rules có explanation và seeded reproducibility; prizes 5 hạng.
- Frontend lint/format/typecheck/build và 4 unit tests đạt. Highlights hiển thị
  cả Jackpot 1/2, giữ VND BigInt chính xác; picker lấy count/range từ API.
- API local cổng 18005 trỏ clone `lotto_power_restore_20261014`, tắt scheduler,
  nhập đúng hai kỳ nguồn `00001`, `01385` để kiểm UI trước deploy.
  15 ca mới qua desktop/tablet/mobile: **12 pass lượt đầu + 3 checker pass khi
  chạy lại sau sửa test chờ picker game mới trước fill**. Chuyển game/reset,
  deep link/window, checker, generator/explanation, pair detail, hai Jackpot,
  special riêng, stale/retry và response Mega đến muộn được kiểm.
- Đã xem screenshot detail desktop/mobile: đủ hai highlights/năm hạng,
  special rõ và không overflow; Axe WCAG A/AA trên Power detail không lỗi.

## POWER-05 — phần đã kiểm chứng và phần bị chặn

- Compose config/build/up/readiness đạt; cả ba service healthy. DB ứng dụng ở
  `0005_power_655`; checksum toàn draw row Lotto/Mega khớp trước/sau migration.
  Có thêm backup ngay trước apply: `lotto-before-power-apply-20261014.dump`,
  đã sao chép ra ngoài container. Snapshot cũ/DB clone dùng cho data preservation
  ở POWER-02 được giữ; API thử nghiệm cổng 18005 đã dừng sau kiểm chứng.
- Phiên bản cuối: **162 backend tests pass**, Ruff check/format/Pyright đạt,
  frontend lint/format/typecheck/build/4 unit tests đạt. Browser suite cuối chạy
  trực tiếp trên Compose (không relay API clone): **56 pass, 4 skip theo thiết bị**,
  gồm đủ 15 ca Power và regression Lotto/Mega. Đã kiểm hình detail desktop/mobile.
- Runtime trả ba games; Power numbers=55, pairs=1.485, bảng giải=5 hạng.
  Scheduler đăng ký startup catch-up, poll 19:30 thứ Ba/Năm/Bảy, reconcile 07:00
  hằng ngày theo Việt Nam. Cấu hình local `LOTTO_SOURCE_REQUEST_INTERVAL=2.0`
  đã áp dụng để giảm tốc; gate từ chối giá trị dưới 1 giây/NaN/infinity.

### Giới hạn nguồn thực tế

Vietlott bắt đầu trả **HTTP 429**, body Cloudflare `Just a moment...`, không
có `Retry-After`. Lượt import container và sau đó host Windows đã bị dừng khi
429 lặp lại; job kế tiếp đánh dấu run gián đoạn là failed và giữ checkpoint.
Host từng đọc được ID mà container trả 429, nhưng sau đó host cũng bị chặn.
Các lần thử sau với nhịp 2 giây/request vẫn thất bại ngay ở latest page.
`audit_import` đã chạy và exit 1 vì source 429; không có full-history audit đạt.
Startup collector của cả ba game tại mốc deploy cũng ghi failed/429; việc
đăng ký lịch và logic collector đã được test, chưa chứng minh nguồn đang cho
collector container cập nhật thành công.

Snapshot bàn giao lượt đầu: **45 Power draws** có đủ prize snapshot, ID từ `00001`
đến `00048` (còn lỗ hổng), latest đã lưu ngày **18/11/2017**. Checkpoint đã
scan tới `00071`: 45 found + 26 failed. Upper bound nguồn trước khi bị chặn là
`01410` ngày 13/10/2026; 1.339 ID còn chưa scan. Không coi 45 draw này là lịch
sử đầy đủ hay latest nguồn. Lotto giữ 944 draws và Mega giữ 1.574 draws.
Không còn run `running`; dữ liệu cũ và provenance được giữ nguyên.

**POWER-05 chưa hoàn thành:** cần nguồn truy cập lại để resume import từ
checkpoint, retry failed IDs và scan đến latest; sau đó audit đầy đủ và chạy
collector hai lượt, đối chiếu source/DB/API. Lệnh resume là import thường,
không cần `--recheck` hoặc xóa dữ liệu; item found được bỏ qua idempotently.

```powershell
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.import_history --game power_655
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.audit_import --game power_655
docker compose run --rm --no-deps -e LOTTO_SCHEDULER_ENABLED=false backend python -m app.commands.collect --game power_655
```

Chỉ chạy collector sau khi import/audit đầy đủ. Không bypass challenge hoặc
thay dữ liệu nguồn bằng dữ liệu giả để đánh dấu milestone hoàn tất.

### Chạy lại POWER-05 — 14/10/2026, 08:16–08:21 giờ Việt Nam

- Import Compose run `298` vẫn thất bại tại latest page với HTTP 429, không
  thay đổi dữ liệu. Import trên host Windows run `299`, dùng cùng nguồn chính
  thức và nhịp 2 giây/request, đọc được latest `01410` và thêm **32 draws**.
  Các item found được bỏ qua; toàn bộ 26 failed IDs của lượt trước đã được lấp.
- Nguồn trả 429 liên tiếp từ `00078`; đã dừng import, giữ dữ liệu/checkpoint.
  Lượt tiếp theo `300` đánh dấu run gián đoạn là failed theo workflow resume,
  rồi cũng thất bại tại latest page. Counters run gián đoạn chưa được finalize;
  số liệu bàn giao dưới đây lấy trực tiếp từ draws/ingestion_items/checkpoints.
- Snapshot mới: **77 Power draws**, liên tục `00001`–`00077`, latest đã lưu
  **25/01/2018**, cả 77 có đủ năm hạng giải. Checkpoint `00101`: 77 found +
  **24 failed** (`00078`–`00101`); 1.309 ID chưa scan so với upper bound `01410`.
  Không còn run running hoặc correction pending. Lotto vẫn 944 draws, Mega 1.574.
- `alembic current` ở `0005_power_655 (head)`; `alembic check` không có upgrade
  operations mới. Readiness đạt, ba service Compose healthy. Rerun browser
  tests Power trực tiếp trên Compose, không relay: **15 passed** trên ba thiết
  bị (24,8 giây). Không sửa code và không chạy lại toàn bộ backend/regression
  suite trong lượt này; kết quả toàn suite phía trên thuộc lượt triển khai trước.
- Chưa chạy lại full-history audit hoặc hai lượt collector: history vẫn thiếu
  và nguồn tiếp tục chặn. POWER-05 giữ mở; resume bằng lệnh import thường phía
  trên khi nguồn cho truy cập lại, không xóa dữ liệu hay bypass Cloudflare.

### Tiếp tục POWER-05 — 14/10/2026, 08:39–08:40 giờ Việt Nam

- Đã thử resume trên host Windows (run `301`) và Compose (run `302`), cùng
  nguồn chính thức với `LOTTO_SOURCE_REQUEST_INTERVAL=5.0` cho hai lượt này.
  Cả hai exit 1, HTTP 429 ngay tại latest page; không nhập thêm draw và không
  thay đổi cấu hình `.env`. Không tiếp tục gửi batch khi nguồn đang chặn.
- Đối chiếu PostgreSQL sau hai lượt: vẫn **77 draws**, cả 77 đủ năm hạng giải,
  latest `00077` ngày 25/01/2018; checkpoint `00101`, 77 found + 24 failed.
  Không còn run running. Chưa chạy full audit/collector vì import chưa đủ.
- POWER-05 vẫn chưa hoàn thành do nguồn bên ngoài. Không sửa code hoặc chạy
  lại test suite trong lượt vận hành này; giữ provenance/checkpoint để resume
  khi nguồn truy cập lại. Không đổi sang nguồn bên thứ ba hoặc bypass challenge.
- Thử thêm lúc 08:43 cùng ngày theo yêu cầu: host run `303`, nhịp 5 giây/request,
  tiếp tục exit 1/HTTP 429 tại latest page. Đối chiếu DB vẫn 77 draws đủ bảng
  giải, checkpoint `00101`, không có run running; không nhập thêm kỳ mới.
