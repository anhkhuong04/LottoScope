# Quy tắc dữ liệu, ingestion và API

Nguồn: overview mục 5–6, 8–10, 13; wireframe mục 8, 21–22, 29–30.

## 1. Ingestion

- Triển khai pipeline fetch → parse → validate → normalize → persist với
  adapter/parser riêng theo source. Source-specific HTML không lọt vào service
  analytics, repository hoặc route.
- Phải ghi provenance/source cho draw. Mock/sample data phải gắn rõ nhãn và
  tách khỏi production ingestion; không điền dữ liệu ngẫu nhiên để UI có số.
- httpx có explicit timeout; retry chỉ transient failure theo policy, bounded
  attempts/backoff. Parse/validation failure không được retry mù hoặc lưu draw sai.
- Parse error phải giữ được context để xử lý source thay đổi; không trả empty
  dataset rồi log "success" khi nguồn trả cấu trúc không hiểu được.
- Chạy lại cùng input không tạo duplicate. Chống concurrency bằng unique
  `(game, draw_id)` và transaction/conflict handling; không chỉ check-before-insert.
- Khi cùng identity nhưng content khác, không âm thầm ghi đè hoặc bỏ qua.
  Theo correction/audit policy ở `docs/DATA_PIPELINE.md` và
  `docs/DATA_MODEL.md`; triển khai explicit behavior.
- Batch import phải document transaction boundary, partial failure và retry
  behavior; resume không được làm mất hoặc nhân đôi dữ liệu.
- Scheduler gọi cùng ingestion use case như import/manual trigger. Đảm bảo job
  ownership, overlap policy và shutdown rõ; không khởi scheduler qua import.

## 2. Persistence và migrations

- PostgreSQL là single source of truth. Memory/DataFrame/cache chỉ dữ liệu suy
  ra/tạm thời, không giữ draw/strategy state quan trọng duy nhất.
- Session lifecycle và transaction boundary phải rõ, phù hợp use case. Không
  dùng singleton session chia sẻ qua requests/jobs hoặc commit từng write một
  cách rời rạc trong một operation cần atomicity.
- Schema enforce unique và foreign keys nơi có relationship; invariant cần
  kiểm tra DB và application khi khả thi. Representation đã chốt trong
  `docs/DATA_MODEL.md`; không tự đổi sang bảng numbers/JSONB trong code.
- Index dựa trên query thật: game+chronological key, draw identity và lookup
  phù hợp; không tự tạo index cho mọi field.
- Mọi schema change qua Alembic migration versioned. Không dùng `create_all()`
  thay migration production hoặc tự reset DB khi schema mismatch.
- Review backfill/data preservation/compatibility; document downgrade khả thi
  hoặc giới hạn rollback cho change có mất dữ liệu.
- Dùng ORM/query parameterization. Sort/filter động phải validate theo allowlist,
  không ghép SQL trực tiếp từ input client.
- Query chronological sort có stable tie-break. Pagination không dựa vào order
  mặc định DB và không tải toàn history rồi slice trong API.

## 3. API contract

- Endpoint feature phải tuân `docs/API.md` về schema, game identifier,
  window, errors, pagination/sort và response metadata. Không coi
  route/frontend mock là API contract mới.
- FastAPI route làm request parsing/auth nếu scope có, gọi service, map response
  và domain errors. Không scrape hoặc tính analytics trực tiếp trong handler.
- Backend validate mọi input độc lập với client: game, count/range/duplicates,
  date range, window, pagination, generator config và resource limits.
- Response có typed schema; special/main tách field; missing metric không được
  đổi thành 0 để lấp UI. Trả status code phản ánh thật failure/success.
- Error contract phân biệt invalid input, upstream failure, server failure và
  không có dữ liệu; không expose tracebacks, SQL hoặc secret ra client.
- Cung cấp context đủ để client biết game/window/as-of và số draw thực tế dùng
  cho analytics. Thống nhất serialization ngày giờ/timezone, không để frontend
  tự đoán timestamp naive hoặc parse theo locale.
- History, draws containing number/pair và similar draws cần paging/limits;
  generator giới hạn số requested combinations/attempts theo contract.
- Heavy CPU analytics phải chạy qua execution model phù hợp đã chọn, không
  chặn event loop bằng cách chỉ đánh dấu function `async`.
- API trả explanation có cấu trúc; không đưa UI labels/HTML vào business core.

## 4. Cache và vận hành

- Chỉ thêm cache khi cần; key gồm game, window/cutoff, parameters và data
  version cần thiết. Ingestion/correction phải invalidation đúng.
- Không dùng cache latest khi backtesting historical cutoff hoặc reuse kết
  quả giữa hai game chỉ vì main values giống nhau.
- Phân biệt latest draw time, last successful ingestion và latest job failure;
  một lần refresh lỗi không đồng nghĩa dữ liệu đã lưu chắc chắn sai.
- Docker Compose/config phải có hướng dẫn migration, health readiness và
  persistent DB volume; backup/restore procedure kiểm chứng khi triển khai.
- Không đưa credentials thật vào repo và không tự deploy/change production
  state ngoài task được yêu cầu.
