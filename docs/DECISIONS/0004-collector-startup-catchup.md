# 0004 — Đồng bộ kỳ quay khi backend khởi động

- Status: accepted
- Date: 2026-10-03
- Scope: vòng đời collector trong backend Compose
- Sources: yêu cầu sửa lỗi cập nhật kỳ mới; [DATA_PIPELINE.md](../DATA_PIPELINE.md)

## Context

Ngày 03/10, nguồn đã có Lotto `00922` và Mega `01570`, database chỉ có `00921`
và `01569`. Backend khởi động lúc 08:35 giờ Việt Nam, sau lượt reconcile 07:00.
Cron trong memory chỉ tính lần chạy kế tiếp, không ghi nhớ lịch bỏ lỡ khi máy tắt.

## Options

- Chờ cron kế tiếp: không bổ sung runtime nhưng dữ liệu cũ sau khi bật máy.
- Lưu scheduler jobs bền vững: thêm quản lý job store và misfire khi restart.
- Collector nền một lần khi startup: dùng checkpoint PostgreSQL đã có để bù kỳ.

## Decision

Chọn lượt collector nền cho từng game khi scheduler khởi động. Giữ nguyên cron
và ingestion service; không giới hạn misfire cho lượt startup để tránh bị bỏ qua
khi quá trình khởi động chậm. Bật log INFO của ứng dụng để kết quả hiện trong
Docker logs; lượt `partial`/`failed` ghi ERROR.

## Consequences

HTTP phục vụ trong khi đồng bộ. PostgreSQL advisory lock ngăn trùng với cron/
lệnh tay; ingestion idempotent và correction policy giữ nguyên. Backend vẫn
chỉ một worker; không đổi schema/API. Chỉ chạy khi scheduler bật, lịch sử phải
được import trước. Lỗi nguồn được ghi nhận và thử lại theo lịch hiện có.

## Validation

Regression test tái hiện lỗi trước sửa, kiểm tra cả hai game qua hai lần startup,
HTTP còn phục vụ khi collector đang chạy, scheduler tắt và startup bị trễ.
Ruff check/format, Pyright và 75 backend tests (gồm PostgreSQL) đã pass.
Startup sau rebuild tạo runs `18`/`19`, mỗi game thêm một draw; latest nguồn,
database và API qua frontend khớp `00922`/`01570`. Restart lần nữa tạo runs
`20`/`21`: mỗi game có 7 draw unchanged, không thêm bản sao; tổng giữ nguyên
922 Lotto và 1570 Mega, cả ba container healthy.
