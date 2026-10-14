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

## Các mốc còn mở

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

## Công việc còn mở

POWER-05 import/vận hành đang triển khai.
