# 0014 — Thống kê số đặc biệt Lotto và Data Experience

- Status: accepted
- Date: 2026-11-03
- Sources: yêu cầu người dùng và xác nhận đầy đủ chỉ số cho số đặc biệt 01–12.

## Decision

Numbers API nhận `number_kind=main|special` (mặc định main); special chỉ hỗ trợ
Lotto 5/35. Tần suất/tỷ lệ/gap/last-seen/rank dùng cùng công thức và window
trong ANALYTICS nhưng positions chỉ lấy `special_number`, không cộng main.
Trang chi tiết special có lịch sử phân trang, không có cặp đi cùng. Checker,
generator và pair metrics tiếp tục main-only. Không migration hoặc ingestion.

Dense ranking giữ nguyên: cùng tần suất cùng hạng, tie xếp số/cặp tăng dần.
Bổ sung rank cho cặp; bảng và danh sách chỉ rõ hạng, danh sách dashboard rút
gọn nêu giới hạn thay vì ngụ ý chọn duy nhất một giá trị thắng đồng hạng.

Bộ lọc nằm dưới page heading; phạm vi hiển thị lấy từ response context với
số kỳ thực tế/cutoff, độc lập draft input hoặc status đồng bộ. History có
summary bộ lọc riêng, không áp analysis window vào lịch sử ngoài contract.
Lotto có selector nhóm số và dashboard riêng cho special, deep links giữ nhóm.

Cầu main xanh lá/chữ trắng, special đỏ/chữ trắng, thống nhất badges và hình
ảnh mô phỏng. Giữ nhãn special và phân biệt bằng text, không chỉ màu. Không
thay physics hoặc tuyên bố prediction.

## Validation

Fixtures tính tay và PostgreSQL: số trùng giá trị main/special, dense ties,
empty/single appearance, inclusive date/cutoff/same-day, special history paging,
game isolation, API mặc định tương thích. UI kiểm scope, filter/group switching,
late responses, tie labels, colors/contrast, desktop/mobile, keyboard và axe.
