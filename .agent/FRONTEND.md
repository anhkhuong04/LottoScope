# Quy tắc frontend

Áp dụng khi task yêu cầu giao diện hoặc integration cho giao diện. Nguồn UX:
`docs/wireframe.md`. Domain/backend vẫn có thẩm quyền về business behavior.

## 1. Scope và cấu trúc

- Không tự bootstrap frontend trong task MVP backend. Khi task có frontend,
  làm theo MVP screens và implementation order ở wireframe mục 32–33.
- `/` dẫn tới `/dashboard`; các khu vực chính là history, numbers/detail,
  pairs/detail, checker, generator. Routes trong wireframe là đề xuất; nếu
  thay đổi cần giữ deep-link/user flow và document lý do.
- Strategies/backtesting/saved picks thuộc Phase 2. Settings/theme là optional.
  Không render chức năng giả hoạt động chỉ để làm navigation đầy đủ.
- Framework, versions, component/chart libraries chưa được chọn: quyết định
  theo use case trong task, ghi ADR; không thêm stack mặc định theo sở thích.
- Ưu tiên feature-based structure và shared components thực sự dùng lại:
  game selector, analysis window, number ball, metric card, table và states.
- Frontend làm presentation và validation input; không tính core frequency,
  gap, pair, checker, generator hoặc backtest thay backend.

## 2. Context, state và dữ liệu

- Global state: selected game/preferences; URL state: window/filter/page/sort;
  server state: API data; local UI state: drawer/modal/temporary form values.
  Không nhân đôi server data vào nhiều global stores.
- Analysis default ở UI là last 30 draws, các lựa chọn 10/20/30/50/100,
  custom range/all time; core API vẫn nhận window rõ ràng.
- Chuyển game phải reload đúng context và reset combination khi rules thay
  đổi. Chỉ giữ window/filter còn hợp lệ; không hiện Lotto data dưới Mega label.
- Query/cache keys và request context phải bao gồm game/window/filters cần
  thiết. Hủy hoặc bỏ response đến muộn khi context đổi.
- Filter quan trọng nên deep-link; refresh và browser back/forward phải giữ
  đúng context. Thống nhất URL values với API contract.
- Không tải toàn lịch sử hay render hàng nghìn rows; dùng paging phía backend.
- Data thật đến từ API. Fixture/demo có nhãn rõ; không dùng mock làm fallback
  cho API lỗi hoặc suy ra source freshness từ thời điểm browser fetch.

## 3. Input và results

- Checker ưu tiên number picker/token input; validate ngay duplicate/range/
  thiếu/thừa số theo game definition chung. Backend vẫn validate độc lập.
- Main và special hiển thị tách biệt; `docs/DOMAIN.md` chốt checker MVP
  main-only. Không thêm full-ticket mode hoặc chèn special vào main tokens.
- Kết quả checker theo thứ tự: exact match → overlap summary → similar draws
  → per-number analytics → pairs; không bắt đầu bằng score tổng hợp.
- Rule generator có toggle/value/help text; hỗ trợ chỉ bật rule người dùng chọn,
  validate constraints và hiển thị partial/no-result theo status từ backend.
- Mỗi generated result có explanation; desktop dùng drawer, mobile dùng
  full-screen sheet/page phù hợp. Không viết logic rule lần hai trong UI.
- Display số 2 chữ số; màu/ball chỉ phục vụ nhận diện dữ liệu, không tạo hàm ý
  số tốt/xấu hoặc sắp thắng.

## 4. Loading, empty, error và freshness

- Data section có loading riêng; không block toàn màn hình khi một widget
  reload. Đổi toàn game context có thể dùng page loading.
- Phân biệt network/server/invalid-input/no-data/stale. No exact match là kết
  quả hợp lệ; không hiển thị như lỗi.
- Giữ dữ liệu cũ còn hợp lệ khi refresh cùng context thất bại và label stale/
  retry rõ. Không giữ dữ liệu context cũ dưới game/window mới.
- Không biểu diễn missing bằng 0, "never appeared" hay timestamp tự tạo.
- Freshness thể hiện dữ liệu cập nhật chậm, không suy ra dữ liệu cũ chắc chắn sai.

## 5. Responsive, accessibility và visualizations

- Desktop ≥1024px: sidebar, tables/charts, generator cạnh results.
  Tablet 768–1023px: collapsible sidebar, layout thu gọn.
  Mobile <768px: bottom nav, single column, cards/sheets khi phù hợp.
- Primary workflow mobile không yêu cầu horizontal scroll; bảng phụ có thể
  scroll khi cần. Touch target ít nhất 44px; mọi màn hình test desktop/mobile.
- Semantic headings, label forms, keyboard navigation, visible focus và
  contrast rõ. Drawer/modal quản lý focus đúng; chart có textual summary/
  fallback. Không dùng color làm tín hiệu duy nhất.
- Frequency dùng bar chart/grid; gap dùng sorted bar/table; timeline đơn giản;
  không dùng pie chart cho toàn 35/45 số hoặc roulette/slot animation.
- Tables có sort/paging/empty/focus phù hợp; không client-filter toàn dataset
  khi API đã hỗ trợ.
- UI wording dùng Frequency/Gap/Historical overlap/Backtest result; không
  Best number, Guaranteed, Most likely to win, prediction score hoặc winning
  probability khi chưa có mô hình/spec hợp lệ.
- Visual branding/tokens chưa khóa bởi wireframe. Chọn nhất quán và document
  khi xây UI; không tự mở rộng feature để tận dụng component library.
