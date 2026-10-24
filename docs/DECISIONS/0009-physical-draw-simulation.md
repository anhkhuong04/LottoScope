# 0009 — Lồng cầu vật lý cục bộ

- Status: accepted
- Date: 2026-10-24
- Scope: frontend generator Mega/Power
- Sources: quyết định trực tiếp của người dùng; [spec](../DRAW_SIMULATION.md).

## Context

Người dùng thay tạo bộ số theo rule bằng lồng cầu có va chạm, chọn kết quả
bằng bóng thực sự qua cửa, dừng ở sáu main. React 19/Vite đã có sẵn.

## Decision

Dùng Three.js, React Three Fiber 9 và React Three Rapier 2; tách cơ chế Rapier
khỏi renderer để kiểm chứng vật lý thật không cần WebGL. Không dựng trước
kết quả bằng generator API; giữ nguyên API đó và UI Lotto. Matter.js 2D và
Babylon/Havok đã được cân nhắc trong spec trước khi người dùng chọn stack.

## Consequences

Cảnh được lazy-load, cần WebGL 2; browser thiếu hỗ trợ hiển thị lỗi rõ ràng.
Phiên thuộc trình duyệt, không lưu bền vững và không tái lập từ seed analytics.
Backend checker tiếp tục xác thực domain/đối chiếu lịch sử khi người dùng gửi
bộ kết quả. Không chứng nhận phân bố đồng đều, không tạo draw hoặc migration.

## Validation

Test Rapier trực tiếp, frontend controls/deep links và Playwright dùng cảnh
thật; bằng chứng hoàn tất ghi tại [task.md](../../task.md), nhóm SIM.
