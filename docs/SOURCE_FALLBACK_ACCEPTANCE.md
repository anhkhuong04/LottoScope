# SOURCE — Khôi phục cập nhật dữ liệu cloud

## Thay publisher — 03/11/2026

Theo [ADR 0013](DECISIONS/0013-publisher-source-fallback.md), implementation đã
bỏ GitHub JSONL: Lotto dùng Minh Chính, Mega/Power dùng Minh Ngọc. Provenance
giữ trong DB/API/audit; giao diện ẩn nhà cung cấp, nút **Đồng bộ**, icon ×
đóng thông báo góc trên phải (44px, có accessible label).

Live read-only từ máy local: 20 kỳ gần nhất mỗi game khớp database local,
tổng 60/60; nguồn trả latest Lotto `00985`, Mega `01583`, Power `01419`.
Không nhập các kỳ này trong lượt kiểm tra. Review độc lập đọc được 40 kỳ/game:
Lotto 10 trang, Mega/Power 5 trang; không truy cập database production.

Regression gồm frozen HTML của ba publisher/game, hai ID Lotto cùng ngày,
live placeholder, domain/special, identity/date, duplicate/conflict, paging
và giới hạn 12 trang, host/game allowlist, chặn redirect trước khi follow,
giữ các kiểm tra PostgreSQL atomic/anchors/idempotence/challenge gate.

Quality gates: Ruff check/format, Pyright đạt; **271 pytest** đạt trên database
dedicated `lotto_cloud_20261029_test` (10 deprecation warnings có sẵn).
Frontend lint/format/typecheck/build và **60 unit tests** đạt. Một lượt unit
chạy cùng các suite khác timeout test physics 6/45; chạy lại nguyên suite
riêng đạt 60/60, không sửa physics hoặc tăng timeout. Build còn cảnh báo
bundle DrawScene lớn có sẵn.

Playwright: sync **6/6**, prizes **12/12** trên desktop/tablet/mobile. Đã sửa
wait selector của sync test từ frequency tiles sang balls trong latest-card;
selector cũ chờ widget không liên quan và có thể timeout khi tải song song.
Ảnh desktop/mobile xác nhận icon × đúng góc, không đè nội dung; dismiss có
accessible label và target 44px. Review độc lập đã kiểm lại redirect fix và
29 unit tests parser/publisher đạt.

Chưa deploy lên Render/Vercel hoặc xác minh truy cập từ Render. Các mốc cloud
bên dưới là bằng chứng lịch sử của implementation cũ, không phải release mới.

## Bằng chứng release trước — 30/10/2026

Ngày 30/10/2026, nhánh `deploy/free-cloud`, phạm vi theo
[ADR 0012](DECISIONS/0012-community-source-fallback.md).

- [x] SOURCE-01: xác định nguyên nhân official Cloudflare challenge trên Render;
  cùng collector local trả 200, cloud 503, audit Neon xác nhận challenge.
- [x] SOURCE-02: fallback opt-in append-only, audit/provenance, UI thông báo nguồn;
  backend Ruff/format/Pyright, 240 pytest với PostgreSQL; frontend lint/format/
  typecheck/build và 60 unit tests đạt. Không migration. Compose config hợp lệ.
- [x] SOURCE-03: release Render/Vercel và xác nhận cập nhật dữ liệu thực qua gateway.

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

## Release và dữ liệu thật — 30/10/2026 11:35–11:38 giờ VN

- Source SHA `f144ae9ad9ac4ed1e73090247eb905d2d37015fb`.
- Render `dep-dbi1s72f2vlc73drtvng` live, plan Free, đúng branch và Docker Command.
  Cập nhật env merge đã tạo deploy đầu `dep-dbi1s6e1egvs73elmh20`; trigger thủ công
  xếp deploy cùng SHA tiếp theo. Cả hai đã live, không còn lượt deploy đang chạy.
- Vercel production `dpl_5n9T75TTHApu5EwuyfmZnCMVrMrj` Ready, alias
  https://lottoscope-sable.vercel.app; build cloud chạy toàn bộ 60 unit tests đạt.
- `render blueprints validate render.yaml --output json`: `valid: true`.
  Flag fallback bật; scheduler vẫn tắt. Không migration hoặc tăng gói.

Sync thật qua public gateway: official run ghi Cloudflare challenge, tiếp theo
fallback có audit scope và `source=community`; cả ba trả HTTP 200.

| Game | Thêm mới | Latest sau sync | Kết quả |
| --- | --- | --- | --- |
| Lotto 5/35 | 0 | 00976 (29/10/2026) | Đã có kỳ mới nhất trong feed |
| Mega 6/45 | 4 | 01581 (28/10/2026) | Thành công |
| Power 6/55 | 2 | 01417 (29/10/2026) | Kỳ mới thành công; 1 backlog đối soát cũ |

Power backlog là item `01410`, audit run `441` bị Cloudflare ở lần đối soát cũ.
Draw chính thức `01410` vẫn tồn tại; không phải thiếu kỳ quay. Fallback giữ nguyên
item này và báo `partial`, `remaining_unresolved=1`; không dùng nguồn cộng đồng
để tự sửa audit/history. Dashboard có thể tiếp tục hiện cảnh báo này.

Lặp sync Mega sau cooldown: 200, created=0, unchanged=1, source=community.
Gọi Power ngay trong cooldown: 429 `sync_cooldown`. Counts cuối: Lotto 976,
Mega 1581, Power 1417; unique IDs bằng counts, checkpoint bằng latest.
So hash **toàn bộ row cũ** trước/sau (gồm provenance/prizes) cho cả 3968 kỳ:

| Game | Existing rows hash trước = sau |
| --- | --- |
| Lotto | `4e1339211fb03d6b671c4be2010fc4fe` |
| Mega | `6a7f7388a753f873c06cd513b8b378f7` |
| Power | `632029d2eea005263037a9ce5fd03108` |

Cloud HTTP smoke đạt: API ba game/analytics, origin protection, deep links,
cache-control; 10 đọc đồng thời 915 ms (burst nhỏ, không phải SLA).
Playwright trên production desktop/mobile: 11 passed, 1 skip đúng điều kiện
mobile-only. Sync POST trong browser tests được mock; các lượt sync thật là
những lượt ghi rõ bên trên. Kiểm tra bổ sung dashboard và detail Mega thật ở
1440/390 px: nhãn/link cộng đồng đúng, không overflow; đã xem screenshot.
Endpoint giải thưởng được mock 503 trong kiểm tra detail để không gọi nguồn
thêm; không tuyên bố đã nghiệm thu enrichment giải thưởng trên Render.

Bằng chứng thô trong `.render/source-live-validation.json`, `source-repeat.json`,
`source-live-ui.json` và screenshot ignored; kết quả SQL kiểm trực tiếp Neon.

## Giới hạn và rollback

Nguồn cộng đồng không bảo đảm cập nhật tức thì; validation overlap không thay
đối chiếu chính thức cho từng kỳ mới. Thiếu prize/time giữ null. Khi validation
hoặc fetch lỗi, giữ DB và báo lỗi. Tắt `LOTTO_COMMUNITY_FALLBACK_ENABLED` để
ngừng nhập fallback, không xóa hoặc sửa các kỳ đã nhập. History/corrections
vẫn theo policy cũ. Không thêm cron/worker trả phí hoặc dependency vào PC.
