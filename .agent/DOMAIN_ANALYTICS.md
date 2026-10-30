# Quy tắc agent: domain và analytics

Nguồn chuẩn đã chốt: [DOMAIN.md](../docs/DOMAIN.md) cho game/identity/time,
[ANALYTICS.md](../docs/ANALYTICS.md) cho formula/rules và
[API.md](../docs/API.md) cho serialization. Không sao chép formula vào file
quy tắc; mỗi lần sửa behavior phải cập nhật nguồn chuẩn và test tương ứng.

## Bất biến khi generate/review code

- Validate game, count, type, duplicate, range, special trước normalize hoặc
  persist. Không dùng set/clamp/truncate để âm thầm sửa input sai.
- Main, special, pair và draw ID là các identity khác nhau. Canonical main/pair
  trước compare; special không tham gia main metrics/checker/generator MVP.
- Cùng game/window/cutoff/data phải cho kết quả và thứ tự output deterministic.
  Không hard-code UI default 30 draws trong core.
  Mô phỏng vật lý cục bộ là use case riêng, không phải analytics/generator
  deterministic; contract ở [DRAW_SIMULATION.md](../docs/DRAW_SIMULATION.md).
  Lotto mô phỏng thêm một special từ lồng 1–12 sau main theo yêu cầu người dùng;
  giữ riêng khỏi main, không thay checker/generator API main-only.
- Null có nghĩa là chưa xác định/không quan sát được trong window; không thay
  bằng 0. Frequency, gap và pair phải dùng đúng denominator/interval của spec.
- Generator chỉ áp dụng rule bật, validate cấu hình, giới hạn attempts,
  trả partial/insufficient-history rõ và explanation từ chính dữ liệu đã xét.
  Seed reproducibility cần cả data version, cutoff, rules và reference date.
- Không diễn giải frequency/gap/hot-cold như xác suất kỳ sau; không AI score,
  best number, guaranteed hoặc prediction claim.
- Khi xây Phase 2 backtesting, mọi dữ liệu strategy nhìn thấy phải trước draw
  đánh giá; không dùng draw tương lai để tính window hoặc rule. Spec chi tiết
  Q11 phải được bổ sung trước Phase 2.

Fixture/test bắt buộc và Definition of Done theo [WORKFLOW.md](WORKFLOW.md).
