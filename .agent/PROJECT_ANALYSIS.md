# Bản đồ quyết định và phạm vi

Tài liệu này giúp agent biết nguồn của từng quyết định; không lặp lại contract.
Phân tích ban đầu ngày 01/10/2026 từ `PROJECT_OVERVIEW.md` và `wireframe.md`
đã được cụ thể hóa ở P0 trong [task.md](../task.md). P1 đã tạo bộ khung
backend, migration baseline, Compose và CI; domain tables/logic bắt đầu ở P2.

## Phạm vi

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
| Q02 — Nguồn, lịch, retry/correction | Đã chốt trong [DATA_PIPELINE.md](../docs/DATA_PIPELINE.md); access được kiểm tra ngày 01/10/2026, phải kiểm lại khi P3 |
| Q03 — Draw/time/ordering | Đã chốt trong [DOMAIN.md](../docs/DOMAIN.md) |
| Q04 — Window/freshness | Đã chốt trong [ANALYTICS.md](../docs/ANALYTICS.md) và [API.md](../docs/API.md) |
| Q05 — Frequency/gap/pair formula | Đã chốt trong [ANALYTICS.md](../docs/ANALYTICS.md); MVP không có Hot/Cold threshold riêng |
| Q06 — Exact/overlap/special | Đã chốt main-only trong [DOMAIN.md](../docs/DOMAIN.md) và [ANALYTICS.md](../docs/ANALYTICS.md) |
| Q07 — Generator rules | Đã chốt trong [ANALYTICS.md](../docs/ANALYTICS.md) |
| Q08 — API contract | Đã chốt trong [API.md](../docs/API.md) |
| Q09 — Versions/frontend stack | Backend chọn trong [ARCHITECTURE.md](../docs/ARCHITECTURE.md); frontend stack sẽ chọn ở P7-01, không cản P1–P6 |
| Q10 — Storage/job/deploy | Đã chốt trong [DATA_MODEL.md](../docs/DATA_MODEL.md), [DATA_PIPELINE.md](../docs/DATA_PIPELINE.md), [ARCHITECTURE.md](../docs/ARCHITECTURE.md) |
| Q11 — Backtest methodology | Phase 2; chưa chốt, không thuộc P0/MVP |

## Khi triển khai

Chỉ lấy formula/invariant từ nguồn chuẩn trong bảng, không từ ví dụ wireframe
hay file `.agent` cũ. Nếu website Vietlott đổi cấu trúc/ID hoặc fixture kiểm
thử bác bỏ giả định nguồn, báo lỗi nguồn và cập nhật contract/ADR trước khi
đổi dữ liệu đã lưu. Quy tắc đọc, thay đổi và kiểm chứng ở [WORKFLOW.md](WORKFLOW.md).
