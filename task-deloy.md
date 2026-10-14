# Cloudflare deployment — analysis và kế hoạch đề xuất

- Ngày phân tích: **14/10/2026**. Baseline code: commit `2dd7fa8`.
- Trạng thái: **analysis hoàn tất; plan đề xuất, chưa được duyệt triển khai**.
- Yêu cầu hiện hành chỉ cho phép đọc/đánh giá và tạo file này. Không deploy,
  tạo resource, đăng ký subscription, sửa runtime/config/CI hoặc chạy migration.
- Không thay thế các ADR đã accepted. Đặc biệt, PostgreSQL vẫn là nguồn dữ
  liệu bền vững duy nhất theo [AGENTS.md](AGENTS.md),
  [Architecture](docs/ARCHITECTURE.md) và [Data Model](docs/DATA_MODEL.md).

## 1. Kết luận và lựa chọn đề xuất

**Project phù hợp triển khai có Cloudflare ở frontend/edge; không phù hợp
đưa nguyên trạng toàn bộ Compose lên Workers Free.**

Đề xuất giai đoạn đầu: **Workers Static Assets + Worker TypeScript nhỏ làm
API gateway**, backend Python/FastAPI và PostgreSQL 16 ở host luôn hoạt động
ngoài Workers. Dùng Cloudflare Tunnel để kết nối origin khi host phù hợp;
giữ APScheduler một owner. Không cần D1/KV/R2 để ứng dụng chạy.

Lý do: giữ domain, API, PostgreSQL transactions/audit, bộ test hiện có và
ingestion CLI; phần cần viết mới chủ yếu là ingress, security và CI/CD.
Frontend không cần SSR hay port business logic sang JavaScript.

Phần Cloudflare có thể nằm trong Free Tier với tải nhỏ. **Không cam kết toàn
bộ hệ thống miễn phí**: host Python/PostgreSQL, điện/mạng, domain, backup và
quota CI là chi phí/điều kiện riêng. Máy hiện tại + Tunnel phù hợp pilot,
không tự trở thành cloud hosting luôn online. Production cần chọn host có
uptime/persistent disk/backup hoặc managed PostgreSQL và chốt ngân sách.

## 2. Inventory codebase hiện tại

Đã rà các module runtime backend/frontend, cấu hình/lockfiles, migrations,
CLI/jobs, CI, test coverage inventory và specification/acceptance hiện có.
Không đọc hay in credentials `.env`; không coi dependency/vendor/generated
files là application code. Không có hướng dẫn AGENTS cục bộ khác.

| Phần | Hiện trạng và bằng chứng trong repository |
| --- | --- |
| Backend | Python `>=3.12,<3.13`, modular monolith, `backend/app/main.py`; Uvicorn process, FastAPI routes sync, DI/services/repository/domain tách lớp |
| Dependencies | `backend/pyproject.toml`, `uv.lock`: FastAPI 0.142.2, Starlette 1.7.0, Pydantic 2.13.5, SQLAlchemy 2.1.1, Alembic 1.20.0, psycopg + binary 3.3.6, httpx 0.28.1, APScheduler 3.11.3, Uvicorn 0.54.0; pydantic-settings; uv 0.12.21 trong Docker/CI |
| Analytics | Pure Python, không dùng NumPy/Polars trong runtime hiện tại; metrics theo game/window/cutoff/version; checker và generator main-only; `backend/app/analytics/`, `services/checker.py`, `services/generator.py` |
| Frontend | React 19 + TypeScript 6 + Vite 8 + React Router 7 + lucide-react; lock npm, Node 22.12+; SPA static `frontend/dist`, không SSR/server actions |
| Routes UI | Dashboard, history/detail, numbers/detail, pairs/detail, checker, generator; game/window/filter/page trong URL, game preference localStorage; abort response cũ; `frontend/src/App.tsx`, `state.tsx`, `pages/` |
| API | `/api/v1`: games/status/latest/history/detail/prizes, number/pair analytics/detail; POST check/generate; JSON typed, page_size ≤100, generated_count request ≤20; `backend/app/api/v1.py`, `schemas/v1.py`, `docs/API.md` |
| Database | PostgreSQL 16; sáu bảng domain/tracking + `alembic_version`; ORM sync, pool trong process; ARRAY smallint, JSONB, GIN, regex/CHECK/partial unique indexes, `FOR UPDATE`, `REPEATABLE READ`, PostgreSQL upsert và advisory locks |
| Migrations | Alembic 0001..0005; migration explicit ngoài HTTP, không tự upgrade khi khởi động; readiness đối chiếu head; rollback một số revision mất dữ liệu nên cần restore riêng |
| Background jobs | APScheduler BackgroundScheduler trong FastAPI lifespan khi bật; một API worker; 3 startup catch-up + 7 jobs recurring; PostgreSQL session advisory lock theo game chống overlap |
| Ingestion | HTML nguồn Vietlott, parser validate URL/game/ID/main/special/prizes; httpx sync, timeout 10s, ≤3 attempts, throttle/sleep/Lock; import dùng ThreadPoolExecutor 3 workers; checkpoint/item/draw/version atomic theo từng kỳ |
| Operator CLI | import_history, audit_import, collect, ingestion_status, apply_correction; maintenance chưa có public HTTP trigger; source correction phải review rồi apply có lý do |
| File storage | Không upload/file API hoặc user-generated files. Draw/prizes/audit ở PostgreSQL; fixtures HTML trong tests, bundle static trên frontend, dump backup vận hành ngoài container. `frontend/public/logo.png` đang untracked, chưa tự thêm vào release |
| Authentication | **Chưa có** login/user/session/JWT/OAuth/API-key middleware; localStorage không là auth. Không có application rate limiting/CORS middleware. OpenAPI/docs mặc định FastAPI hiện bật |
| External services | Vietlott HTTPS cho ingestion/enrichment; Google Fonts trong `frontend/src/index.css` qua fonts.googleapis.com/fonts.gstatic.com; build lấy packages/images npm/PyPI/GHCR/Docker registry. Không payment/email/S3/Redis/Celery hoặc live AI SDK |
| AI chat | `docs/AI_ANALYTICS_CHAT.md` là đề xuất, **chưa có runtime/routes/schema/config**; không đưa OpenAI/Workers AI, chat auth/quota vào deployment scope hiện tại |
| Local hosting | `compose.yaml`: frontend Nginx 1.28 + Python backend + postgres:16, volume postgres_data; host ports loopback 8088/8000/5432; health checks/restart; chưa TLS/public ingress |
| API routing | Browser fetch same-origin `/api/v1`; Vite proxy dev và Nginx proxy production. Deploy bundle đơn thuần mà thiếu `/api` gateway sẽ không có API; `frontend/src/api.ts`, `vite.config.ts`, `nginx.conf` |
| CI/tests | GitHub Actions chỉ checks backend/frontend, không CD. PostgreSQL test DB riêng, Ruff/Pyright/pytest/Alembic check; frontend lint/format/typecheck/Vitest/build. Playwright responsive/Axe hiện chưa chạy trong workflow frontend |

### Workload và trạng thái dữ liệu kiểm tra read-only

SQL trong transaction READ ONLY tại DB local cho kết quả:

- Lotto: **944** draws, latest `00944` / 13/10/2026; 24 snapshot giải.
- Mega: **1.574** draws, latest `01574` / 11/10/2026; 11 snapshot giải.
- Power: **77** draws, latest đã lưu `00077` / 25/01/2018; đủ 77 snapshot giải.
  Tracking 77 found + 24 failed; lịch sử chưa đủ, POWER-05 vẫn mở.
- DB local khoảng **10 MB**, schema `0005_power_655`. Kích thước này không
  phải benchmark hiệu năng hoặc ước lượng DB production đã đầy đủ.
- Phần lớn kỳ Lotto/Mega chưa có bảng giải. GET `/prizes` khi thiếu snapshot
  gọi import recheck đúng kỳ, fetch latest + trang kỳ, **ghi DB**, không phải
  endpoint thuần read-only. Không gọi endpoint này để làm health check.
- Pair metrics dựng toàn miền trước phân trang: Power 1.485 pairs. Checker
  đọc lịch sử tới cutoff; generator có thể thử 20.000 candidates/request.
  Request all_time có CPU/RAM lớn hơn UI last-30; cần load test, không suy
  compatibility Workers từ số row nhỏ.
- Throttle hiện nằm trong từng fetcher; không phải limiter chung bền vững
  xuyên process/job/game. Public traffic/enrichment có thể tăng request nguồn.

## 3. Đánh giá compatibility Cloudflare

### Workers Python/FastAPI: có hỗ trợ, nhưng không drop-in

Cloudflare hỗ trợ FastAPI bằng ASGI entrypoint riêng, không dùng Uvicorn như
container. Python Workers dùng Pyodide/WebAssembly; threading/multiprocessing
không hoạt động như CPython và filesystem là ephemeral. Vì vậy scheduler,
thread pool, route sync được test chạy ở worker thread và fetcher sync hiện
tại cần thiết kế lại nếu port.
[FastAPI](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/),
[Python stdlib](https://developers.cloudflare.com/workers/languages/python/stdlib/).

Python Workers đã có Hyperdrive/TCP và tài liệu liệt kê asyncpg, pg8000,
psycopg. **Không kết luận “Python không kết nối được PostgreSQL”**. Tuy nhiên,
package wheels/versions, SQLAlchemy sync, binary extra trong lock Python 3.12,
runtime/tooling Workers phải có POC riêng; example chính thức dùng Python
>=3.13, không thể reuse lock hiện tại mà chưa kiểm.
[Python Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/python-workers/),
[Packages](https://developers.cloudflare.com/workers/languages/python/packages/).

Hyperdrive không hỗ trợ advisory locks; đây là blocker trực tiếp của ingestion
hiện tại, không chỉ đổi connection string. Query cache cũng không tự invalidation
sau writes, cần tắt/đánh giá cho context version/cutoff và transaction snapshots.
Giữ ingestion direct PostgreSQL ở host là cách tránh port lock trong giai đoạn đầu.
[Supported features](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/),
[Hyperdrive FAQ](https://developers.cloudflare.com/hyperdrive/reference/faq/).

### D1: không chọn cho release hiện tại

D1 dùng SQLite semantics, không là PostgreSQL. ARRAY/GIN/JSONB operators,
regex/CHECK, locking/isolation và Alembic migrations hiện tại không thể dùng
nguyên trạng; dump PostgreSQL cũng không import trực tiếp. Cần redesign
schema/query/transactions, chuyển dữ liệu/audit/version và toàn bộ integration
tests. Đây là thay đổi architecture/domain persistence cần người dùng duyệt
và cập nhật specification/ADR/AGENTS trước, không được tự chốt vì Free Tier.
[D1 SQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/),
[Import/export](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

Nếu sau này yêu cầu 100% Cloudflare + D1, tiền VND/seed/hash/IDs phải giữ
precision/identity xuyên JSON và runtime JavaScript; không tự đổi int64 thành
Number hoặc bỏ số 0 đầu. Ingestion vẫn atomic/idempotent, special tách main,
snapshot/backtest semantics không được nới lỏng. Không dùng D1 như bản sao
domain thứ hai trong plan giai đoạn đầu.

### Lựa chọn theo dịch vụ

| Dịch vụ | Kết luận cho project hiện tại |
| --- | --- |
| Workers Static Assets | **Ưu tiên** phục vụ SPA + Worker proxy cùng origin; thay vai trò Nginx ở edge, không thay Python business logic |
| Pages | Cũng phù hợp frontend; cần Pages Function proxy `/api/*` hoặc đổi API base/CORS. Không deploy cả Pages và Static Assets cho cùng app |
| Workers Python | Nhánh POC về sau, không baseline deployment nguyên trạng |
| D1 | Không chọn vì compatibility và invariant PostgreSQL |
| Hyperdrive | Không cần khi Worker chỉ proxy HTTP; không host PostgreSQL. Có thể xét cho read API Workers sau POC, không thay advisory lock |
| R2 | Không bắt buộc; tùy chọn backup pg_dump riêng/private, retention + restore drill. Không dùng object storage thay PG volume hoặc serve backup công khai |
| KV | Không cần; eventual consistency không phù hợp checkpoint/version/lock/quota atomic. Chỉ cân nhắc cache/config đọc nhiều khi đo có nhu cầu, không là source of truth hoặc secrets store |
| Cron Triggers | Có thể trigger collector qua internal API được bảo vệ; không chạy APScheduler/CLI container trong Worker. Giữ scheduler host trước, chuyển ownership riêng nếu duyệt nhánh Cron |
| Containers | Có thể xét để giữ CPython, nhưng **không thuộc Workers Free**; disk ephemeral mặc định, không chuyển PG volume sang container disk. Không chọn để đạt mục tiêu free |
| Tunnel | Kết nối origin bằng outbound connector; origin vẫn phải chạy và giữ DB ngoài Cloudflare. Named Tunnel cho môi trường dài hạn, không dùng Quick Tunnel làm production |

KV eventual consistency và Containers pricing/disk:
[KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/),
[Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/),
[Containers FAQ](https://developers.cloudflare.com/containers/faq/).
Tunnel không biến local service thành serverless hosting:
[Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/).

## 4. Kiến trúc đề xuất — hybrid, ít thay đổi

```text
Browser → Cloudflare HTTPS / Access (nếu nhóm kín)
          ├─ SPA/assets → Workers Static Assets
          └─ /api/v1/* → Worker gateway → protected origin qua Tunnel/HTTPS
                                         └─ FastAPI CPython 3.12
                                            ├─ PostgreSQL 16 persistent
                                            └─ APScheduler (một owner)
                                               → Vietlott HTTPS

GitHub CI gates → approved release → frontend/gateway + origin image
PG backup → private backup destination (R2 tùy chọn)
```

Đây là **đề xuất**, chưa lựa chọn host/tài khoản/domain hoặc cấp quyền.

1. Static assets build từ `frontend/`, Node 22.12+, `npm ci` + `npm run build`.
   SPA fallback cho history/detail/numbers/pairs và browser refresh.
2. Wrangler mới ở frontend/edge khi được duyệt; assets directory `dist`,
   `not_found_handling: single-page-application`, chỉ `run_worker_first`
   `/api/*`. Không bật Worker-first toàn site gây tính quota cho mọi asset.
   Unknown API route phải trả JSON 404, không trả `index.html` HTTP 200.
   [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).
3. Gateway origin cố định trong cấu hình, không lấy hostname từ client.
   Giữ path/query/body/status/content-type; không rewrite `/api/v1` hai lần.
   Allowlist method/path, body size/timeouts hợp lý; redact errors, không
   forward header auth/service credential do client giả mạo. Không retry POST
   generate/check hoặc prizes enrichment mù; không cache dynamic API ban đầu.
4. Origin qua named Tunnel hoặc HTTPS được bảo vệ; không public PostgreSQL
   và không để truy cập direct origin bypass gateway/Access. Tunnel dùng
   connector target đúng mạng: host → 127.0.0.1:8000; connector cùng Compose
   network → backend:8000, không dùng localhost của container khác.
5. Nhóm kín: đề xuất Access allowlist toàn app; origin service-only bằng
   service credential hoặc cơ chế verify tương đương. Chặn/áp cùng chính sách
   cho hostname phụ, workers.dev/preview để không bypass custom domain.
   Public: cần duyệt rate limiting/abuse protection, quyền trigger enrichment,
   giới hạn concurrency và load test trước go-live. Chưa tự thêm account system.
6. Scheduler ban đầu vẫn ở host: một worker, DB lock direct, startup catch-up.
   Host autosleep làm trễ cron; không chọn free host ngủ mà cam kết cập nhật
   đúng giờ. Managed PG nếu dùng phải kiểm direct connection/TLS/pool limits;
   tránh transaction pooler cho session advisory lock.
7. PostgreSQL private; app role không dùng superuser production, migration
   credentials tách nếu cần. `.env` local không upload vào Static Assets/build
   output. Database URL chỉ ở origin, Worker không cần biết credentials PG.
8. Chỉ route readiness có kiểm soát cho ops; `/docs`, `/redoc`, `/openapi.json`
   không tự mở public. Log HTTP/job failures + ingestion freshness, cảnh báo
   source 429, backup failures, origin offline và Worker quota.

## 5. Free Tier và giới hạn cần theo dõi

Số liệu đối chiếu tài liệu chính thức ngày 14/10/2026, không phải cam kết
quota tài khoản của người dùng hoặc miễn phí vĩnh viễn. Kiểm lại khi thực thi.

| Dịch vụ | Free allowance/điều kiện đáng chú ý | Tác động |
| --- | --- | --- |
| Workers | 100.000 requests/ngày; 10ms CPU/HTTP và Cron, 128MB RAM, 50 subrequests/invocation; 5 Cron Triggers/account | Proxy nhỏ cần benchmark; Python metrics/generator/import chưa được chứng minh đáp ứng. I/O wait không là CPU |
| Static Assets | Static requests free/unlimited; 20.000 files/version, 25MiB/file ở Free | Bundle hiện nhỏ; API invoke Worker vẫn tính quota |
| Workers Builds | 3.000 build minutes/tháng, 1 concurrent build, timeout 20 phút | Git integration có thể dùng; không đồng nghĩa test CI hiện có tự chặn deploy |
| Pages | 500 builds/tháng, 1 concurrent build; Functions dùng Workers quota | Phương án frontend thay thế, không xử lý blocker backend |
| D1 | 5 triệu rows read/ngày, 100.000 rows write/ngày; 5GB tổng nhưng **500MB/database Free**, 10 databases | DB local nhỏ về dung lượng nhưng không giải quyết SQL compatibility; scanned rows khác returned rows |
| R2 Standard | 10GB-month, 1 triệu Class A và 10 triệu Class B/tháng, egress miễn phí | Backup tùy chọn; subscription/checkout và overage cần chủ tài khoản duyệt; không cam kết hard spending cap |
| KV | 100.000 key reads/ngày, 1.000 writes/ngày, 1GB | Không chọn; request/update budget phải xét nếu thêm cache |
| Hyperdrive | 100.000 DB statements/ngày ở Free | Không cần trong hybrid; quota riêng và vẫn cần trả/host PostgreSQL |

Nguồn theo từng dòng:
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
[Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/),
[Pages](https://developers.cloudflare.com/pages/platform/limits/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) và
[D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/) và
[R2 subscription](https://developers.cloudflare.com/r2/get-started/),
[KV pricing](https://developers.cloudflare.com/kv/platform/pricing/),
[Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/).

Dashboard khởi tải games + năm data sections; một page view không bằng một
API request. Theo dõi request/CPU/errors thực tế và đặt ngưỡng cảnh báo trước
quota. Free limit có thể làm request thất bại; paid overage cần ngân sách,
alert không tự là hard cap. Không thêm R2/KV/D1 chỉ vì có allowance.

## 6. Scheduled tasks và nhánh Cron Triggers tùy chọn

**Giai đoạn đầu không chuyển scheduler**. Nhánh dưới chỉ thực hiện sau duyệt:

- Viết Worker `scheduled` dispatcher gọi internal endpoint với game allowlist,
  timestamp/chữ ký hoặc service token, chống replay và logging trigger/run ID.
  Endpoint này hiện chưa có; route chỉ gọi use case, không chứa ingestion.
- Không fire-and-forget job không bền vững rồi trả success. Job nhỏ có thể chờ
  kết quả trong deadline; job dài cần runner bền vững/checkpoint và trạng thái
  accepted/running/success/failed rõ, không dựa `waitUntil` để chạy full import.
- Tắt APScheduler cron trên owner cũ khi owner mới đã kiểm chứng; vẫn giữ cơ
  chế catch-up theo checkpoint sau downtime/deploy. Không trigger import lại
  toàn lịch sử trong mỗi cron hoặc cold start Worker.
- Cron dùng UTC; bảy logical jobs có thể gộp thành **bốn triggers** để vừa
  quota account Free nếu account còn đủ chỗ:

| Trigger UTC | Tương ứng Việt Nam | Dispatch |
| --- | --- | --- |
| `0 0 * * *` | 07:00 hằng ngày | reconcile cả ba game, tuần tự/throttle chung |
| `0 7 * * *` | 14:00 hằng ngày | Lotto poll lần 1 |
| `30 15 * * *` | 22:30 hằng ngày | Lotto poll lần 2 |
| `30 12 * * *` | 19:30 hằng ngày | guard ngày theo Việt Nam: Mega T4/T6/CN, Power T3/T5/T7, T2 không dispatch |

Cron Free vẫn 10ms CPU; wall-time tối đa scheduled invocation 15 phút không
nghĩa có 15 phút CPU. Full Power 1.410 trang × ≥1 giây đã >23 phút chưa tính
retry; để import/audit lớn ở operator runner. Bốn triggers trên dùng default
times hiện có; nếu config đổi cần test/update mapping.
[Cron UTC](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## 7. GitHub / CI-CD đề xuất

Ưu tiên **GitHub Actions gated deployment**, tận dụng checks hiện có, pin
actions/tooling và permission tối thiểu. CI hiện tại không là CD.

- PR: backend checks trên dedicated PostgreSQL test DB, frontend gates và
  browser tests với backend/fixture phù hợp; không dùng production DB/nguồn live.
- Branch release/main: sau checks, build artifact theo SHA; staging/production
  secrets tách. Protected environment/manual approval trước production deploy.
- Deploy frontend/gateway qua Wrangler; API token scope đúng account/Worker,
  account ID trong CI; không commit token, origin service token hoặc DB URL.
  Origin build image immutable và rollout riêng, migration bước explicit có
  approval/backup, không chạy trong Worker fetch hay mỗi deploy preview.
- Preview dùng staging origin/DB, không trỏ production để GET prizes ghi DB.
  Không cấp secrets cho untrusted PR/fork; không deploy asset `dist` cũ.
- Rollback frontend/Worker version và origin image; DB rollback theo schema
  compatibility/restore plan, không tự downgrade/xóa Power/volume.
- Workers Builds GitHub integration là alternative (root frontend, Node pin,
  build command chứa gates, production branch/watch paths được kiểm). Không
  bật đồng thời hai pipeline deploy cùng target; native build không tự chờ
  workflow backend riêng. Pages integration cũng tương tự nếu chọn Pages.

[GitHub Actions auth/deploy](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/),
[Workers GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/).

## 8. Kế hoạch thực hiện tuần tự — chưa chạy

- [x] **DEPLOY-00 — Audit và proposal.** Rà code/requirements, platform docs,
  DB read-only; tạo file này, phân biệt existing state với proposed changes.
- [ ] **DEPLOY-01 — Chốt scope/authority.** Duyệt hybrid hay yêu cầu 100%
  Cloudflare; public/nhóm kín; host origin/PG; ngân sách/traffic/RPO-RTO;
  domain/account/repo/branch; có chuyển Cron hoặc dùng R2 không. Nếu đổi
  persistence sang D1 phải duyệt riêng, không gộp vào rollout hybrid.
- [ ] **DEPLOY-02 — Security/production readiness ở local.** Thiết kế Access
  hoặc public abuse controls, origin authentication, request limits/deadlines,
  docs/health exposure, shared source throttle và enrichment protections;
  benchmark pairs/all_time/checker/generator, pool/concurrency. Giữ contract;
  thêm regression tests trước khi triển khai ra ngoài. Ghi ADR proposed/accepted
  theo quyết định thực tế, không tự ghi accepted khi chưa duyệt.
- [ ] **DEPLOY-03 — Edge implementation local.** Wrangler/Worker gateway,
  assets routing/headers/error JSON, fixed origin, secrets placeholders;
  mock-origin tests, SPA/deep links/page=15, invalid requests, expired/missing
  auth, no origin bypass, mobile/accessibility. Không cần schema migration
  cho static/gateway; không tự thêm D1/R2/KV.
- [ ] **DEPLOY-04 — CI/CD và runbooks.** Staging isolation, gated deployment,
  image/artifact versioning, scoped tokens, rollback, monitors, backups/restore
  với retention đã chọn. Không bật auto-production trước authorization.
- [ ] **DEPLOY-05 — Provision staging sau approval mới.** Tạo resources tối
  thiểu/domain/Tunnel/Access, origin + PostgreSQL phù hợp; backup/export trước
  chuyển host, restore sang DB mới rồi so checksum/count/audit/version và API.
  Migrations chỉ chạy nếu DB mục tiêu chưa ở head, explicit và có xác nhận.
- [ ] **DEPLOY-06 — Data và scheduled acceptance.** Nguồn Vietlott cho access,
  resume Power, audit coverage/provenance/sample/prizes, collector hai lượt
  idempotent; giữ Lotto/Mega. Nếu chuyển Cron: test UTC/weekday/misfire,
  duplicate triggers/timeout/restart/catch-up, chỉ một owner. Không bypass 429.
- [ ] **DEPLOY-07 — Production cutover riêng.** Sau staging pass và người
  dùng cho phép: deploy theo SHA, DNS/TLS/Access, readiness và E2E thật,
  quota/error/freshness alerts, rollback rehearsal, handoff. Không coi plan
  là authorization provision, subscription hay public traffic.

Dừng sau DEPLOY-00 trong lượt hiện tại. Các bước 01..07 đều còn mở.

## 9. Phần thủ công và phần agent có thể tự động hóa

**Người dùng cần quyết định/thao tác tài khoản:**

- Chọn public hay nhóm kín, số người/tải dự kiến, giới hạn ngân sách và host
  Python/PG luôn hoạt động. Chấp nhận hybrid hay duyệt dự án port riêng.
- Tạo/chọn Cloudflare account, GitHub repository/production branch, domain;
  nếu custom domain/Tunnel cần DNS ownership/setup. Cloudflare login/2FA,
  consent GitHub App theo repo chọn và payment/subscription là thao tác chủ
  tài khoản; không gửi key plaintext trong hội thoại.
- Cấp token quyền tối thiểu qua secrets/settings đúng môi trường; chọn Access
  allowlist/IdP hoặc cơ chế public protection; duyệt backup destination,
  retention/RPO-RTO. Nếu R2 được chọn, duyệt checkout và rủi ro overage.
- Review plan/ADR, cho phép implementation, staging provisioning và production
  cutover bằng các yêu cầu riêng. Quyết định label/giới hạn Power nếu chưa đủ
  lịch sử; không nghiệm thu Power hoàn chỉnh chỉ vì website truy cập được.

**Agent có thể tự động hóa sau khi được duyệt và có quyền phù hợp:**

- Edge code/config/tests, hardening và docs/CI/runbooks; build/quality gates.
- Script IaC/resource configuration, Token bindings/Tunnel routing qua API/CLI
  khi được cấp quyền; không thay chủ tài khoản làm 2FA/consent/billing decisions.
- Backup/restore sang DB riêng, verification, bounded import/audit/collector,
  staging/production deployment và rollback checks theo approval từng mốc.

## 10. Blockers và điều kiện nghiệm thu

1. **Chưa có host origin/PG/uptime/cost decision** và chưa biết tài khoản,
   domain, quyền GitHub/Cloudflare/quota thực tế. Không thể tuyên bố $0 all-in.
2. **Security chưa sẵn sàng public**: auth/rate limiting/origin bypass,
   generator CPU/concurrency và GET prizes có side effects chưa được bảo vệ.
3. **Nguồn Vietlott 429 và Power partial**: local latest Power năm 2018 không
   là latest nguồn. Blocker cho nghiệm thu đầy đủ dữ liệu/cập nhật tự động;
   pilot có partial label chỉ được mở khi người dùng chấp nhận giới hạn.
4. **Workers-only không tương thích nguyên trạng**: threading/ASGI route
   execution, package/runtime pins, scheduler ownership, PG advisory lock qua
   Hyperdrive, CPU limits; chưa có POC/load test workerd/Python Workers.
5. **D1 cần approval thay persistence và rewrite**; không giải quyết bằng
   sửa env hoặc chạy Alembic hiện có. Chưa có parity/data preservation proof.
6. **Release readiness**: main đang ahead origin/main 12 commits tại audit,
   `frontend/public/` untracked. Xác định release SHA/assets trước CI integration;
   không tự push/commit logo. Chưa có deployment workflow hoặc backup schedule.

Nghiệm thu deployment sau này cần đủ HTTPS/deep-link/API same-origin/auth;
không direct-origin bypass; DB persistent/restore verified, source freshness
thật, jobs một owner/idempotent, quality gates + E2E trên staging/release,
load/quota metrics và rollback khả thi. Không dùng mock/placeholder success
để chứng minh production hoặc nhập dữ liệu giả khi source chặn.

## 11. Kiểm chứng của lượt analysis này

- Chỉ đọc source/docs/config, tra tài liệu Cloudflare chính thức và truy vấn
  PostgreSQL READ ONLY. Không fetch Vietlott/import/collector/enrichment.
- Chỉ tạo `task-deloy.md`; không sửa code/config/CI hoặc `.env`, không tạo
  production resource, subscription, Tunnel, migration hay deployment.
- Kiểm nội dung, local references, UTF-8 và `git diff --check`. Không chạy
  tests/runtime POC trong task docs-only; kết quả tests trước đây không là
  bằng chứng compatibility Cloudflare. Commit docs theo Workflow; không push.
