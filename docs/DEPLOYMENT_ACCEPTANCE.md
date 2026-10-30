# Cloud deployment — 29/10/2026

Website công khai: **https://lottoscope-sable.vercel.app**. Frontend, backend
và database chạy trên cloud, không phụ thuộc máy cá nhân đang bật.
Runbook: [DEPLOYMENT_FREE.md](DEPLOYMENT_FREE.md), quyết định:
[ADR 0011](DECISIONS/0011-free-cloud-deployment.md).

## Resources và phiên bản đã kiểm chứng

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
