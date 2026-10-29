# Bản đồ quyết định và phạm vi

Tài liệu này giúp agent biết nguồn của từng quyết định; không lặp lại contract.
Phân tích ban đầu ngày 01/10/2026 từ `PROJECT_OVERVIEW.md` và `wireframe.md`
đã được cụ thể hóa ở P0 trong [task.md](../task.md). Tiến độ hiện tại theo
checklist trong `task.md`; bằng chứng nghiệm thu P8 ở
[MVP_ACCEPTANCE.md](../docs/MVP_ACCEPTANCE.md). Frontend stack được chốt ở P7,
cấu hình Compose frontend ở [ADR 0003](../docs/DECISIONS/0003-compose-frontend.md).
Bổ sung sau MVP: bảng giải thưởng theo kỳ và bằng chứng kiểm chứng ở
[ADR 0005](../docs/DECISIONS/0005-draw-prizes.md); contract ở Domain/Data Model/API,
tiến độ nhóm PRIZE trong `task.md`.

Mở rộng Power 6/55 được yêu cầu ngày 14/10/2026: quyết định ở
[ADR 0006](../docs/DECISIONS/0006-power-655.md), tiến độ `POWER-01..05` trong
`task.md`. Contract ba game ở Domain/Data Model/Data Pipeline/API; checker,
generator và analytics tiếp tục main-only. Đây là milestone hậu MVP.

Sửa cập nhật latest ngày 15/10/2026: [ADR 0007](../docs/DECISIONS/0007-fast-collection.md),
contract collector ở Data Pipeline; Windows local tasks và cách đổi owner
scheduler ở README. Không nhầm khôi phục latest với full-history Power.

Đồng bộ thủ công từ UI (20/10/2026): [ADR 0008](../docs/DECISIONS/0008-manual-sync.md),
contract POST/cooldown ở API, vận hành mặc định không scheduler ở README.

## Phạm vi

- Visual refresh (29/10/2026): người dùng duyệt hướng modern/clean từ
  [UI/UX audit](../docs/UI_UX_AUDIT.md), theo thứ tự dashboard/mobile →
  loading/menu → biểu đồ/typography → micro-interactions. Quy ước presentation
  ở [Design system](../docs/DESIGN_SYSTEM.md), tiến độ UI-01..05 trong task.md;
  giữ domain, game/window, dữ liệu thật và physics riêng.

- Cloud công khai (29/10/2026): [ADR 0011](../docs/DECISIONS/0011-free-cloud-deployment.md)
  chọn Vercel + Render Free + Neon Free cho khoảng 10 người, ưu tiên $0 và
  không phụ thuộc máy cá nhân. Gateway giữ origin token, PostgreSQL direct,
  scheduler tắt; [runbook](../docs/DEPLOYMENT_FREE.md). Resources/go-live đã có
  [bằng chứng](../docs/DEPLOYMENT_ACCEPTANCE.md); live source sync bị challenge,
  cold start sau idle chưa đo. Thay proposal Cloudflare
  trong task-deloy.md cho hướng deployment được chọn, không port Workers/D1.

- Chia sẻ Wi-Fi local (25/10/2026): [ADR 0010](../docs/DECISIONS/0010-local-wifi-access.md)
  chốt overlay frontend bind IP Wi-Fi cụ thể, giữ loopback/API/DB; không mở
  public Internet hoặc thêm phân quyền. Bật bằng `.env` local, hướng dẫn ở README.

- Sau MVP, người dùng chốt lồng cầu vật lý thay UI generator Mega/Power
  (24/10/2026) và Lotto (25/10/2026);
  [DRAW_SIMULATION.md](../docs/DRAW_SIMULATION.md) giữ contract, không mở rộng
  thành prediction/saved picks hoặc thay generator API backend.
  Yêu cầu bổ sung 25/10/2026: Lotto quay thêm 1 special từ lồng riêng 1–12 sau
  5 main; checker vẫn chỉ nhận main, Mega/Power chưa mở rộng special.
  Lý do kiến trúc ở [ADR 0009](../docs/DECISIONS/0009-physical-draw-simulation.md).

- [MVP.md](../docs/MVP.md) chốt backend MVP trước, frontend MVP sau; ứng
  dụng MVP hoàn thành khi cả hai mốc được nghiệm thu.
- Strategy management/backtesting/random baseline/saved picks thuộc Phase 2.
  Không dùng wording dự đoán hoặc score khả năng thắng.
- [ADR 0001](../docs/DECISIONS/0001-mvp-architecture.md) ghi lý do chọn
  kiến trúc và trình tự. Phạm vi task chi tiết ở [task.md](../task.md).

## Những câu hỏi ban đầu Q01–Q11

| ID | Trạng thái/nguồn chuẩn |
| --- | --- |
| Q01 — Mốc MVP | Đã chốt trong [MVP.md](../docs/MVP.md) |
| Q02 — Nguồn, lịch, retry/correction | Đã chốt trong [DATA_PIPELINE.md](../docs/DATA_PIPELINE.md); P8 audit nguồn ngày 01/10/2026 trong [MVP_ACCEPTANCE.md](../docs/MVP_ACCEPTANCE.md), tiếp tục kiểm tra theo collector |
| Q03 — Draw/time/ordering | Đã chốt trong [DOMAIN.md](../docs/DOMAIN.md) |
| Q04 — Window/freshness | Đã chốt trong [ANALYTICS.md](../docs/ANALYTICS.md) và [API.md](../docs/API.md) |
| Q05 — Frequency/gap/pair formula | Đã chốt trong [ANALYTICS.md](../docs/ANALYTICS.md); MVP không có Hot/Cold threshold riêng |
| Q06 — Exact/overlap/special | Đã chốt main-only trong [DOMAIN.md](../docs/DOMAIN.md) và [ANALYTICS.md](../docs/ANALYTICS.md) |
| Q07 — Generator rules | Đã chốt trong [ANALYTICS.md](../docs/ANALYTICS.md) |
| Q08 — API contract | Đã chốt trong [API.md](../docs/API.md) |
| Q09 — Versions/frontend stack | Backend chọn trong [ARCHITECTURE.md](../docs/ARCHITECTURE.md); frontend stack chốt trong [ADR 0002](../docs/DECISIONS/0002-frontend-stack.md) |
| Q10 — Storage/job/deploy | Đã chốt trong [DATA_MODEL.md](../docs/DATA_MODEL.md), [DATA_PIPELINE.md](../docs/DATA_PIPELINE.md), [ARCHITECTURE.md](../docs/ARCHITECTURE.md) |
| Q11 — Backtest methodology | Phase 2; chưa chốt, không thuộc P0/MVP |

## Khi triển khai

Chỉ lấy formula/invariant từ nguồn chuẩn trong bảng, không từ ví dụ wireframe
hay file `.agent` cũ. Nếu website Vietlott đổi cấu trúc/ID hoặc fixture kiểm
thử bác bỏ giả định nguồn, báo lỗi nguồn và cập nhật contract/ADR trước khi
đổi dữ liệu đã lưu. Quy tắc đọc, thay đổi và kiểm chứng ở [WORKFLOW.md](WORKFLOW.md).
