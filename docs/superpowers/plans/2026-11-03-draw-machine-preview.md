# DRAW-VIS-01 — Kế hoạch mô hình tĩnh

**Goal:** hoàn thành bước 1–3 theo yêu cầu, để duyệt thiết kế trước khi tích hợp vật lý.
**Architecture:** geometry/visual riêng, route preview lazy-load, không import Rapier.
**Tech Stack:** React Three Fiber/Three.js hiện có; không thêm dependency.
**Spec:** [DRAW_MACHINE_REDESIGN.md](../../DRAW_MACHINE_REDESIGN.md).

## Giới hạn

Thực hiện tại checkout hiện tại để giữ nguyên các ảnh tham chiếu chưa commit
của người dùng. Không stage `task.md`, `task-deloy.md` đang bị xóa hoặc thư mục
references. Không thay physics/session/results, rebuild Docker, push hay deploy.
User đã yêu cầu bản tĩnh để duyệt; chỉ mốc này được triển khai trước phê duyệt bước 4.

- [x] Đọc source, ảnh và rules; báo khác biệt cửa/trục/collider; ghi phương án.
- [x] `preview/design.ts`, `geometry.ts`: cấu hình và hình học. Test bố trí bóng
  không chồng/thoát cầu cho 35/45/55 và cấu hình sai trước khi implement.
- [x] `MachineModel.tsx`, `MachineHardware.tsx`, `BallPool.tsx`: dựng visual
  có trục, gối đỡ, cửa, máng, khung trắng/acrylic/bóng teal-số trắng.
- [x] `PreviewScene.tsx`, `MachinePreview.tsx`, CSS, App/Generator link: bốn góc
  nhìn, orbit thủ công, cutaway/config; WebGL/loading/error/context loss/retry.
- [x] Frontend gates/unit; E2E preview desktop/mobile, cấu hình/góc nhìn,
  không kết quả/physics request, WebGL và context loss; regression quay cũ.
- [x] Kiểm ảnh so tham chiếu, review độc lập, ghi kết quả và commit bản tĩnh.
- [ ] **Chờ người dùng duyệt:** bước 4 tích hợp Rapier, sau đó bước 5 nghiệm thu.
