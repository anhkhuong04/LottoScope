# Cloud deployment — biên bản nghiệm thu

Website công khai: **https://lottoscope-sable.vercel.app**. Frontend, backend
và database chạy trên cloud, không phụ thuộc máy cá nhân đang bật.
Runbook: [DEPLOYMENT_FREE.md](DEPLOYMENT_FREE.md), quyết định:
[ADR 0011](DECISIONS/0011-free-cloud-deployment.md).

## Cập nhật kích thước bi 3D Lotto 5/35 (+50%) — 24/11/2026

- Release frontend: commit **`b4c0104`**, branch **`deploy/free-cloud`**.
- Vercel: **`dpl_HQiA28bACFz2CGR62xiN7VTb5zFq` READY**, production URL `https://lottoscope-sable.vercel.app` đã gán alias (`index-C6Wlwuvt.js`).
- Local Docker: Image `vietlottanalytics-frontend:latest` đã build lại và chạy trên container `vietlottanalytics-frontend-1` (`http://127.0.0.1:8088`) với cùng bundle.
- Nội dung cập nhật:
  - Tăng kích thước bóng 3D riêng cho **Lotto 5/35 thêm +50%** (`ballRadius = 0.285`, cho cả 35 bi main và 12 bi special), tự động nới phễu & cổ ống 6 giờ theo tỉ lệ giữ nguyên single-file trong Rapier; giữ nguyên `ballRadius = 0.19` cho Mega 6/45 và Power 6/55.
  - Kiểm chứng: **13/13 test files / 105/105 unit tests pass** (gồm vật lý Rapier cho `0.285`), **4/4 ca Playwright E2E thật** (Lotto 5/35 & Mega 6/45 trên Desktop & Mobile + Axe WCAG), đã kiểm tra ảnh chụp màn hình thực tế.

## Cập nhật Draw Simulator 3D & UI/UX — 24/11/2026

- Release frontend: commit **`a5d8f5d`**, branch **`deploy/free-cloud`**.
- Vercel: **`dpl_4M4MN9RQpvvbE8SeeeuKMJ7M4qVC` READY**, production URL `https://lottoscope-sable.vercel.app` đã gán alias (bundle `index-HfDyetCD.js`, `index-CfzZT3by.css`, `DrawScene-C18cAZb4.js`).
- Local Docker: Image `vietlottanalytics-frontend:latest` đã build lại và chạy trên container `vietlottanalytics-frontend-1` (`http://127.0.0.1:8088`) với cùng bundle.
- Nội dung cập nhật:
  - Mô hình 3D & vật lý Rapier mới: lồng cầu tròn đều 3D, viền kim loại bạc, trục khuấy chữ Y 3 nhánh 120° quay quanh trục Z, cửa thoát bóng vị trí **6 giờ** đáy cầu + gate trượt + máng hứng xám đen 2 cánh trái/phải.
  - Màu sắc & Studio: nền trắng thuần `#ffffff` trực tiếp (không phủ nền/box), bóng chính `#22cc44` chữ trắng có viền nét, lượt Special 01–12 của Lotto 5/35 đổi màu bóng 3D sang đỏ `#b91c1c`.
  - UI/UX: Desktop 2 cột phẳng trực tiếp trên nền trắng (sân khấu 3D lớn bên trái + nút điều khiển nổi gọn; khay kết quả/Copy/Checker bên phải bỏ viền card); Mobile thu gọn tối ưu để toàn bộ lồng cầu + nút + khay bóng kết quả hiển thị gọn trong 1 màn hình đầu tiên.
  - Kiểm chứng: `oxlint`, `prettier`, `tsc`, **13/13 test files / 104/104 unit tests pass**, Playwright E2E trên Desktop & Mobile với Rapier thật & Axe WCAG 2.1 AA đạt 100%, đã kiểm tra ảnh chụp màn hình thực tế.

## Cập nhật AI Access Upgrade (/data pagination, date_range, CSV) — 24/11/2026

- Release frontend: commit **`143b482`**, branch **`deploy/free-cloud`**.
- Vercel: **`dpl_HzHafzr219c53B7RbNwHf7EEPZTn` READY**, production URL `https://lottoscope-sable.vercel.app` đã gán alias.
- Nội dung cập nhật:
  - Tách `count` (cửa sổ thống kê) khỏi `draw_limit` / `draw_page` / `draw_sort` (phân trang lịch sử kỳ quay `1..100`) và `pair_limit` / `pair_page` (phân trang cặp số `1..100`).
  - Nối `window=date_range` (`from_date`, `to_date`), `as_of_draw_id`, và `draw_id` trên `/data` và `/data/{game}`.
  - Hỗ trợ xuất CSV (`?format=csv&section=draws|numbers|special|pairs`) kèm header `Content-Type: text/csv; charset=utf-8`.
  - Cập nhật `frontend/public/llms.txt` và `docs/API.md`; kiểm chứng **13/13 test files / 104/104 tests pass**, `oxlint`, `prettier`, `tsc`, `vite build`, Docker local (`http://127.0.0.1:8088`), và smoke test live trên Vercel (`format=csv`, `draw_page=2`, `from_date/to_date`, `pair_page=2`).

## Cập nhật AI Access (Static SSR + Edge Cache + WebMCP) & Vercel — 24/11/2026

- Release frontend: commit **`43d348c`**, branch **`deploy/free-cloud`**.
- Vercel: **`dpl_5CGhwTqdnoQ31nh8jHwkoy1AuqQ2` READY**, production URL `https://lottoscope-sable.vercel.app` đã gán alias.
- Public bundle: `index-8EWrYIvo.js`, `index-DLp_Ny_s.css`, `robots.txt` và `llms.txt` trả HTTP 200.
- Nội dung cập nhật:
  - Lớp 1 (Mọi tài khoản ChatGPT Web/Mobile/Desktop): Thêm `frontend/public/robots.txt`, `frontend/public/llms.txt`, serverless static SSR `api/data.ts` (`/data`, `/data/{game}`, hỗ trợ HTML và `?format=md`, Edge Cache `s-maxage=300` với `X-Vercel-Cache: HIT` đã xác thực), và `frontend/middleware.ts` chuyển hướng AI crawlers (`ChatGPT-User`, `OAI-SearchBot`, `GPTBot`, `ClaudeBot`, `PerplexityBot`...) tại `/` sang `/api/data` (giữ `Vary: User-Agent`, trình duyệt thường vẫn nhận SPA).
  - Lớp 2 (WebMCP): Đăng ký 8 tool read-only (`get_games`, `get_game_status`, `get_latest_draw`, `get_draws`, `get_number_frequencies`, `get_number_detail`, `get_pair_frequencies`, `check_combination`) qua `document.modelContext ?? navigator.modelContext` với `annotations: { readOnlyHint: true }`.
  - Kiểm chứng: `oxlint` (0 warnings/errors), `prettier --check`, `tsc -b --noEmit`, **13 test files / 103 unit tests pass**, và `vite build` thành công.
- Local Docker: Image `vietlottanalytics-frontend:latest` đã build lại và chạy trên container `vietlottanalytics-frontend-1` (`http://127.0.0.1:8088`), đã xác thực HTTP 200 OK cho `/`, `/robots.txt`, `/llms.txt`.
- Public Cloud: Đã xác thực HTTP 200 OK cho `/robots.txt`, `/llms.txt`, `/` (Chrome nhận SPA, `ChatGPT-User` nhận HTML bảng dữ liệu thật), `/data/mega_645?format=md` (`text/markdown`, `X-Vercel-Cache: HIT`).

## Cập nhật UI & Vercel — 17/11/2026 (English UI & Mobile Button Scale)

- Release frontend: commit **`f6d3c8d`**, branch **`deploy/free-cloud`**.
- Vercel: **`dpl_BRpyHDY6mXks67T196QmBi9RkHMz` READY**, production URL `https://lottoscope-sable.vercel.app` đã gán alias.
- Public bundle: `index-CEVyxfPf.js` và `index-DLp_Ny_s.css` trả HTTP 200.
- Nội dung cập nhật:
  - Chỉ giữ 1 nút "Clear" duy nhất ở cạnh nút "Add", loại bỏ nút Clear trùng lặp ở thanh công cụ phía dưới màn hình Checker.
  - Thu nhỏ và cân đối kích thước của hai nút "Add" và "Clear" trên màn hình di động/mobile (áp dụng `.btn-sm`, height 34px, padding gọn gàng, không bị kéo dãn toàn chiều rộng).
  - Chuyển đổi toàn bộ ngôn ngữ ứng dụng từ tiếng Việt sang tiếng Anh (bỏ tiếng Việt trên toàn bộ giao diện: navigation, dashboard, history, numbers, pairs, checker, generator, sync controls, error boundary, modal/tooltips, API proxy messages).
  - Kiểm thử 97 unit tests frontend đạt 100% pass, format/typecheck/lint sạch sẽ.
- Local Docker: Image `vietlottanalytics-frontend:latest` đã build lại và chạy trên container `vietlottanalytics-frontend-1` (`http://127.0.0.1:8088`), đã xác thực HTTP 200 OK.
- Public Cloud: Vercel production URL `https://lottoscope-sable.vercel.app` trả HTTP 200 OK và API proxy `/api/v1/games` hoạt động ổn định.

## Cập nhật UI & Vercel — 17/11/2026

- Release frontend: commit **`0f8a690`**, branch **`deploy/free-cloud`** (bao gồm `5969a93` và fixes cho build/oxlint).
- Vercel: **`dpl_J4QQXPC1yzDNDQjvni4ZPSg2RAxb` READY**, production URL `https://lottoscope-sable.vercel.app` đã gán alias.
- Public bundle: `index-PyBJhjnT.js` và `index-DyjntYcM.css` trả HTTP 200.
- Nội dung cập nhật:
  - Main layout nền trắng thuần, các thành phần đặt trực tiếp trên canvas không bọc card viền ô.
  - Lược bỏ hoàn toàn 2 mục "thông tin dữ liệu" (data freshness) và "phương pháp thống kê" (methodology accordion & navigation links).
  - Đổi màu các nút thao tác và ô số picker sang tone xám nhạt (`#eef2f5`).
  - Thêm nút "Clear" (xóa nhanh dãy số) ở màn hình kiểm tra vé (Checker).
  - Cập nhật phạm vi `oxlint`, bổ sung `frontend/.gitignore`, và mở rộng timeout kiểm thử mô phỏng vật lý 3D.
- Local Docker: Image `vietlottanalytics-frontend:latest` đã build lại và chạy trên container `vietlottanalytics-frontend-1` (`http://127.0.0.1:8088`).


## Cập nhật public — 04/11/2026

- Release ứng dụng **`b5646f8862e414a58bdb41a34b777d694b847893`**, đã push lên
  `origin/deploy/free-cloud`: nguồn dự phòng mới, UI cleanup, thống kê special
  Lotto/Data Experience và mô hình 3D đã duyệt.
- Render `lottoscope-api`: deploy **`dep-dbl8ddfb9u1s73ds4qr0` live**; giữ Free,
  region, database, environment và auto-deploy tắt. Liveness/readiness có token
  trả 200; direct API/readiness thiếu token vẫn 401.
- Vercel: **`dpl_7icYqkJS9PWdKw7mzkvzXgQ11PTU` READY**, production alias
  `lottoscope-sable.vercel.app` đã gán. Source SHA khớp Render; bundle public
  `index-DClKgHq1.js` khớp bản Docker đã kiểm chứng.
- Build Vercel chạy lint/format/typecheck, **97 unit tests pass** và build thành
  công. HTTP cloud smoke sau release đạt cho ba game, gateway, deep links và
  no-store/401/404; 10 lượt đọc đồng thời hoàn tất trong 951 ms (không phải SLA).
- Browser public: **18 E2E pass** (14 UI + 4 phiên quay thật). Desktop/mobile
  kiểm special list/detail, scope/filter/rank, stale/late response, phối cảnh
  cố định, thiếu WebGL, Axe/overflow. Desktop quay đủ Lotto 5+1 và Mega/Power
  6 main; mobile quay đủ Lotto 5+1. Copy/handoff checker đạt, không gọi generator
  API để chọn số. Truy vấn Render error logs từ mốc deploy không trả mục lỗi.
- Không thay schema, migration/import/sync hoặc chuyển dữ liệu local sang Neon.
  Latest cloud trước/sau HTTP smoke giữ Lotto `00985`, Mega `01581`, Power `01418`.
  Chưa kiểm live-source sync, cold start tự nhiên hoặc FPS thiết bị thật trong
  lần release này. Giới hạn nguồn và Free ở phần dưới tiếp tục áp dụng.

## Resources và lịch sử go-live 29–30/10/2026

| Dịch vụ | Resource | Cấu hình thực tế |
| --- | --- | --- |
| Vercel | `lottoscope`, team `khuong8` | Hobby, Node 22.x, Fluid Compute, Singapore; Production công khai |
| Render | `lottoscope-api`, `srv-dbhmfidg1s2s73aevs40` | Free, Singapore, Docker, một worker; `python -m app.commands.serve` |
| Neon | `lottoscope`, `falling-pine-80552402` | Free, PostgreSQL 16, Singapore, 0.25 CU, scale-to-zero mặc định; direct TLS |

- Backend release: `24720a53a9b9f20e54a3b179fdb5005046226331`, deploy
  `dep-dbhmjruc6qcc73fqkv2g` live.
- Frontend/gateway release: `9cc72267690b515a2f0f89c6782e3c08aa654d5c`, deploy
  `dpl_D622h1iTstjWnnnbZEqLh2QHX9gf` ready ở lần go-live đầu.
- Cập nhật favicon: frontend release `14f8a8a`, deployment
  `dpl_AsW2g6MCYuUKy5ehYVmycSYG68fy` ready, giữ URL production. Vercel build
  gates và 57 tests đạt; SVG/ICO/Apple touch PNG trên production trả 200, đúng
  MIME và bytes. Browser desktop/mobile kiểm link/decode icon ở deep link đạt;
  cloud HTTP smoke ba game/gateway/deep links sau cập nhật vẫn đạt.
- Branch `deploy/free-cloud`; tự động deploy Git đã tắt ở cả Vercel và Render.
  Visual refresh hiện tại: frontend `a56c58f`, deployment
  `dpl_92mLf2RoMGNpR4gMrUTqQFKcDXG3` ready, cùng URL. Vercel build/59 tests,
  cloud HTTP smoke và 19 browser tests đạt; chi tiết ở
  [biên bản UI](UI_REFRESH_ACCEPTANCE.md).
  Commit tài liệu sau các release này không tự thay production.
- Không tạo paid database/disk/worker/cron; scheduler tắt. Production secrets
  chỉ nằm ở server; Preview không được cấp secrets. Không dùng keep-alive ping.

## Dữ liệu và backup

Restore từ exported snapshot READ ONLY của local sang Neon trống: đối chiếu
đủ 7 bảng public, counts, content SHA-256 và sequences đều khớp. Alembic
`upgrade head` và `check` trên Neon đạt, head `0005_power_655`.
Không thay DB/volume local.

| Game | Số kỳ | Latest draw ID sau restore và restart |
| --- | ---: | --- |
| Lotto 5/35 | 976 | `00976` |
| Mega 6/45 | 1.577 | `01577` |
| Power 6/55 | 1.415 | `01415` |

Backup custom-format `neon-cutover-20261029T153607Z.dump` và manifest đối chiếu
đã lưu ngoài máy ở **draft release trong repository GitHub private LottoScope**,
tag dự kiến `backup/cloud-initial-20261029`. SHA-256 assets trên GitHub khớp
file local. Chủ tài khoản truy cập từ trang Releases; không publish release.
Đây là backup **một lần**, chưa có lịch backup tự động. Trước migration tiếp
theo, tạo backup mới và kiểm restore theo runbook; restore sang DB mới trước
khi chuyển URL, không ghi đè Neon hiện tại.

## Kiểm chứng thực tế

- Render liveness anonymous 200, readiness có token 200; direct API/readiness/
  docs/OpenAPI thiếu token trả JSON 401. Vercel gateway gọi Render/Neon được.
- Vercel build thật: lint/format/typecheck, **57 tests pass**, không còn
  TypeScript diagnostics; artifact ESM import đúng file `.js`. Đã kiểm không
  có origin token hoặc DB URL trong frontend dist.
- Cloud HTTP smoke qua URL công khai: ba game/latest/analytics window 30,
  original path/query, no-store API, JSON 404 và sáu SPA deep links đạt.
- Playwright dùng API cloud thật, không mock: **6 tests pass** trên desktop và
  mobile, gồm dashboard/number detail, đổi game/window, checker POST,
  mở lồng cầu, pair detail và responsive overflow. Chưa dùng kết quả này để
  khẳng định đã chạy hết một lượt mô phỏng vật lý trên cloud.
- 10 lượt đọc analytics đồng thời: đạt trong 932 ms; kiểm lại sau restart đạt
  trong 984 ms. Đây là burst nhỏ, không phải SLA hoặc benchmark tải dài hạn.
- Restart Render bằng CLI thành công. Sau restart, readiness 200 và counts/
  latest của cả ba game cùng migration head không đổi; HTTP smoke vẫn đạt.
- Backend entrypoint đã qua Ruff/Pyright và 9 ingress/smoke tests; full gates
  nền cloud trước đó gồm 216 backend tests, migration/restore và container
  512 MiB / 0.1 CPU. Bằng chứng local không thay kiểm chứng cloud ở trên.

## Phần nghiệm thu chưa đạt / chưa đo

Cập nhật 30/10/2026: manual sync đã được khôi phục bằng fallback cộng đồng
được duyệt ở ADR 0012. Render/Vercel đã release và thêm 4 kỳ Mega, 2 kỳ Power;
lịch sử cũ giữ nguyên. Bằng chứng, idempotence, provenance và backlog Power
`01410` ở [SOURCE_FALLBACK_ACCEPTANCE.md](SOURCE_FALLBACK_ACCEPTANCE.md).
Đoạn dưới ghi nhận giới hạn truy cập **nguồn chính thức**, vẫn còn hiệu lực.

**Tải dữ liệu mới bị nguồn chặn.** Gọi sync thực có chủ đích từ Render cho cả
ba game trả HTTP 503 `sync_source_unavailable`; ingestion audit trên Neon ghi
`Cloudflare challenge; deferred`. Gọi Lotto lần nữa trong cooldown trả 429
`sync_cooldown`. Không bypass challenge hay tiếp tục retry nguồn. Draws đang
lưu không thay đổi và các chức năng lịch sử/analytics/checker vẫn dùng được.
Không đánh dấu nghiệm thu source sync/idempotence live thành công; cần kiểm
lại khả năng truy cập nguồn chính thức từ cloud trước khi tuyên bố dữ liệu
được cập nhật ổn định. Bảng giải thưởng chưa lưu cũng phụ thuộc nguồn này.

Chưa đo cold start sau Render idle tự nhiên 15 phút hoặc tải kéo dài/RAM trên
Render thật. Restart có chủ đích ở trên chỉ chứng minh persistence và khởi
động lại. Free services có thể ngủ; lần mở đầu có thể phải đợi. Theo dõi quota
trên ba dashboard, không tự nâng gói khi chạm giới hạn.

Production dependency audit frontend không có vulnerability; audit gồm dev
dependencies còn 2 high từ Vite/Undici, chưa xử lý trong scope triển khai này.
DrawScene còn cảnh báo bundle lớn đã có từ trước.

## Vận hành sau bàn giao

Không cần thao tác thủ công thêm để truy cập website. Dashboard:
[Vercel](https://vercel.com/khuong8/lottoscope),
[Render](https://dashboard.render.com/web/srv-dbhmfidg1s2s73aevs40),
[Neon](https://console.neon.tech/app/projects/falling-pine-80552402).
Secrets local nằm trong `.env.cloud` ignored; không gửi qua chat hoặc commit.

Deploy sau này phải chọn SHA đã qua gates trên `deploy/free-cloud`, Render
giữ Docker Command ở trên, Vercel giữ Node gateway cùng static assets. Khi
rollback chỉ chọn release tương thích schema đã kiểm chứng; không chọn bản
Vercel trước `9cc7226` vì lỗi ESM runtime. Không rollback DB bằng cách xóa dữ
liệu; xem quy trình restore sang database mới trong runbook.
