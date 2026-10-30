# Đánh giá UI/UX LottoScope — 29/10/2026

Đây là bản **đánh giá trước visual refresh**. Các đề xuất sau đó được người
dùng yêu cầu triển khai; kết quả thực hiện ở [biên bản UI](UI_REFRESH_ACCEPTANCE.md).
Mục tiêu người dùng: giao diện sinh động, hiện đại, clean. Đánh giá bằng skill
`ui-ux-pro-max`, ảnh chụp website thật, kiểm tương tác trình duyệt và đối chiếu
[wireframe](wireframe.md), [quy tắc frontend](../.agent/FRONTEND.md).

## Kết luận

LottoScope có nền tảng của một dashboard sạch và dễ hiểu: palette navy/teal
nhất quán, số rõ, controls có label, điều hướng desktop/mobile riêng, giữ được
context game/phạm vi. Điểm yếu chính là **thứ bậc thông tin và cách phân bố
không gian**, sau đó là phản hồi tương tác. Hiện giao diện tạo cảm giác công
cụ quản trị hơn là một sản phẩm dữ liệu có nhận diện riêng.

Đề xuất hướng **dashboard hiện đại, nền sáng, điểm nhấn teal và chuyển động
nhẹ**. Giữ khả năng đọc dữ liệu; tăng sức sống bằng bố cục, typography, biểu
đồ và trạng thái tương tác. Ưu tiên cải thiện layout hiện có trước khi thêm
thư viện hoặc hiệu ứng.

## Phạm vi và bằng chứng

- Website: https://lottoscope-sable.vercel.app, bản frontend favicon `14f8a8a`.
- Sáu màn hình: Tổng quan, Lịch sử, Số, Cặp số, Kiểm tra, Lồng cầu; mỗi màn
  hình ở desktop **1440 × 1000** và mobile **390 × 844**, dùng API thật,
  game Lotto 5/35. Kiểm thêm lưới Power 6/55 ở rộng **320/768/1024 px**.
- Chụp đủ 12 trang, đọc layout/controls, chạy axe các tag WCAG 2 A/AA,
  2.1 AA và 2.2 AA. **Không ghi nhận violation tự động hoặc tràn ngang**
  trong 12 trạng thái đã đo. Điều này không phải chứng nhận WCAG toàn website.
- Kiểm thủ công menu mobile bằng Escape/chạm ngoài/chuyển trang; quan sát
  cả lồng cầu bình thường và chế độ reduced motion. Không chạy trọn phiên
  quay vật lý hay đánh giá phân phối kết quả trong audit này.
- Trạng thái tải chậm được **giả lập ở trình duyệt bằng trì hoãn API**, không
  phải số đo cold start tự nhiên của Render. Không gọi sync hay sửa dữ liệu.
- Ảnh và JSON kiểm chứng local ở `.render/ui-audit/` (ignored), gồm
  `results.json`, `extra-results.json` và các screenshot theo device/route.
  Ảnh full-page có fixed navigation có thể đặt thanh điều hướng ở vị trí khác
  trong ảnh ghép; đánh giá màn hình đầu dùng ảnh viewport riêng.
- Đây là heuristic review của agent, chưa có phỏng vấn người dùng, session
  recording hoặc số liệu về mức sử dụng. Không suy ra conversion hay hiệu
  năng thiết bị thật từ screenshot/headless browser.

Skill gợi ý minimalism, grid, phân cấp chữ và motion có chủ đích. Kết quả
`--design-system` tự động còn có mẫu enterprise marketing/contact sales;
phần này không phù hợp ứng dụng phân tích nên không áp dụng. Không thay
palette/font hiện có chỉ để khớp một template của skill.

## Những điểm nên giữ

1. **Nhận diện navy/teal/mint:** hợp website dữ liệu và đã có favicon riêng.
2. **Sidebar và bottom navigation:** active state rõ; mobile có safe-area
   padding, controls chính phần lớn đủ kích thước thao tác.
3. **Dữ liệu có ngữ cảnh:** game, phạm vi, latest draw và thời điểm đồng bộ
   hiện diện; main/special phân biệt bằng cả chữ lẫn màu.
4. **Số và bảng dễ quét:** biểu diễn 2 chữ số; có grid/table và sắp xếp.
5. **Tính trung thực:** thông báo dữ liệu cũ, lỗi đồng bộ, kết quả mô phỏng và
   giới hạn không dự đoán. Lồng cầu có tùy chọn ẩn hình ảnh chuyển động.

## Phát hiện và đề xuất theo ưu tiên

| ID | Mức | Quan sát thực tế | Tác động và cải thiện |
| --- | --- | --- | --- |
| UX-01 | P1 | Mobile: 4 KPI xếp dọc; card kết quả gần nhất bắt đầu ở **y ≈923 px**, dưới viewport cao 844 px | Nội dung cần xem nhanh xuất hiện muộn. Đưa kết quả gần nhất lên đầu; KPI 2 × 2 nếu đủ chỗ, hoặc dùng một dải thông tin gọn. Kiểm đủ Power và chữ dài ở 320 px. |
| UX-02 | P1 | Dashboard desktop: các card trong cùng hàng bị stretch bằng chiều cao; card gap và cặp số có khoảng trắng rất lớn | Phân biệt khoảng thở có chủ đích với vùng rỗng. Dùng layout theo nhóm nội dung, card phụ tự cao; không đặt 5 dòng gap cạnh danh sách lịch sử dài rồi kéo cao bằng nhau. |
| UX-03 | P1 | Dòng “Lấy kỳ mới…” và nút Tải dữ liệu đứng trên tiêu đề ở mọi màn hình | Tác vụ vận hành chiếm phần mở đầu cả checker/lồng cầu. Gộp vào cụm trạng thái dữ liệu gọn; giữ đường truy cập sync rõ nhưng ở vai trò thứ cấp. Khi sync lỗi, giữ thông báo có thể đọc lại. |
| UX-04 | P1 | Menu “Thêm” vẫn mở sau Escape và chạm vào topbar bên ngoài | Bổ sung Escape, outside click và focus trở về trigger khi đóng. Nếu giữ là popover thì dùng semantics/focus phù hợp; chỉ trap focus nếu chuyển thành modal sheet. Điều hướng qua link hiện đóng menu được, nhưng focus rơi về BODY. |
| UX-05 | P1 | Khi API khởi đầu chậm, chỉ có card “Đang tải danh sách game…” trên vùng nội dung gần trống | Giữ shell và dùng skeleton đúng layout; có status cho screen reader. Với chờ lâu, giải thích đang kết nối dịch vụ, đưa retry sau lỗi/timeout. Không hứa một thời gian tải chưa đo. |
| UX-06 | P2 | Các KPI, kết quả mới nhất, trạng thái đồng bộ có trọng lượng thị giác gần nhau | Tạo một card kết quả chủ đạo; KPI phụ gọn. Số kết quả lớn hơn số liệu phụ, metadata nhẹ hơn nhưng vẫn đủ tương phản. Tình trạng nguồn là badge/chi tiết mở rộng, không chiếm cả card ngang trọng lượng với kết quả. |
| UX-07 | P2 | Lưới tần suất có ô gần như đồng màu dù tần suất khác nhau | Thêm thanh tỷ lệ nhỏ hoặc heatmap một dải teal với legend và số lượng luôn hiển thị. Có dạng bảng thay thế. Màu chỉ mô tả tần suất trong phạm vi, không diễn giải cơ hội thắng. |
| UX-08 | P2 | Filter phạm vi, sort, view chia thành nhiều hàng với khoảng trống lớn ở trang Số/Cặp số | Gộp thành toolbar thống nhất, có nhãn. Mobile ưu tiên phạm vi và một nút lọc mở rộng; luôn thấy trạng thái filter đang áp dụng. Sticky toolbar chỉ khi không chiếm quá nhiều chiều cao. |
| UX-09 | P2 | Dashboard có nút “Làm mới hiển thị” lặp trong nhiều widget; song song với “Tải dữ liệu” | Tách nghĩa bằng microcopy rõ: “Cập nhật từ Vietlott” và “Làm mới thống kê”. Cân nhắc một refresh chung cho cùng context, giữ retry riêng khi widget lỗi. Không gộp hai hành vi thành một nút gây hiểu nhầm. |
| UX-10 | P2 | Link cặp số trên dashboard cao khoảng 36 px; link số trong gap cao khoảng 17 px, dù hàng có khoảng trống | Mở vùng bấm thành cả hàng hoặc padded link 44 px theo chuẩn dự án. Không kết luận mọi link nhỏ đều vi phạm WCAG: tiêu chuẩn web có ngoại lệ inline/spacing. |
| UX-11 | P2 | Sidebar/mobile dùng biểu tượng Activity; favicon dùng kính lúp/biểu đồ | Dùng cùng một brand mark cho nhận diện thống nhất; giữ icon UI Lucide. Chỉnh thông qua asset/component chung, không thay mọi icon bằng logo. |
| UX-12 | P2 | Toàn bộ 35 số chiếm một card rất dài trên dashboard mobile; vùng tần suất bắt đầu ở **y ≈1661 px**, toàn trang cao **4547 px** | Dashboard hiển thị tóm tắt có ích, dẫn tới trang Số đầy đủ. Lịch sử gần đây giới hạn ngắn, phần phụ mở rộng khi cần. Không cắt mất dữ liệu trên màn hình phân tích chuyên biệt. |
| UX-13 | P2 | Checker có một card kết quả rất rộng nhưng chỉ một câu khi chưa chọn số | Empty state có các slot chọn số, tiến trình “0/5” và hướng dẫn ngắn. Sau chọn đủ, CTA nổi bật; sau submit dẫn focus tới heading kết quả. Mobile cân nhắc action bar gọn phía trên bottom nav, tránh che nội dung. |
| UX-14 | P2 | CSS shell chưa có transition/animation; cảm giác phản hồi chủ yếu đổi màu ngay lập tức | Thêm hover/press/focus có nhịp chung; loading/data update chuyển nhẹ. Không animate liên tục các card hoặc chặn thao tác trong lúc chuyển động. |
| UX-15 | P3 | Bảng Cặp số 25 hàng tạo trang dài (desktop khoảng 2554 px); pagination ở cuối | Header bảng sticky, lựa chọn mật độ hợp lý, có summary/pagination gần đầu trên trang dài. Giữ nút/row dễ bấm; không giảm chiều cao bằng cách làm chữ quá nhỏ. |
| UX-16 | P3 | Mục “Số” khá chung; hai màn hình phân tích nằm sau “Thêm” trên mobile | Đổi nhãn rõ hơn như “Phân tích số”. Cân nhắc nhóm “Phân tích” trong nav sau khi xác nhận tác vụ thường dùng; không tự kết luận phải thay bottom nav khi chưa có dữ liệu sử dụng. |

P1: cải thiện khả năng sử dụng nền tảng. P2: thay đổi chính để đạt mục tiêu
modern/clean/sinh động. P3: tối ưu sau khi xem bản thiết kế và thử tác vụ thực.

## Hướng thiết kế đề xuất

### Bố cục dashboard

Desktop:

1. Header: logo, game, trạng thái dữ liệu gọn; đường dẫn cập nhật nguồn.
2. Tiêu đề và phạm vi phân tích cùng một vùng điều khiển.
3. Kết quả gần nhất làm khối chủ đạo, bên cạnh là KPI tóm tắt.
4. Tần suất và khoảng cách có chiều cao phù hợp lượng thông tin.
5. Cặp thường gặp và lịch sử gần đây; link tới màn hình chi tiết.

Mobile:

1. Header gọn và game.
2. Tên màn hình + phạm vi.
3. Kết quả gần nhất + ngày/kỳ, trạng thái nguồn gọn.
4. KPI phụ 2 cột khi đủ chỗ.
5. Tóm tắt phân tích và đường dẫn “Xem tất cả”.
6. Bottom nav giữ ổn định, không đè nội dung/action bar.

Đây là đề xuất thứ tự thông tin; vẫn giữ URL, selected game/window và luồng
main/special hiện tại. Không thêm landing page marketing trước dashboard.

### Màu sắc, chữ và bề mặt

| Thành phần | Hướng đề xuất |
| --- | --- |
| Nền | Off-white hiện có; giảm số lớp nền/viền lồng nhau |
| Chữ chính | Navy hiện có; tiêu đề rõ, nội dung mô tả 14–16 px tùy vai trò |
| Hành động chính | Teal đậm; mint dùng cho điểm nhấn và trạng thái active |
| Kết quả mới nhất | Tint teal rất nhẹ hoặc gradient nhẹ trong một card chủ đạo |
| Số đặc biệt | Amber + label “Đặc biệt”; không dựa riêng màu |
| Card | Radius khoảng 16–20 px; viền mảnh, shadow nhẹ ở cấp cần nổi |
| Font | Giữ Outfit/DM Sans nếu chữ Việt render tốt; chuẩn hóa weight/line-height trước khi đổi font |
| Số liệu | Tabular numerals cho metric/bảng để căn hàng ổn định |
| Spacing | Một thang 4/8/12/16/24/32 px; khoảng cách lớn để phân nhóm, không kéo cao card rỗng |

Các giá trị mới là đề xuất, phải kiểm contrast với foreground/background thực
tế. WCAG AA cho text thường là **4.5:1**, text lớn **3:1**;
[nguồn W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Chuẩn dự án đặt touch target 44 px; WCAG 2.2 AA target minimum **24 × 24 CSS
px** có ngoại lệ/spacing, không đồng nhất hai mức này;
[nguồn W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

### Sinh động bằng phản hồi tương tác

- Hover/press nút và card có link: khoảng 120–180 ms; không nâng card dữ liệu
  tĩnh khiến người dùng nghĩ có thể bấm. Hover có thể dịch tối đa 1–2 px,
  focus luôn rõ bằng outline và màu đủ tương phản.
- Nội dung sau đổi filter: fade ngắn khoảng 160–220 ms; skeleton giữ kích
  thước. Dữ liệu context cũ không xuất hiện dưới nhãn game mới.
- Bar chart có thể mở nhẹ trong 200–300 ms khi lần đầu có dữ liệu; giá trị
  số hiện ngay, không đợi count-up mới biết kết quả.
- Badge báo cập nhật xong có icon + chữ; lỗi nguồn giữ đường khôi phục và
  dữ liệu cũ. Không dùng chấm xanh “Live” khi nguồn đang bị challenge.
- Tôn trọng `prefers-reduced-motion` cho các hiệu ứng mới, giữ hoạt động
  tương đương khi tắt motion. Lồng cầu đã có lựa chọn ẩn hình ảnh; giữ riêng
  cơ chế mô phỏng, không sửa vật lý chỉ để đổi visual.

Không cần carousel, video nền hoặc 3D ngoài màn hình lồng cầu để đạt phong
cách này. Không cần thêm thư viện animation cho các transition đơn giản.

## Trình tự cải thiện và nghiệm thu đề xuất

**Đợt 1 — Foundation:** sửa menu, loading, phân cấp header/status và layout
dashboard. Kiểm viewport 320/390/768/1024/1440, đủ ba game, không tràn ngang;
kết quả mới nhất hiện trong màn hình đầu hoặc sau một lần cuộn ngắn tại
390 × 844 với trạng thái tải xong. Không giữ card phụ rỗng do stretch.

**Đợt 2 — Visual và data:** brand mark thống nhất, toolbar, card kết quả chủ
đạo, biểu diễn tần suất, empty state checker, motion tokens. Kiểm bảng/
legend/keyboard/reduced motion; giữ chính xác formula, số liệu, filter URL,
main/special và trạng thái stale.

**Đợt 3 — Kiểm tác vụ:** thử xem kỳ mới nhất → đổi game → xem số/cặp → kiểm
tra bộ số trên desktop/mobile. Kiểm tab/Shift+Tab/Escape, focus sau điều
hướng và submit; loading/error/no-data. Chạy frontend gates và E2E liên
quan trước khi deploy. Audit tự động vẫn cần kết hợp kiểm thủ công.

Chỉ xem xét đổi cấu trúc navigation hoặc mật độ bảng sau khi thử tác vụ.
Hiệu năng lồng cầu cần đo trên điện thoại thật; bundle DrawScene lớn đã có
trong build hiện tại nhưng screenshot không chứng minh độ mượt hay FPS.

Không có yêu cầu thêm prediction, score khả năng thắng, saved picks, auth,
AI hoặc Phase 2 trong đề xuất này. Các chi tiết triển khai tương lai phải
được đối chiếu specification và nghiệm thu; báo cáo không tự thay requirement.
