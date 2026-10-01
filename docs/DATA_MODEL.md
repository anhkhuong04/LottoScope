# Data model MVP

PostgreSQL 16; SQLAlchemy 2.x + Alembic. Domain rules ở
[DOMAIN.md](DOMAIN.md), correction flow ở [DATA_PIPELINE.md](DATA_PIPELINE.md).
Schema này ưu tiên draw là đơn vị đọc/ghi và giữ audit cho sửa nguồn.

## `draws`

| Cột | Kiểu/constraint | Ý nghĩa |
| --- | --- | --- |
| `id` | bigint PK | Khóa nội bộ |
| `game` | text NOT NULL, CHECK thuộc `lotto_535`,`mega_645` | Game |
| `draw_id` | char(5) NOT NULL, CHECK đúng 5 chữ số | ID nguồn có số 0 đầu |
| `draw_seq` | integer NOT NULL, >0 | Số từ `draw_id` |
| `draw_date` | date NOT NULL | Ngày quay ở Việt Nam |
| `draw_time` | time NULL | Giờ kỳ quay khi nguồn có |
| `main_numbers` | smallint[] NOT NULL | Canonical sorted unique main |
| `special_number` | smallint NULL | Lotto bắt buộc 1–12; Mega NULL |
| `source_url` | text NOT NULL | Trang nguồn theo kỳ |
| `source_retrieved_at` | timestamptz NOT NULL | Lúc fetch thành công |
| `source_sha256` | char(64) NOT NULL | Hash canonical result payload; HTML layout đổi không tạo correction giả |
| `created_at`, `updated_at` | timestamptz NOT NULL | Audit, UTC aware |

Unique `(game, draw_id)` và `(game, draw_seq)`. CHECK cardinality main là 5/6
theo game; CHECK special theo game/range; `draw_seq` phải bằng biểu diễn integer
của `draw_id` qua validation ứng dụng. Range/unique/sort trong array được
validate tại domain boundary và test database integration với đường ghi chính;
không dùng direct SQL import không qua validator. Nếu cần bảo vệ ngoài đường
ghi ứng dụng, thêm DB trigger/constraint trong migration tương ứng.

Indexes: unique hai khóa trên; B-tree `(game, draw_date DESC, draw_seq DESC)`
cho latest/date/window; GIN `main_numbers` cho contains-number/pair và
similar-draw queries. Đo query plan khi có dữ liệu thật, bỏ index không phục
vụ truy vấn thực tế. Không lập bảng pair/frequency persistent trong MVP.

## Audit và trạng thái ingestion

| Bảng | Cột chính | Vai trò |
| --- | --- | --- |
| `draw_corrections` | `id`, `draw_pk` FK → `draws.id`, `status`, `old_payload` JSONB, `new_payload` JSONB, `new_sha256`, `source_url`, `source_retrieved_at`, `reason`, `resolution_note`, `created_at`, `applied_at` | Conflict chờ review và revision đã apply; giữ nội dung trước/sau |
| `ingestion_runs` | `id`, `game`, `kind`, `scope` JSONB, `started_at`, `finished_at`, `status`, counters JSONB, `error_summary` | Chạy import/collector, `running`/`success`/`partial`/`failed` |
| `ingestion_checkpoints` | `game` PK, `last_scanned_seq`, `updated_at` | Resume; ID thiếu/lỗi được ghi trong `ingestion_items` |
| `ingestion_items` | `(game, draw_seq)` PK, `status`, `attempted_at`, `error_summary`, `last_run_id` FK | Theo dõi từng ID `found`/`missing`/`invalid`/`failed`; `excluded` là kỳ ngoài date filter, chưa được nhập |
| `game_data_state` | `game` PK, `version` bigint, `updated_at` | Version tăng trong transaction insert/correction để gắn response/cache |

Payload JSONB trong audit giữ canonical draw fields; `new_sha256` là hash của
payload mới. Unique partial `(draw_pk, new_sha256)` cho status `pending` tránh
ghi lặp cùng một conflict. Audit không là nguồn truy vấn analytics. Source HTML
thô không bắt buộc lưu trong DB; fixtures parser đã rút gọn dùng trong tests.
Corrections phải apply trong transaction
cùng draw update, audit status và `game_data_state.version` increment.

## Transaction và migration

Session scoped theo request/job, không chia sẻ global session. Insert một draw,
checkpoint/item và version update là một transaction; conflict ghi audit và
trạng thái job trong transaction rõ. DB unique constraint chống race, kể cả
hai job đọc cùng ID. API chỉ đọc committed draws. Mọi thay đổi schema qua
Alembic; migration upgrade trên DB trống và DB có dữ liệu được test với
PostgreSQL thật. Rollback có thể mất dữ liệu phải nêu giới hạn, không tự reset.
Downgrade `0003` xóa bảng ingestion tracking nhưng giữ bảng draw; chỉ chạy sau
backup nếu cần giữ run/checkpoint/audit import.

Backup bằng `pg_dump` theo lịch vận hành; kiểm tra restore trên DB riêng và
đối chiếu count/hash/mẫu trước nghiệm thu. DataFrame chỉ là bộ nhớ xử lý tạm.
