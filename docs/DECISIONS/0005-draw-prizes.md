# 0005 — Giải thưởng theo kỳ quay

- Status: accepted
- Date: 2026-10-07
- Scope: ingestion, persistence, API và `/history/:drawId`
- Sources: yêu cầu bổ sung bảng giải thưởng và ảnh mẫu; trang Vietlott theo kỳ
  Lotto `00922`, Mega `01570`, đọc trực tiếp ngày 07/10/2026.

## Context

Nguồn có bảng hạng giải, điều kiện trúng, số lượng và giá trị giải. Dữ liệu
đã nhập chỉ có kết quả quay. Cần bổ sung kỳ cũ mà không buộc import lại toàn
bộ lịch sử trước khi sử dụng.

## Options

- Import lại toàn lịch sử: nhiều request và người dùng phải chờ.
- Đọc website mỗi lần xem: phụ thuộc nguồn cả khi dữ liệu đã có.
- Thu thập cùng draw mới, bổ sung kỳ cũ khi xem lần đầu và lưu PostgreSQL.

## Decision

Chọn phương án thứ ba. Lưu snapshot nullable của bảng giải trong `draws`,
kèm thời điểm thu thập riêng. Mỗi hạng có tên, các điều kiện main/special tách
biệt, số lượng giải nguyên không âm và tiền VND nguyên không âm. Tiền qua API
là chuỗi thập phân để JavaScript không làm tròn; UI định dạng `vi-VN` bằng BigInt.
Không suy giải của một kỳ từ kỳ khác hoặc thay dữ liệu thiếu bằng 0.

API riêng `GET /games/{game}/draws/{draw_id}/prizes` đọc snapshot đã lưu;
nếu chưa có thì gọi ingestion import có giới hạn đúng ID, `recheck=True`.
Dùng lock/retry/validation của ingestion; route chỉ điều phối HTTP. Lỗi nguồn
trả 503; đang ingestion hoặc có correction cần review trả 409. UI tải bảng
độc lập với kết quả quay, có loading/error/retry, empty và bảng responsive.

Giữ hash kết quả quay hiện có để migration không vô hiệu dữ liệu/audit cũ.
Revision payload/hash bao gồm bảng giải nếu có. Bổ sung snapshot lần đầu khi
core result không đổi là `enriched`; sau đó mọi khác biệt cần correction review.
Không xóa bảng đã biết chỉ vì lần fetch sau thiếu bảng. Version tăng khi enrich/
apply correction; checkpoint, identity và analytics main-only giữ nguyên.

## Consequences

Migration thêm JSONB và timestamp nullable, giữ toàn bộ draws/hash hiện có.
Downgrade mất bảng giải, cần backup trước. Collector tiếp tục đối chiếu 7 kỳ gần
nhất; API bổ sung kỳ cũ chỉ khi cần, không thêm cron/import toàn lịch sử.
Lần xem kỳ chưa có snapshot phụ thuộc nguồn và có thể phải thử lại khi job khác
đang chạy. Hạng Jackpot/Độc Đắc được nhấn mạnh; tiền là giá trị theo nguồn,
không tính tổng chi trả hay thưởng checker.

## Validation

Kiểm chứng ngày 07/10/2026 trên Windows, Python 3.12.14, Node 22.18, PostgreSQL 16:

- Backend: Ruff check/format, Pyright pass; **107 pytest pass**, gồm 28 test bảng
  giải. Một warning deprecation Starlette/httpx hiện có. Regression xác nhận
  correction cũ không xóa snapshot/time và HTML mất markup special bị từ chối.
- Frontend: lint/format/typecheck/build pass, **4 unit test pass**. Compose E2E:
  **41 pass, 4 skip theo thiết bị**; cả 12 ca mới pass trên desktop/tablet/mobile,
  gồm nguồn lỗi/thử lại, empty, tiền lớn, response muộn khi đổi game và Axe.
- Backup custom-format trước migration đã sao chép ra ngoài container. Upgrade
  database trống và clone restore: giữ count, core hash và game version của
  **931 Lotto + 1.571 Mega**; database ứng dụng lên head `0004_draw_prizes`.
- Compose config/build/up/readiness pass. Collector startup enrich 7 kỳ mỗi game
  thành công. Lotto `00922`/Mega `01570`: fixture nguồn, PostgreSQL và API khớp
  từng số lượng/giá trị. Hai lần đọc snapshot không đổi version/count và không
  chạy ingestion mới; kỳ `00001` cả hai game cũng bổ sung và đọc lặp thành công.
- Đã xem ảnh UI thực trên desktop/mobile: đủ 7 hạng Lotto, số 0 đúng, không tràn
  ngang. Review độc lập xác nhận hai lỗi trên đã được sửa. Không chứng minh rằng
  mọi trang lịch sử đều còn phục vụ được hoặc đã có snapshot.
