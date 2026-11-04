# DATA-01 — Lotto special analytics và Data Experience

Thực hiện inline theo ADR 0014 và phạm vi người dùng đã chốt.

- [x] Backend RED→GREEN: `number_kind` cho metrics/list/detail; special Lotto
  01–12, same formulas/main isolation; repository filter special cho appearances.
  Rank cặp dense, contracts thêm field tương thích; PostgreSQL/API regression.
- [x] Frontend RED→GREEN: selector nhóm số Lotto, special list/detail/history,
  dashboard special; scope từ response; filters cùng vị trí dưới heading;
  rank/tie captions, history summary và links có context.
- [x] Badge/texture xanh lá-trắng và đỏ-trắng; giữ physics, special labels và
  accessible contrast. Không thêm dependencies.
- [x] Cập nhật Domain/Analytics/API/design rules và nghiệm thu có references;
  backend Ruff/format/Pyright/full pytest trên *_test; frontend gates/full unit,
  E2E theo luồng mới và hồi quy; chạy các Playwright tuần tự, không chung artifacts.
- [x] Review độc lập, sửa lỗi có regression, kiểm hình ảnh và commit milestone.
  Không deploy hoặc ghi production; giữ file người dùng đang xóa và references.
