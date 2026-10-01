# 0002 — Frontend MVP stack

- Status: accepted
- Date: 2026-10-01
- Scope: P7 frontend, development tooling and API integration
- Sources: `task.md` P7, `docs/wireframe.md`, `docs/API.md`, `.agent/FRONTEND.md`

## Context

MVP cần nhiều màn hình liên kết qua URL, form tương tác và trạng thái tải độc lập. Backend đã có HTTP API v1; frontend không được tính lại analytics. Stack frontend trước P7 chưa được chốt.

## Options

- React SPA + Vite: routing và form trực tiếp, bundle tĩnh, ít hạ tầng.
- Framework SSR: thêm server runtime và deployment khi MVP chưa có yêu cầu SEO hoặc server rendering.

## Decision

Dùng React 19, TypeScript, Vite 8, React Router 7 ở declarative mode và `lucide-react` cho icon. CSS nội bộ với token thống nhất; chart HTML/CSS có tóm tắt văn bản. Fetch API dùng same-origin `/api/v1`; Vite development proxy chuyển `/api` tới backend. Build production cần reverse proxy cùng origin cho `/api` (P8). Giữ game/window/filter/page/sort trong URL, chỉ giữ form tạm trong component. Request theo context có `AbortController` để bỏ response cũ.

Vitest + Testing Library kiểm tra UI/state; oxlint, Prettier, TypeScript và Vite build là quality gates. npm lockfile cố định dependency tree.

## Consequences

Không có SSR; lịch sử và analytics hiển thị sau khi API trả lời. Production hosting phải phục vụ SPA fallback và reverse proxy API. Không thêm state/chart library khi số màn hình MVP còn nhỏ.

## Validation

`npm ci`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build` trong `frontend/`; kiểm tra luồng và responsive ở các kích thước wireframe.
