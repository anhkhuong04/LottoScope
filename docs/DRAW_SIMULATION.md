# Lồng cầu mô phỏng

Quyết định người dùng ngày 24/10/2026: thay giao diện tạo bộ số của Mega 6/45
và Power 6/55 bằng React Three Fiber + Rapier; bóng thực sự lọt cửa quyết định
kết quả, kết thúc sau sáu số chính.

Quyết định người dùng ngày 25/10/2026: mở rộng lồng cầu mô phỏng cho cả Lotto 5/35
(35 bóng, 5 số chính), thay thế hoàn toàn luồng RuleGenerator trên frontend Tạo bộ số.

## Hành vi

- Mỗi phiên có đủ bóng theo game definition từ API, cùng đặc tính vật lý.
- Bóng va chạm với nhau và thành lồng rỗng; lực khuấy tác động lên mọi bóng,
  không phụ thuộc số, lịch sử, tần suất hoặc kết quả mong muốn.
- Trộn trước khi mở cửa. Chỉ ghi nhận khi tâm bóng vượt mặt phẳng kiểm nhận
  bên ngoài cửa theo chiều đi ra; callback trùng không tạo thêm kết quả.
- Giữ thứ tự bóng ra; bộ tăng dần phục vụ sao chép/kiểm tra. Không số đặc biệt.
- Bắt đầu, tạm dừng/tiếp tục và phiên mới; không nút bốc thay thế khi kẹt.
  Quá thời gian không lấy được bóng phải báo kẹt, cho trộn lại mà giữ số đã ra.
- Tab bị ẩn tự tạm dừng; quay lại cần tiếp tục chủ động. Chuyển game/rời trang
  hủy phiên và tài nguyên cũ. Lỗi WebGL/WASM báo rõ, không fallback sang RNG.
- Giảm chuyển động: chỉ bắt đầu sau thao tác người dùng, có thể ẩn cảnh nhưng
  giữ cùng cơ chế vật lý. Bản đầu không âm thanh hoặc tự chạy.
- Kết quả là mô phỏng cục bộ, không phải kỳ quay chính thức; không lưu vào
  bảng draws, không gọi ingestion/generator, không tuyên bố phân bố đồng đều.
- Chuyển kết quả sang checker để backend kiểm tra domain và đối chiếu lịch sử.

## Kỹ thuật

- Dùng `three`, `@react-three/fiber` 9 và `@react-three/rapier` 2 (React 19).
  Rapier WASM tải từ bundle cùng origin, không CDN runtime.
- Logic vật lý tách khỏi React để cùng chạy trong cảnh và test không WebGL.
  Bước vật lý cố định 1/60 giây; geometry/material dùng chung, không setState
  vị trí bóng mỗi khung hình. Lazy-load cảnh khi vào trang Tạo bộ số của cả ba game.
- Lồng có thành rỗng và một cửa đáy hẹp; gate vật lý đóng sau lấy bóng,
  trộn lại trước lần mở tiếp. Kiểm nhận dựa trên vị trí trước/sau physics step,
  không dựa trên timer; lỗi bóng thoát thành phải dừng, không bốc bổ sung.
- Thời gian hoạt động của phiên không bao gồm lúc tạm dừng. Giới hạn mỗi lượt
  30 giây chưa ra bóng; người dùng được tiếp tục trộn, không chọn số hộ.
- Kết quả chỉ dùng game main definition; thứ tự hiển thị và canonical main
  là hai representation riêng. Không thay generator API hoặc schema database.

## Phương án đã cân nhắc

Matter.js 2D đơn giản hơn nhưng giảm chiều sâu; Babylon/Havok có đủ vật lý
nhưng thêm một hệ tích hợp khác. Người dùng chọn React Three Fiber + Rapier,
đồng thời chọn bóng qua cửa quyết định kết quả thay cho kết quả RNG dựng trước.

## Nghiệm thu

- Test Rapier thật: va chạm thành/bóng, cửa đóng không cho bóng ra, cửa mở
  mới ghi nhận; đủ năm số hợp lệ/khác nhau cho 35 bóng, sáu số cho 45 và 55 bóng;
  không ghi thêm kết quả sau `main_count`.
- Test pause/reset/timeout, số trùng/out-of-range, callback và context cũ.
- Browser desktop/mobile: quay thật đến `main_count`, copy/checker, chuyển game,
  pause/ẩn tab, lỗi renderer, reduced motion, keyboard, không overflow.
- Frontend lint/format/typecheck/unit/build/E2E; cập nhật task và commit.
  Nhiều phiên kiểm chứng vận hành không phải chứng nhận tính công bằng.

## Bằng chứng triển khai — 24/10/2026

- Baseline 19 unit tests; sau triển khai **32 pass**, gồm chín test Rapier
  thật và UI/URL tests. Regression cleanup world, timeout/pause và reset mất
  WebGL đã tái hiện RED rồi GREEN. Review độc lập không còn lỗi trọng yếu.
- Lint/format/typecheck/build đạt. Full E2E **83 pass/4 skip theo thiết bị**;
  sau chuyển controls sát cảnh, UI unit pass và **10 feature E2E pass** trên
  bản Compose ở desktop/mobile. Quay thật đủ sáu main cho cả hai game, không
  mock physics; có kiểm copy/checker, reset/context loss, reduced motion và Axe.
- Đã xem ảnh desktop/mobile. Đây là Chromium với viewport/device emulation,
  chưa đo FPS trên điện thoại thật. Cảnh lazy-load khoảng 1,09 MB gzip;
  build có cảnh báo chunk lớn và dependency có deprecation warnings, không
  hạ gate/tắt cảnh báo. Audit runtime không có vulnerability; hai cảnh báo
  dev của Vite/undici đã có trong lockfile trước task, chưa sửa ngoài phạm vi.
- Frontend Compose đã build/up healthy; backend/PostgreSQL giữ nguyên.
  Không đổi schema hoặc số draw thật. Chi tiết checklist ở nhóm SIM `task.md`.

## Bằng chứng mở rộng Lotto — 25/10/2026

- `/generator` dùng chung DrawMachine cho cả ba game; xóa RuleGenerator UI.
  `main_count`/`main_max` từ API truyền tới scene và physics; Lotto dừng ở
  5 main từ 35 bóng, khay bóng và số cột kết quả căn theo game.
- Regression đã tái hiện RED → GREEN: Lotto còn cột kết quả thứ sáu thừa;
  physics tự suy luận count khi caller không truyền. Count hiện bắt buộc và
  cấu hình sai bị từ chối trước khi tạo tài nguyên vật lý.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`,
  `npm run build` đạt; **42 unit tests pass**. Một lượt unit chạy đồng thời
  browser bị timeout; chạy riêng full suite đạt, không tăng timeout hoặc skip.
- `npm run test:e2e -- --workers=2`: **86 pass/4 skip theo thiết bị**.
  Sau bổ sung ca đổi game lúc Lotto đã ra bóng, chạy lại ca đó bằng
  `npx playwright test e2e/draw-machine.spec.ts --grep 'pause, reset and game change' --workers=1`:
  **3 pass** trên desktop/tablet/mobile. Quay thật đủ main cho cả ba game,
  kiểm copy/checker, không gọi generator API, pause/reset/WebGL/reduced motion,
  Axe và overflow. UI unit kiểm checker Lotto giữ phạm vi ngày được chọn.
- Đã xem ảnh Lotto desktop/mobile; review độc lập không có finding quan trọng.
  Mobile là Chromium device emulation, chưa kiểm FPS trên điện thoại thật.
  Build vẫn cảnh báo chunk lớn (scene khoảng 1,095 MB gzip) và thư viện có
  deprecation warnings; không hạ gate. Không deploy hoặc đổi backend/DB/API.
