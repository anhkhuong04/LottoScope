# 0007 — Cập nhật latest nhanh, hoãn batch khi nguồn chặn

- Status: accepted
- Date: 2026-10-15
- Scope: fetcher, collector, scheduling, vận hành Windows local
- Sources: yêu cầu sửa cập nhật kỳ mới; [DATA_PIPELINE.md](../DATA_PIPELINE.md).

## Context

Database dừng ở Lotto 00944, Mega 01574; Power chỉ có 153 draw rời rạc,
latest 01359. Docker trả HTTP 429 với `cf-mitigated: challenge` trong probe;
cùng URL trên host Windows đọc được. Startup Power retry 1.257 lỗi lịch sử
theo thứ tự tăng, giữ worker nhiều giờ; latest có thể bị chờ sau backlog.
Collector còn tải lại ID latest dù đã parse đầy đủ từ trang latest.

## Options và quyết định

Không tăng concurrency hoặc đổi nguồn để vượt challenge. Chọn giảm request,
ưu tiên latest và chia việc đối chiếu lịch sử thành batch hữu hạn. Snapshot
latest đã validate được lưu cùng canonical source URL theo ID; không fetch
lại, không suy main/prizes. Checkpoint và correction policy vẫn được giữ.
Chi tiết thứ tự, cap và trạng thái là contract trong Data Pipeline.

Poll latest 5 phút dùng chung fetcher cho ba game tuần tự; cron đối chiếu
giữ nguyên. Khi Docker bị chặn trên máy hiện tại, chọn collector host Windows
như CLI đang hỗ trợ, ghi cùng PostgreSQL. Hai task local sở hữu poll/daily;
Docker scheduler tắt qua env. Hướng dẫn cài/gỡ ở [README](../../README.md#collector-trên-windows-khi-nguồn-chặn-docker).

## Consequences

Latest có thể xuất hiện trong UI trước khi backfill/reconcile hoàn tất. Run
partial không có nghĩa latest đã sai hoặc full history đã đủ. Đối chiếu bị
giới hạn nhưng backlog xoay theo attempted_at để lỗi vĩnh viễn không chặn
các ID cũ. Prefetched latest không được nâng checkpoint ở cả đường lỗi DB/
chronology. Không thêm schema/dependency hoặc thay thuật toán analytics.

Host cũng có thể nhận challenge; đây là lựa chọn runtime, không bảo đảm nguồn
luôn truy cập được. Task cần user Windows đang đăng nhập, Docker ready và uv.
Poll có time limit 10 phút, daily 2 giờ; không spawn cửa sổ tương tác. Hoãn
batch khi bị chặn, giữ lỗi/provenance và thử ở lượt sau, không báo success giả.

## Validation — 15/10/2026

- Regression RED/GREEN cho challenge HTTP 200/403/429, latest-first/reuse,
  batch limit, stop/drain futures kể cả lỗi đến khác thứ tự, resume/checkpoint
  khi persist lỗi và backlog fairness. Reviewer độc lập đã kiểm lại các sửa lỗi.
- Ruff check/format, Pyright và **175 backend tests pass** trên PostgreSQL
  test riêng. Có 10 warning deprecation hiện có (Starlette/Alembic).
- Frontend lint/format/typecheck/build, **17 unit tests pass**. Nhãn refresh đổi
  thành “Tải lại dữ liệu”, Dashboard giải thích đồng bộ nền và đọc dữ liệu lưu.
- Backup trước recovery đã copy ra host. Runs 321/322/323 khôi phục source
  latest Lotto **00947 (15/10)**, Mega **01575 (14/10)**, Power **01410 (13/10)**.
  Thời gian từ run bắt đầu đến commit latest: **1,07 / 1,07 / 1,73 giây**, chỉ
  là phép đo khi nguồn trả 200, không gồm poll delay/thời gian đăng kết quả.
- Sau recovery: 947 Lotto, 1.575 Mega, 165 Power; Power còn **1.245 ID chưa
  found**. POWER-05/full-history audit tiếp tục mở, không đánh dấu hoàn tất.
- Compose config/build/up/readiness pass; API qua frontend trả đúng ba latest
  trên cùng bảng giải 7/4/5 hạng. E2E trên Compose: **62 pass, 4 skip theo
  thiết bị**, gồm flow chính, Power, pager, prizes, Axe và responsive.
- Task local đã cài và trigger thực tế; probe task sau recovery nhận 429 và
  dừng từng game ngay, LastTaskResult 1, không tiếp tục scan backlog vô hạn.
  Không khẳng định đã loại bỏ chặn từ nguồn.
- Lịch 5 phút tự chạy lúc 13:52: Lotto/Mega đọc nguồn 200, runs 330/331 success/
  unchanged trong **1,16/1,86 giây**, mỗi game một request; Power vẫn 429.
  Kiểm chứng task hoạt động, vẫn phân biệt lỗi
  nguồn với lỗi collector, không coi lịch chạy đúng là nguồn luôn trả dữ liệu.
