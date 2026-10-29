# 0011 — Public deployment trên Vercel, Render Free và Neon Free

- Status: accepted
- Date: 2026-10-29
- Scope: cloud ingress/deployment; giữ local Compose/domain/schema.
- Sources: yêu cầu website chạy khi máy cá nhân tắt, ưu tiên $0, công khai
  cho ai có đường dẫn; [Architecture](../ARCHITECTURE.md),
  [API](../API.md), [runbook](../DEPLOYMENT_FREE.md).

## Context

Khoảng 10 người; React SPA, CPython/FastAPI và PostgreSQL 16. Không cần port
sang Workers/D1. Render PostgreSQL Free hết hạn 30 ngày; Web Free ngủ idle.
Scheduler hiện mặc định tắt. task-deloy.md là proposal Cloudflare cũ.

## Options

- Vercel + Render Free + Neon Free: giữ runtime/schema, gateway giữ secrets.
- Cloudflare hybrid: vẫn cần host Python/PG; thêm provider chưa cần thiết.
- Tunnel máy cá nhân: không đáp ứng truy cập khi máy tắt.

## Decision

Vercel Hobby phục vụ SPA và Node gateway cùng origin. Render Free một Uvicorn
worker, concurrency 16; Neon Free PostgreSQL 16 direct TLS là nguồn dữ liệu
cloud bền vững duy nhất. Cloud mode bắt buộc origin token ≥32 ký tự, guard
direct access và tắt docs. Website công khai, không thêm user login.

Gateway bounded/no-store, không retry writes, deadline 270 giây trong Function
300 giây có Fluid Compute. Timeout trả failure, không khẳng định collector đã
bị hủy. Scheduler tắt; liveness không query DB. Migration explicit trước traffic
sau backup/restore. Dùng domain miễn phí, không paid disk/cron/worker hoặc
auto-upgrade/keep-alive. Local Compose giữ mặc định.

## Consequences

Chấp nhận cold start cho pilot; không SLA/cam kết $0 vĩnh viễn. Public traffic
có thể dùng hết quota. Backup độc lập và source access cần nghiệm thu. Nếu
sync thường xuyên vượt deadline, job trạng thái bền vững là task riêng.
Không đổi PostgreSQL invariant hoặc mở rộng Phase 2.

## Validation

Regression tests cloud/local ingress, fail-closed config/driver/pooler/scheduler;
gateway credentials/JSON/status/body limits/timeouts và không retry POST.
Gates/build/migration/backup-restore riêng; trạng thái thật ở task.md. Local
tests không thay nghiệm thu Vercel/Render/Neon và browser production.
