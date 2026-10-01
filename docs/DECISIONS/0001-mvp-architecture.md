# ADR 0001 — MVP milestones và kiến trúc ban đầu

- Status: accepted
- Date: 2026-10-01
- Scope: MVP sequencing, backend runtime, storage và source ingestion
- Sources: [overview](../PROJECT_OVERVIEW.md), [wireframe](../wireframe.md),
  [P0 plan](../../task.md)

## Context

Overview định nghĩa MVP backend và để frontend ngoài phạm vi đó; wireframe
định nghĩa MVP frontend riêng. Dự án mới có tài liệu, cần chọn cách triển khai
và schema đủ cụ thể để bắt đầu mà không trộn hai mốc.

## Options

- Xây backend trước rồi frontend theo API: dễ kiểm chứng data/metrics và
  tích hợp UI sau; bàn giao sản phẩm đủ hai mốc.
- Xây cả hai đồng thời: sớm thấy UI nhưng API/domain chưa ổn định dễ phải
  sửa giao diện theo các quyết định nghiệp vụ.

## Decision

Chọn backend trước, frontend sau; mốc ứng dụng cần cả hai. Backend là
Python 3.12, PostgreSQL 16 và modular monolith theo overview. Draw lưu main
numbers canonical trong PostgreSQL array để đọc lịch sử và tính giao tập
gọn; audit correction tách bảng. HTML Vietlott đi qua adapter, không đi vào
business logic. Scheduler một process với DB lock. Chi tiết contract ở
[MVP](../MVP.md), [domain](../DOMAIN.md), [data model](../DATA_MODEL.md) và
[pipeline](../DATA_PIPELINE.md); ADR không lặp lại formula/schema.

Python 3.12 còn được hỗ trợ theo [Python devguide](https://devguide.python.org/versions/)
và PostgreSQL 16 theo [PostgreSQL version policy](https://www.postgresql.org/support/versioning/)
tại ngày quyết định. Versions của packages được lock ở P1. Frontend stack
được chọn bằng ADR riêng ở P7 khi triển khai.

## Consequences

Frontend phụ thuộc API contract nhưng có thể làm từng màn hình khi endpoint
tương ứng sẵn sàng. Array cần validation domain cẩn thận; nếu workload thực
tế buộc đổi representation, cần migration và ADR mới. Multi-worker backend
đòi thay ownership của scheduler trước khi scale.

## Validation

P2 kiểm tra schema/domain trên PostgreSQL; P3 kiểm tra ingestion idempotent;
P6 kiểm tra API tích hợp; P8 kiểm tra Compose/migration/backup và nghiệm thu
hai mốc theo [task.md](../../task.md).
