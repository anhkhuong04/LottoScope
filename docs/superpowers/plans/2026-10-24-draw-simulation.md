# Physical draw simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lồng cầu Mega/Power lấy sáu số chính bằng bóng thực sự qua cửa.

**Architecture:** Rapier physics module độc lập chạy cùng world của React Three
Fiber. Trang generator chọn UI theo game; checker tiếp nhận bộ đã quay qua URL
và dùng API hiện có. Không thay DB/backend generator.

**Tech Stack:** React 19, TypeScript, Three.js, Fiber 9, Rapier 2, Vitest, Playwright.

**Spec:** [DRAW_SIMULATION.md](../../DRAW_SIMULATION.md)

## Global Constraints

- Sáu số chính, không số đặc biệt; Lotto 5/35 giữ chức năng hiện tại.
- Không RNG chọn kết quả, không lọc lịch sử hoặc ghi dữ liệu kỳ quay giả.
- Pause khi tab ẩn; timeout 30 giây hoạt động không ra bóng, không fallback.
- Giữ đường dẫn `/generator`; kết quả chỉ có hiệu lực trong game/phiên hiện tại.

## Review Focus

- Hai bóng ra gần nhau: không callback trùng hoặc ghi số thứ bảy.
- Bóng xuyên thành/lỗi số học: dừng rõ, không ghi thành kết quả hợp lệ.
- Rời trang/chuyển game khi đang quay: không callback hoặc kết quả cũ.
- Thiết bị WebGL yếu/không hỗ trợ: báo lỗi, không quay giả hoặc block navigation.
- URL checker sai/trùng/ngoài miền: không khởi tạo bộ sai hay lẫn game.

## Task 1: Cơ chế vật lý và state phiên

**Files:** `frontend/src/features/draw-machine/physics.ts`, `physics.test.ts`.

**Interfaces:** `createMachine(world, max, random)`, `stepMachine(machine, dt)`,
`startMachine`, `pauseMachine`, `resumeMachine`; kết quả gồm trạng thái và
`drawn: number[]`. Random chỉ khởi tạo/khuấy, không chọn kết quả.

- [x] Viết test cửa đóng/mở, crossing, trùng, dừng sáu, timeout/pause/reset.
- [x] Chạy RED; thêm dependencies tương thích và cơ chế Rapier tối thiểu.
- [x] Chạy GREEN, kiểm nhiều phiên 45/55 và kiểm chứng collision thực.

## Task 2: Cảnh và trang quay

**Files:** `DrawScene.tsx`, `DrawMachine.tsx`, `draw-machine.css` trong feature;
`pages/Generator.tsx`, `pages/Checker.tsx`, tests URL checker và E2E.

**Interfaces:** Cảnh consume module Task 1; callback snapshot chỉ khi trạng thái
hoặc số đổi. Trang quản lý phiên, lỗi/lazy loading, controls và checker link.

- [x] Test UI/URL/không WebGL và reset game trước implementation.
- [x] Tích hợp canvas lazy, vật liệu số bóng, khung/cửa/khay, responsive.
- [x] Bắt đầu/pause/resume/reset, trạng thái/copy/checker và lỗi renderer.
- [x] Browser quay thật hai game, không mock physics; kiểm context/accessibility.

## Task 3: Hợp nhất quy tắc và kiểm chứng

**Files:** `.agent/FRONTEND.md`, `.agent/DOMAIN_ANALYTICS.md`,
`docs/DOMAIN.md`, `docs/ANALYTICS.md`, `docs/wireframe.md`, `docs/ARCHITECTURE.md`,
`task.md`, `docs/DRAW_SIMULATION.md`.

- [x] Dẫn nguồn spec mô phỏng, ngoại lệ UI physics, không nhân bản contract.
- [x] Lint/format/typecheck/unit/build, suite E2E và review độc lập toàn diff.
- [x] Ghi kết quả/giới hạn thực tế, cập nhật checkbox và commit phần đã kiểm.

## Execution record

- Người dùng đã yêu cầu bắt đầu thực hiện; thực hiện liên tục trong checkout
  hiện tại trên branch `feat/physical-draw`, giữ nguyên `frontend/public/`.
- Baseline: frontend unit suite trước thay đổi; kết quả ghi ở task khi hoàn tất.
- Baseline 19 unit tests pass. Physics/UI tests được viết và chạy RED trước
  implementation; các lỗi cleanup world, timeout boundary và queued pause
  có regression RED/GREEN riêng. Suite frontend sau cùng: 32 unit tests pass.
- Review độc lập phát hiện listener context-loss còn sống sau reset; browser
  regression tái hiện lỗi rồi pass sau sửa cleanup subscription/session guard.
  Không còn finding Critical/Important. Fairness và phần cứng điện thoại thật
  không thuộc bằng chứng của review.
- Full E2E: 83 pass/4 skip theo thiết bị. Sau chuyển controls sát lồng cầu,
  UI unit/lint/format/type/build pass và 10 feature E2E pass trên Compose.
  Frontend cập nhật, ba service healthy, không thay backend/schema/draws.
