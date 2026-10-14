# Data model MVP

PostgreSQL 16; SQLAlchemy 2.x + Alembic. Domain rules ở
[DOMAIN.md](DOMAIN.md), correction flow ở [DATA_PIPELINE.md](DATA_PIPELINE.md).
Schema này ưu tiên draw là đơn vị đọc/ghi và giữ audit cho sửa nguồn.

## `draws`

| Cột | Kiểu/constraint | Ý nghĩa |
| --- | --- | --- |
| `id` | bigint PK | Khóa nội bộ |
| `game` | text NOT NULL, CHECK thuộc `lotto_535`,`mega_645`,`power_655` | Game |
| `draw_id` | char(5) NOT NULL, CHECK đúng 5 chữ số | ID nguồn có số 0 đầu |
| `draw_seq` | integer NOT NULL, >0 | Số từ `draw_id` |
| `draw_date` | date NOT NULL | Ngày quay ở Việt Nam |
| `draw_time` | time NULL | Giờ kỳ quay khi nguồn có |
| `main_numbers` | smallint[] NOT NULL | Canonical sorted unique main |
| `special_number` | smallint NULL | Lotto bắt buộc 1–12; Mega NULL; Power bắt buộc 1–55, khác main |
| `source_url` | text NOT NULL | Trang nguồn theo kỳ |
| `source_retrieved_at` | timestamptz NOT NULL | Lúc fetch thành công |
| `source_sha256` | char(64) NOT NULL | Hash canonical result payload; HTML layout đổi không tạo correction giả |
| `prizes` | JSONB NULL, CHECK array không rỗng khi có | Snapshot các hạng giải theo [DOMAIN.md](DOMAIN.md#bảng-giải-thưởng-công-bố) |
| `prizes_retrieved_at` | timestamptz NULL | Lúc thu thập snapshot giải; NULL cùng `prizes` |
| `created_at`, `updated_at` | timestamptz NOT NULL | Audit, UTC aware |

Unique `(game, draw_id)` và `(game, draw_seq)`. CHECK cardinality main là 5/6
theo game; CHECK special theo game/range; `draw_seq` phải bằng biểu diễn integer
của `draw_id` qua validation ứng dụng. Range/unique/sort trong array được
validate tại domain boundary và test database integration với đường ghi chính;
không dùng direct SQL import không qua validator. Nếu cần bảo vệ ngoài đường
ghi ứng dụng, thêm DB trigger/constraint trong migration tương ứng.

Migration `0005_power_655` mở rộng CHECK game ở `draws`, `game_data_state`
và ba bảng ingestion, thêm nhánh Power với 6 main, special NOT NULL 1–55 và
`special_number <> ALL(main_numbers)`. Không thay đổi draw, hash, version,
prizes hoặc audit đã có. Downgrade từ chối khi còn bất kỳ dữ liệu Power trong
các bảng trên; không tự xóa dữ liệu để khôi phục constraint hai game.

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
| `game_data_state` | `game` PK, `version` bigint, `updated_at` | Version tăng trong transaction insert/enrichment/correction để gắn response/cache |

Payload JSONB trong audit giữ draw fields và `prizes` nếu có; `new_sha256` là
hash revision payload mới. Hash `draws.source_sha256` tiếp tục chỉ xét kết quả
quay, tương thích dữ liệu/audit trước migration `0004`. Unique partial
`(draw_pk, new_sha256)` cho status `pending` tránh
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
Migration `0004_draw_prizes` chỉ thêm hai cột nullable và constraint, không đổi
draw/hash hiện có. Enrichment lần đầu và apply correction tăng `data_version`
trong cùng transaction. Downgrade `0004` mất toàn bộ snapshot giải; cần backup.

Backup bằng `pg_dump` theo lịch vận hành; kiểm tra restore trên DB riêng và
đối chiếu count/hash/mẫu trước nghiệm thu. DataFrame chỉ là bộ nhớ xử lý tạm.
