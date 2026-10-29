# Public deployment: Vercel + Render Free + Neon Free

Quyết định ngày 29/10/2026 ở [ADR 0011](DECISIONS/0011-free-cloud-deployment.md).
Khoảng 10 người, dùng khi máy cá nhân tắt, ưu tiên $0. Website công khai,
không có user login. Origin token chỉ bảo vệ Vercel → Render.

## Người dùng cần làm

1. Đăng nhập ba dịch vụ bằng GitHub hiện có; chọn Free/Hobby cá nhân phi
   thương mại, không chọn trial/nâng gói trả phí.
2. Trong ChatGPT mở Plugins, tìm từng dịch vụ, cài và kết nối khi được hỏi.
   Đăng nhập dịch vụ bằng GitHub không tự kết nối dịch vụ với ChatGPT.
   Login, 2FA, consent và xác minh chủ tài khoản do người dùng thực hiện.
3. Khi Vercel/Render yêu cầu GitHub App, cấp quyền đúng repository
   `anhkhuong04/LottoScope`; không cần cấp toàn bộ repo.
4. Nếu công cụ không hỗ trợ một thao tác, nhập secrets trực tiếp trong
   dashboard theo bảng dưới, hoặc file `.env.cloud` local ignored để agent đọc.
   Không gửi API key/password/connection string trong chat hay commit Git.

Sau kết nối, agent kiểm khả năng thực tế, tạo project/service Free, cấu hình,
chuyển dữ liệu, deploy và kiểm chứng. Nếu công cụ chưa hiện, tiếp tục trong
phiên có tích hợp với repository và runbook này. Không cần mua domain.

## Cấu hình

| Dịch vụ | Thiết lập |
| --- | --- |
| Neon | Free, project `lottoscope`, PostgreSQL 16, Singapore nếu có; direct TLS endpoint, compute nhỏ và scale-to-zero |
| Render | `lottoscope-api`, Free, Singapore, Blueprint `render.yaml` trên branch release đã kiểm chứng |
| Vercel | Hobby cá nhân phi thương mại, `lottoscope`, root `frontend`, Node 22.x, Fluid Compute bật; `frontend/vercel.json` |
| Release | SHA chứa code hiện tại và cấu hình cloud; không deploy main cũ. Ban đầu tắt auto-deploy cả hai phía |

### Render environment

| Biến | Giá trị |
| --- | --- |
| `LOTTO_DEPLOYMENT_MODE` | `cloud` |
| `LOTTO_DATABASE_URL` | Neon **direct** URL có `sslmode=require`; nhận `postgresql://`, tự chọn psycopg |
| `LOTTO_ORIGIN_TOKEN` | Chuỗi ngẫu nhiên ≥32 ký tự, cùng giá trị với Vercel |
| `LOTTO_SCHEDULER_ENABLED` | `false` |

Không dùng hostname `-pooler.` vì ingestion giữ advisory lock theo session.
Một Uvicorn worker, concurrency 16. Liveness `/health/live` không đọc DB;
không dùng uptime ping/keep-alive để giữ Free services thức. Readiness
`/health/ready` cần token, kiểm DB/migration. Cloud tắt Swagger/OpenAPI/Redoc.

### Vercel environment — Production, server only

| Biến | Giá trị |
| --- | --- |
| `LOTTO_API_ORIGIN` | `https://YOUR-SERVICE.onrender.com`, không path/query |
| `LOTTO_ORIGIN_TOKEN` | Cùng secret với Render |

Không đưa DB URL/secret vào `VITE_*`. Không cấp production secrets cho Preview;
preview chưa cấu hình trả JSON 503. Gateway forward `/api/v1/*`, GET/POST,
JSON body ≤64 KiB; thay token client bằng server token, không forward browser
cookies/Authorization, không cache API hoặc retry POST. Unknown API phải trả
JSON 404; SPA deep links vẫn mở được. Vercel build chạy frontend gates.

## Chuyển dữ liệu và migration — agent thực hiện

1. Chốt release SHA, chạy gates/build. Review untracked assets riêng.
2. Tạo Neon database **trống riêng**; giữ nguyên local DB/volume.
3. Export trong khoảng không có source writes, hoặc dùng exported snapshot để
   dump và fingerprint nhất quán. Dùng pg_dump custom format, no-owner và
   no-privileges; lưu stdout binary trực tiếp, không qua text pipeline PowerShell.
   Credentials qua environment/private file, không argv/log.
4. Kiểm `pg_restore --list`; restore đích trống với no-owner, no-privileges,
   exit-on-error và single-transaction. Không clean/drop/ghi đè DB.
5. Đối chiếu đủ 7 bảng public gồm alembic_version: counts/content hash,
   latest ba game, prizes/audit/checkpoints/data_version và sequences.
6. Từ backend với URL đích đúng chạy explicit `uv run --locked alembic upgrade
   head` và `uv run --locked alembic check`, rồi kiểm readiness. Không migration
   trong Docker build, app startup hoặc request. Free không cần trả tiền cho
   Render shell/pre-deploy job; operator có thể migrate từ local/CI được cấp quyền.

Dump trong `backups/` ignored. Bản local một lần không phải lịch backup khi máy
tắt. Trước go-live chốt backup độc lập ngoài máy và retention trong quota Free;
không tự bật R2/billing. Không thêm Windows task làm dependency cloud website.

## Deploy và nghiệm thu

1. Render từ Blueprint đúng branch; kiểm `plan: free`, không tạo Render DB,
   paid disk/worker/cron. Khai báo secrets và deploy backend.
2. Liveness 200; readiness có token 200, thiếu token 401; direct API thiếu token
   401, không có đường bypass gateway.
3. Vercel import đúng repo/branch, root frontend, env Production và Fluid
   Compute; deploy cả Node gateway và static assets, không chỉ upload dist.
4. `node scripts/cloud-smoke.mjs https://SITE.vercel.app https://API.onrender.com`
   chỉ đọc; không sync hoặc prizes enrichment.
5. Browser desktop/mobile: refresh deep links, ba game/history/metrics/checker/
   lồng cầu. Xác nhận edge rewrite giữ original path/query trên deployment thật.
6. Sync thực có chủ đích, cooldown/idempotence và nguồn từ Render. Không bypass
   Vietlott challenge/429. Kiểm cold start sau idle, 10 request đọc đồng thời,
   RAM/latency và data persistence sau restart/redeploy.
7. Chỉ ghi nghiệm thu cloud khi đã chạy; local unit tests không thay bằng chứng
   Vercel/Render/Neon thực. Rollback frontend/backend theo version tương thích;
   restore DB sang DB mới và đối chiếu trước khi đổi URL.

## Giới hạn

- Render Free ngủ sau 15 phút idle, thức khoảng một phút. Free quotas vẫn áp
  dụng, không SLA/cam kết $0 vĩnh viễn, không tự nâng gói/thêm payment method.
- Gateway deadline 270 giây, Function maxDuration 300 giây với Fluid Compute.
  Collector/retry có thể lâu hơn; trả 504, không success, backend có thể vẫn
  đang chạy. UI đọc lại dữ liệu, lock/cooldown ngăn overlap; không retry POST.
  Nếu thường xuyên quá deadline, cần thiết kế job trạng thái bền vững/batch
  riêng trước khi tuyên bố vận hành ổn định.
- Public gateway không là auth/rate limiter cho người dùng. Giữ input limits,
  DB locks/cooldown và concurrency cap; theo dõi abuse/quota trên dashboards.
- Host mới không bảo đảm Vietlott cho truy cập; giữ dữ liệu khi nguồn lỗi.

Nguồn kiểm ngày 29/10/2026: [Render Free](https://render.com/docs/free),
[Blueprint](https://render.com/docs/blueprint-spec),
[Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Functions](https://vercel.com/docs/functions/runtimes/node-js),
[Function limits](https://vercel.com/docs/functions/limitations),
[Neon pricing](https://neon.com/pricing),
[Neon pooling](https://neon.com/docs/connect/connection-pooling),
[ChatGPT Plugins](https://learn.chatgpt.com/docs/plugins).
