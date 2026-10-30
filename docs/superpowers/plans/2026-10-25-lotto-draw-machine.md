# Lotto DrawMachine completion

Scope: hoàn tất thay RuleGenerator tại `/generator` bằng DrawMachine cho Lotto
theo yêu cầu ngày 25/10/2026 và `docs/DRAW_SIMULATION.md`. Kế thừa các thay đổi
đang có trên `feat/physical-draw`; không đưa logo chưa theo dõi vào commit.

Luồng: Generator lấy game/window từ AppProvider → DrawMachine truyền
`main_max`/`main_count` vào DrawScene → Rapier ghi nhận bóng qua cửa → kết quả
tăng dần được sao chép hoặc gửi đến checker. Lotto dùng 35 bóng/5 main;
Mega/Power giữ 45 hoặc 55 bóng/6 main. Không gọi generator API hoặc sinh special.

Chọn dùng chung DrawMachine vì cơ chế đã có và yêu cầu là thay thế hoàn toàn;
giữ hai UI song song hoặc sao chép một scene Lotto sẽ tăng nhánh cần bảo trì.
Backend generator API và PostgreSQL không thay đổi.

## Tasks

- [x] Bổ sung kiểm chứng Lotto: kết quả/copy/checker đúng game và window,
  physics dừng ở 5, reset/chuyển game và không gọi generator API.
- [x] Tái hiện bố cục Lotto có cột thứ sáu thừa bằng E2E, sửa số cột theo
  `main_count`; bỏ suy luận số lượng kết quả từ số bóng trong physics.
- [x] Đồng bộ specification và `.agent`, chạy lint/format/typecheck/unit/build
  và E2E desktop/tablet/mobile; xem ảnh desktop/mobile, review diff, cập nhật
  `task.md` với bằng chứng thực tế rồi commit nhóm SIM-04.

Baseline: `npm test` đạt 34 tests/6 files. Các thay đổi có sẵn được giữ lại;
không khẳng định chúng đã được viết theo TDD trong phiên này.

Kết quả: 42 unit pass; full E2E 86 pass/4 skip; ca đổi game giữa phiên được
bổ sung rồi chạy lại trên ba breakpoint, 3 pass. Lint/format/typecheck/build
đạt. Đã xem ảnh desktop/mobile và review độc lập. Bằng chứng/giới hạn chi
tiết ở `docs/DRAW_SIMULATION.md` và `task.md`, nhóm SIM-04.
