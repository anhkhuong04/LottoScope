# Domain contract

Đây là nguồn chuẩn cho game rules, identity và thời gian. Metric ở
[ANALYTICS.md](ANALYTICS.md), schema ở [DATA_MODEL.md](DATA_MODEL.md), HTTP
serialization ở [API.md](API.md).

## Game và giá trị hợp lệ

| `game` | Main | Special trong draw |
| --- | --- | --- |
| `lotto_535` | 5 integer khác nhau, 1–35 | 1 integer, 1–12, bắt buộc |
| `mega_645` | 6 integer khác nhau, 1–45 | `null`, không được cung cấp số |
| `power_655` | 6 integer khác nhau, 1–55 | 1 integer, 1–55, bắt buộc và không thuộc main |

Power chọn special từ 49 số còn lại sau sáu main. Đây là kết quả quay,
không phải số thứ bảy người dùng nhập. Lotto special thuộc miền riêng 1–12
và được phép có cùng giá trị với một main. Nguồn luật Power:
[thể lệ Vietlott](https://vietlott.vn/static.vietlott.vn/uploads/Files/QUYET%20DINH/TH%E1%BB%82%20L%E1%BB%86%20THAM%20GIA%20D%E1%BB%B0%20TH%C6%AF%E1%BB%9ENG%20POWER%20655.pdf).

Validation từ chối thiếu/thừa số, duplicate main, boolean/float/string thay
integer trong domain, số ngoài miền và game lạ. Parser nguồn có thể chuyển
chuỗi số đã nhận diện thành integer trước validation; API JSON không tự ép
kiểu. `special_number` có vai trò riêng theo game, không tham gia main frequency, pair,
overlap hay main-only exact match. Số được lưu là integer; UI định dạng 2 chữ số.

## Bảng giải thưởng công bố

Snapshot theo `(game, draw_id)` gồm các hạng theo thứ tự nguồn: tên, điều kiện
trúng (`main_count`, `special` tách biệt), số lượng giải và giá trị VND nguyên
không âm. Một hạng có thể có nhiều điều kiện, như Khuyến Khích Lotto. Không
tính thưởng vé/checker hoặc tổng chi trả từ bảng này; giá trị giữ đúng công bố
của Vietlott. Thiếu snapshot là chưa biết, khác với số lượng giải bằng 0.

Power có năm hạng theo thứ tự: Jackpot 1 (`6,false`), Jackpot 2 (`5,true`),
Giải Nhất (`5,false`), Giải Nhì (`4,false`), Giải Ba (`3,false`). `special`
trong điều kiện mô tả ký hiệu công bố, không biến checker thành tính thưởng vé.
Jackpot lấy giá trị đúng kỳ từ nguồn, không suy ra bằng mức tối thiểu/tích lũy.

Bổ sung snapshot đầu tiên khi kết quả quay không đổi được phép; snapshot đã
có thay đổi phải review correction. Thiếu bảng trong một lần fetch không xóa
snapshot cũ và thời điểm thu thập, kể cả khi áp dụng correction kết quả quay
không chứa bảng giải. Hash kết quả quay giữ nguyên; revision payload/hash có
thêm bảng giải nếu biết, không bao gồm thời điểm fetch. Quyết định ở
[ADR 0005](DECISIONS/0005-draw-prizes.md).

## Identity

- Draw: `(game, draw_id)` unique. `draw_id` là chuỗi kỳ quay đúng 5 chữ số
  theo trang nguồn (ví dụ `00830`); không bỏ số 0 đầu. `draw_seq` là integer
  suy ra từ ID để hỗ trợ thứ tự và kiểm tra. Nếu nguồn đổi format, parser dừng
  và yêu cầu cập nhật contract thay vì ép ID không hợp lệ.
- Draw payload: `draw_date`, `draw_time` tùy chọn, main numbers canonical
  tăng dần, special (theo game), source/provenance. Kết quả cùng combination
  ở hai kỳ vẫn là hai draw khác nhau.
- Main combination: `(game, sorted_main_numbers)`. Thứ tự nhập không tạo
  combination mới. Pair là hai main khác nhau, canonical `(smaller, larger)`.
- Checker/generator dùng **main-only** cho cả ba game. Lotto/Power `special_number` chỉ hiển thị
  trong draw; mode full ticket chưa thuộc MVP. Exact match của checker vì thế
  so main và game, không so special.

## Thời gian và thứ tự

- Ngày/giờ kỳ quay được hiểu ở `Asia/Ho_Chi_Minh` (UTC+07). `draw_date` là
  local calendar date; `draw_time` chỉ lưu khi nguồn công bố giờ cho kỳ cụ
  thể. Không suy giờ quay dự kiến thành giờ kết quả thực tế.
- `created_at`, `updated_at`, `source_retrieved_at` là timestamp aware UTC.
  Không lấy các trường này làm thời điểm kỳ quay.
- Chronological order theo `(draw_date ASC, draw_seq ASC)` trong từng game;
  reverse cho latest. Hai draw cùng ngày phân biệt bằng `draw_seq`, kể cả khi
  không có `draw_time`. Nếu ID/date của nguồn mâu thuẫn với thứ tự đã lưu,
  đưa vào trạng thái lỗi để kiểm tra, không âm thầm đổi thứ tự.
- Filter `from_date`/`to_date` lấy **cả hai ngày đầu/cuối** theo local date;
  `from_date > to_date` là input lỗi. Không dùng ngày UTC để lọc ngày quay.
- `as_of_draw_id` (nếu được cung cấp) là cutoff **inclusive**: chỉ dùng draw
  cùng game có chronological key `<=` kỳ đó. Default là latest draw đã lưu;
  khi game chưa có draw, cutoff là `null` và dataset rỗng. Cutoff explicit không
  tồn tại trong game là lỗi, không fallback sang latest.
- `reference_date` cho rule theo ngày là local date ghi rõ trong request/response;
  khi không cung cấp, service chụp ngày hiện tại một lần tại đầu request. Phase 2
  backtest phải dùng cutoff trước draw đánh giá và ngày của draw đánh giá.

Ví dụ nguồn chính thức có Lotto [`00829`](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00829&nocatche=1)
và [`00830`](https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00830&nocatche=1)
cùng ngày 17/08/2026: `00829` đứng trước `00830` dù `draw_time` thiếu.

## Ví dụ lỗi

| Input | Kết quả |
| --- | --- |
| Lotto main `[7,19,19,29,33]` | Duplicate `19`, từ chối; không tự bỏ bớt |
| Lotto main `[7,19,25,29,36]` | `36` ngoài 1–35 |
| Lotto draw thiếu special | Draw không hợp lệ |
| Mega draw có special `4` | Draw không hợp lệ |
| Power thiếu special, special `56` hoặc thuộc main | Draw không hợp lệ |
| Draw có `draw_date` hợp lệ nhưng `draw_id` không phải 5 chữ số | Đưa vào lỗi nguồn/validation |
