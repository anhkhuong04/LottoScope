# 0003 — Phục vụ frontend MVP bằng Compose

- Status: accepted
- Date: 2026-10-01
- Scope: đóng gói và chạy ứng dụng MVP
- Sources: `task.md` P8-03, `docs/ARCHITECTURE.md`, [ADR 0002](0002-frontend-stack.md)

## Context

React SPA gọi `/api/v1` cùng origin. Compose trước P8 chỉ chạy PostgreSQL và backend, nên bản build frontend chưa có đường triển khai và deep link cần SPA fallback.

## Options

- Nginx phục vụ bundle tĩnh, proxy `/api/` tới backend trong Compose: thêm một container nhỏ, giữ cùng origin.
- FastAPI phục vụ bundle: gắn vòng đời và cấu hình static frontend vào backend.

## Decision

Dùng multi-stage image Node 22 để build theo `package-lock.json`, Nginx 1.28 để phục vụ bundle và proxy `/api/`. Nginx fallback về `index.html` cho đường dẫn SPA; Compose chỉ mở cổng frontend trên loopback host. PostgreSQL là storage bền vững duy nhất; frontend không có state bền vững.

## Consequences

Thứ tự khởi động là PostgreSQL → migration explicit → backend healthy → frontend. Một backend worker sở hữu scheduler; không scale backend khi scheduler còn bật trong process. Đây là cấu hình triển khai thử cục bộ, chưa bao gồm TLS, public ingress hay giám sát production. Có thể đổi `FRONTEND_PORT` nếu cổng mặc định `8088` bận.

## Validation

P8-03: Compose project mới, migration từ DB trống, volume tồn tại sau restart, health checks, SPA deep link và `/api` qua Nginx. P8-02: browser tests trên bản build phục vụ qua Compose.
