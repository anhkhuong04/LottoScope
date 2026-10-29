# Modern clean UI — nghiệm thu 29/10/2026

Yêu cầu: thực hiện hướng [UI/UX audit](UI_UX_AUDIT.md), lần lượt bố cục
dashboard/mobile → loading/menu → biểu đồ/typography → micro-interactions.
[Design system](DESIGN_SYSTEM.md) ghi quy ước presentation đã áp dụng.

## Thay đổi đã thực hiện

- **UI-01, `43e8758`:** kết quả mới nhất trước KPI, KPI mobile 2 cột;
  card phụ theo nội dung, dashboard tóm tắt 6 số/3 kỳ gần đây và dẫn tới màn
  hình đầy đủ. Giữ API/game/window/main/special; refresh chung chỉ đọc.
- **UI-02, `71182be`:** chuyển thao tác đồng bộ lên header, feedback giữ tên
  game yêu cầu và có nút đóng; skeleton với accessible status, thông báo chờ
  lâu sau 8 giây. Menu Thêm hỗ trợ Escape/chạm ngoài/focus; có skip link;
  logo sidebar/mobile dùng chung favicon mark.
- **UI-03, `012a8fe`:** number tile có thanh tần suất, số liệu và legend;
  table view giữ đầy đủ chỉ số. Toolbar thống nhất; tabular numerals, phân
  cấp typography; bảng desktop có vùng cuộn/header sticky/keyboard focus,
  mobile không giới hạn chiều cao. Checker có empty state và focus kết quả.
- **UI-04, `a56c58f`:** motion tokens 140/220 ms, hover/press, chart reveal,
  hero/skeleton/busy feedback; reduced motion giữ nội dung và tắt animation.
  Route mới focus main/cuộn đầu, không ép scroll với POP/query change.

Không thêm dependency, không sửa backend/schema/migration/collector/physics.
Không thêm prediction/score hoặc giả dữ liệu khi tải/lỗi. Asset `logo.png`
untracked của người dùng không được đưa vào commit/deploy.

## Kiểm chứng local của release `a56c58f`

| Nhóm | Kết quả |
| --- | --- |
| Lint / format / TypeScript / production build | Đạt; DrawScene vẫn có warning bundle lớn đã tồn tại |
| Unit suite cuối | **59 tests, 8 files pass** với `--maxWorkers=1` |
| E2E tổng thể | **78 pass / 6 skip** trên desktop/tablet/mobile; skip đúng điều kiện device |
| Lượt quay vật lý Lotto đầy đủ | **2 pass** desktop/mobile, gồm main rồi special, pause/resume, copy và checker handoff |
| Automated axe | Đạt trên các key screens và trạng thái kết thúc lượt quay được test; không là chứng nhận WCAG toàn site |
| Responsive | MVP routes tại 320/390/768/820/1024/1365 px không tràn ngang; dashboard kết quả trước KPI, full Power grid giữ 55 số |
| Loading / stale / error | Skeleton không tạo giá trị giả; retry giữ dữ liệu cùng context; game switch/late response không trộn game |
| Navigation / keyboard | Menu open/Escape/outside/focus, deep links, browser history/filter URL, pagination và skip/focus presentation |
| Reduced motion | Animation chart tắt, giá trị vẫn đọc được; lồng cầu giữ tùy chọn ẩn hình ảnh |

Unit suite mặc định từng bị worker startup timeout khi chạy đồng thời với
E2E/3D; không coi lượt đó là pass. Chạy lại với số worker giới hạn đạt đầy đủ
59 tests, không skip test hay giảm typing/lint. E2E sync dùng intercepted POST,
không dùng nguồn Vietlott thật để quyết định suite pass.

Đã xem ảnh render dashboard/numbers/checker desktop/mobile ở `.render/`
ignored; ảnh kết thúc phiên quay ở `frontend/test-results/` ignored. Dữ liệu
API local thật phục vụ kiểm UI, fixture chỉ dùng cho các nhánh lỗi/prize/sync
có chủ đích trong tests. Chưa đo hiệu năng/FPS trên điện thoại vật lý.

## Cloud

Đã triển khai release frontend `a56c58f16e6437d7a931d43d654139d9dcb0322a`
lên Vercel Hobby, deployment `dpl_92mLf2RoMGNpR4gMrUTqQFKcDXG3` **ready**.
URL: **https://lottoscope-sable.vercel.app**. Vercel build gates và 59 unit
tests đạt trên build machine thật; Node gateway vẫn được deploy cùng assets.
Backend Render/Neon giữ nguyên.

- Cloud HTTP smoke ba game/latest/analytics window 30, origin guard, no-store,
  JSON 404 và sáu deep links đạt. 10 concurrent reads hoàn tất trong 997 ms
  trong một burst nhỏ, không phải SLA/load benchmark.
- **19 browser tests pass / 2 skip đúng device** trên desktop/tablet/mobile:
  dashboard/number detail/game/window, pair detail, checker POST, mở lồng cầu,
  skeleton với GET delay giả lập, menu và reduced motion. Ngoài GET delay có
  chủ đích cho loading, các flow dùng API cloud thật, không gọi sync nguồn.
- Đã xem screenshot production desktop/mobile. Power dashboard tại rộng
  320/390/1440 px không tràn ngang, giữ 6 main và 1 special riêng; kết quả bắt
  đầu lần lượt y=303/280/229 px. JSON/ảnh ở `.render/ui-live-*` ignored.
- Không đo lại cold start tự nhiên hay FPS điện thoại vật lý. Lượt quay đầy
  đủ được kiểm local ở trên, cloud chỉ kiểm mở lồng cầu/luồng dữ liệu.

Giới hạn nguồn dữ liệu/cold start/backup của lần triển khai đầu vẫn theo
[biên bản cloud](DEPLOYMENT_ACCEPTANCE.md); visual refresh không thay collector
hay giải quyết Cloudflare challenge của nguồn.
