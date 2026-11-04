# DRAW-VIS-02 — Tích hợp mô hình đã duyệt và Docker local

Người dùng duyệt mẫu, chỉ giữ phối cảnh 3D và yêu cầu cập nhật Docker local;
không push/deploy cloud. Quy tắc phiên tại `docs/DRAW_SIMULATION.md` giữ nguyên.

- [x] Đưa component visual đã duyệt vào mô phỏng thật; bỏ editor/góc front/right/top,
  chuyển URL preview cũ về generator. Chỉ phối cảnh, không tự đổi góc khi đang quay.
- [x] Config tập trung cho dimensions/material/motion/physics. Collider riêng cho
  vỏ rỗng có cửa trước thấp, cổ thoát/gate và trục khuấy. Capture là crossing hướng
  ra ngoài thật; không timer/RNG chọn sẵn. Các bóng có cùng thông số.
- [x] Test Rapier: gate đóng/mở, va chạm, crossing ngược/lệch/duplicate, cleanup,
  pause/stall/game isolation, 35/45/55 và Lotto 5+1; config sai không cấp tài nguyên.
- [x] Studio phối cảnh, teal/trắng, vỏ trắng/acrylic, DPR giới hạn và render demand
  lúc nghỉ; giữ WebGL/WASM error/retry/reduced motion. Cấu hình vật lý ở code,
  không đưa các nút tuning kỹ thuật vào luồng quay.
- [x] Frontend gates/full unit; E2E đủ ba game, reset/pause/context loss/mobile,
  đo render idle/frame budget trên máy test (không cam kết FPS điện thoại thật).
- [x] Review, docs ngắn gọn, build/up Docker local đúng overlay LAN hiện có,
  giữ volume PostgreSQL; smoke bản Docker và commit. Không gọi đồng bộ nguồn.

Lý do thay geometry vật lý: mẫu có cửa trước thay cửa đáy. Cần đổi mặt phẳng
capture và giữ khuấy khi mở cửa để bóng không nằm dưới cửa. Vỏ/cửa đứng yên;
rotor bên trong quay quanh trục ngang. Không thay count/game/checker/kết quả thật.

## Kiểm chứng ngày 03/11/2026

- `npm run lint`, `npm run format:check`, `npm run typecheck` và production build
  đạt; `npm test`: **97/97 tests, 11 files**. Rapier quay đủ số ở 15 cấu hình
  game/seed, thêm phiên Lotto 5+1. Regression RED → GREEN cho bóng khởi tạo
  chồng rotor và bóng thứ hai mắc ngoài gate do mặt phẳng ghi nhận quá xa cửa.
- Trên Docker `127.0.0.1:8088`: **42/42 E2E** của `draw-machine`, `machine-design`
  và `data-experience` trên desktop/tablet/mobile. Kiểm quay thật/copy/checker,
  pause/reset/game switch, WebGL/retry/reduced motion, Axe và overflow. Sau khi
  chỉnh phép đo theo thời gian thực, chạy lại **3/3 render probes** đạt.
- Review nguồn giữ main/special riêng, không chọn kết quả trước, không gọi
  generator/ingestion; đã xem ảnh desktop/mobile. Visual/collider và cleanup
  tách biệt, snapshot chỉ cập nhật khi trạng thái/kết quả đổi.
- Compose có overlay LAN đã validate/build/up backend + frontend, đều healthy;
  ready API trả `ok`, localhost/LAN trả HTTP 200. Dockerfile đã thêm `public`
  để logo/favicon trả đúng MIME. PostgreSQL giữ nguyên container/volume và số
  kỳ trước/sau: Lotto 984, Mega 1582, Power 1417; không migration/import/sync.
- Ảnh bản Docker: [machine-integrated.png](../../images/screenshots/machine-integrated.png).
  Địa chỉ local `http://127.0.0.1:8088/generator`; LAN `http://192.168.1.17:8088`.
  Không push/deploy cloud.

### Giới hạn hiệu suất

Probe Chromium headless trả renderer **ANGLE/SwiftShader (CPU)**. Mẫu ngắn sau
warm-up, chia theo thời gian đo thực; cả ba viewport có **0 frame lúc nghỉ và
tạm dừng**. Các giá trị dưới đây không phải benchmark GPU/điện thoại thật.

| Viewport | FPS mẫu | Frame median / p95 (ms) |
| --- | --- | --- |
| Desktop | 6.5 | 153 / 159 |
| Tablet | 2.2 | 482 / 617 |
| Mobile giả lập | 4.4 | 228 / 235 |

Software rendering còn chậm; chưa xác nhận độ mượt trên thiết bị thật. Build
vẫn cảnh báo scene lazy-load lớn (~1.10 MB gzip), thư viện có deprecation
warnings. Runtime dependency audit: 0 vulnerability; hai cảnh báo dev có sẵn
không được sửa ngoài phạm vi. Không tuyên bố tính công bằng từ các lượt test.
