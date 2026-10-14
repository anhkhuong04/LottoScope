# Quy trình bắt buộc: từ quyết định đến hoàn tất

## 1. Trước khi sửa hoặc generate code

1. Đọc root `AGENTS.md`, `.agent/README.md`, file quy tắc liên quan và spec gốc.
2. Kiểm tra code/tooling hiện có, local changes và hướng dẫn thư mục con;
   không ghi đè thay đổi của người dùng. Nếu chưa có Git, không giả định có diff.
3. Xác định task thuộc backend MVP, frontend MVP hay Phase 2; ghi acceptance
   và phần có thể làm độc lập. Không mở scope chỉ vì docs mô tả khả năng tương lai.
4. Kiểm tra các điểm còn mở trong `PROJECT_ANALYSIS.md`; phân biệt convention
   implementation có thể tự chọn với quyết định thay đổi nghiệp vụ.
5. Chọn thay đổi nhỏ nhất đáp ứng acceptance, xác định tests/checks trước code.
   Không lập kế hoạch refactor/abstraction không cần cho task.

## 2. Khi requirement thiếu hoặc mâu thuẫn

- Tìm bằng chứng trong domain → architecture → feature spec → tests → code.
  File được đề xuất nhưng chưa tồn tại không phải bằng chứng.
- Khi spec đã rõ, tự thực hiện trong phạm vi yêu cầu. Không hỏi lại cho naming,
  bố trí module hoặc lựa chọn reversible có lý do rõ.
- Nếu quyết định ảnh hưởng formula/meaning, time boundaries, data identity,
  scope, correctness hoặc public contract mà chưa có bằng chứng: ghi câu hỏi
  cụ thể, làm rõ phần đó, tiếp tục phần độc lập. Không tự biến giả định thành rule.
- Nếu người dùng đã quyết định trong hội thoại, áp dụng quyết định và cập nhật
  spec tương ứng; không yêu cầu xác nhận lặp lại.
- TODO phải nêu missing spec, ảnh hưởng và bước tiếp theo; không coi feature
  có business TODO hoặc stub trả success là đã hoàn tất.
- Không chỉnh docs/test để khớp code khi chưa xác định nguồn sai. Báo mâu thuẫn
  kèm nguồn và sửa đúng layer theo quyết định đã có.

## 3. Ghi quyết định kỹ thuật

Lựa chọn nhỏ, cục bộ: giải thích trong change summary/comment khi cần.
Quyết định có ảnh hưởng dài hạn đến stack, data model, domain/time semantics,
API compatibility, module boundary hoặc deployment: tạo ADR trong
`docs/DECISIONS/NNNN-short-title.md` khi có quyết định thực tế. Không tạo ADR
"accepted" cho các câu hỏi đang mở hoặc đòi phê duyệt riêng cho mọi ADR.

Template:

```markdown
# NNNN — Tên quyết định

- Status: proposed | accepted | superseded
- Date: YYYY-MM-DD
- Scope: feature/module chịu ảnh hưởng
- Sources: specification, task hoặc bằng chứng dẫn tới quyết định

## Context
Vấn đề cụ thể, constraints và phần chưa rõ.

## Options
Các phương án thực tế và tradeoff cần thiết.

## Decision
Lựa chọn, lý do, evidence; nếu proposed, ghi rõ phần chưa chốt.

## Consequences
Compatibility, migration, operational impact và giới hạn.

## Validation
Tests/checks xác nhận quyết định và acceptance liên quan.
```

## 4. Test đúng rủi ro

Tests phải chứng minh contract bằng fixture/expected results độc lập; không
tính expected bằng chính helper đang test hoặc test chỉ để tăng coverage.
Core logic phải có tests; bugfix logic quan trọng cần regression test.

| Thay đổi | Kiểm chứng tối thiểu liên quan |
| --- | --- |
| Domain/normalize | Mọi game được hỗ trợ; count/range/integer/duplicate; invalid game/special và Power special khác main; permutation identity; không silently sửa input |
| Window/time | Ordering/tie-break, same-day draws, game isolation, cutoff/date endpoints, fewer-than-N và empty theo contract |
| Frequency/gap/pairs/overlap | Dataset nhỏ tính tay; count 0; latest appearance; never-seen/window clipping theo spec; canonical pair; main/special isolation; exact-k/at-least-k theo contract |
| Generator/rules | Rule pass/fail/disabled; threshold boundary; invalid/contradictory config; seeded reproducibility; bounded failure; output hợp lệ và explanation khớp metrics |
| Parser/ingestion | Fixture nguồn cố định; source format lỗi; invalid draw; transient retries bounded; chạy lặp; same identity/different content theo policy |
| DB/migration/repository | PostgreSQL integration thật; unique/conflict/concurrent ingestion; transaction rollback; sort/pagination; migration upgrade và data preservation |
| API | Contract/status/errors, server validation, game/window propagation, limits và metadata; mock external I/O khi phù hợp |
| Backtest | Cutoff trước N ở mọi lookup; thay future data không đổi selection; warm-up/seed/baseline/histogram theo spec |
| Frontend | Desktop/mobile; game switch/late response; keyboard/forms; loading/empty/error/stale; deep links; checker/generator flows và explanation |
| Deployment | Compose validation/build/readiness, migration trên DB phù hợp và persistent storage; backup/restore nếu scope có |

Không dùng SQLite để khẳng định PostgreSQL constraints, concurrency, arrays,
query hoặc migrations đã được kiểm chứng. Unit tests pure logic không cần DB.
Không phụ thuộc live website để core tests pass; live smoke test chỉ bổ sung
khi được thực hiện và phải báo đúng nguồn/giới hạn.

## 5. Quality gates cho backend

Khi backend đã khởi tạo theo stack overview, lệnh chuẩn dự kiến chạy từ
`backend/` (cấu hình thực tế phải được bootstrap trước):

```powershell
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked pyright
uv run --locked pytest
```

- Cấu hình tool paths/includes nhất quán trong project; nếu command thay đổi,
  cập nhật hướng dẫn/CI trong cùng task. Không chạy lệnh vào project chưa có
  `pyproject.toml` rồi coi đó là test failure của business code.
- Chạy tests/checks phù hợp với change; core/backend changes phải pass lint,
  format, typing và tests liên quan. Scope lớn chạy toàn suite liên quan.
- Khi bootstrap CI, dùng cùng commands và lockfile; frontend lint/type/build/
  tests được chọn theo stack đã quyết định, không invent command chưa tồn tại.
- Không bỏ qua lỗi, hạ strictness hoặc skip test để báo success. Nếu môi trường
  thiếu DB/runtime/contract, báo rõ check nào chưa chạy và tác động; tiếp tục
  kiểm chứng phần không phụ thuộc điều kiện thiếu.
- Docs-only task kiểm tra nội dung, references, consistency và encoding;
  không cần khởi tạo stack/test suite chỉ để kiểm chứng Markdown.

## 6. Definition of Done cho mỗi task

- [ ] Acceptance trong phạm vi yêu cầu đã được đáp ứng; không thêm feature khác.
- [ ] Đã giữ domain invariants, boundaries và data/time/window semantics.
- [ ] Không có secret, fake production data, silent failure hay stub success.
- [ ] Business-critical logic có tests meaningful; checks liên quan đã pass
      hoặc giới hạn kiểm chứng được báo rõ, không khẳng định phần chưa kiểm chứng.
- [ ] API/schema change có contract/migration tương ứng; quyết định dài hạn
      có ADR khi cần, tài liệu/quy tắc chịu ảnh hưởng được cập nhật.
- [ ] Nếu có UI: đã kiểm tra desktop/mobile, các states và accessibility cơ bản.
- [ ] Báo kết quả cụ thể: file/behavior thay đổi, lý do, kiểm chứng thực tế và
      vấn đề còn mở. Không chỉ báo "done" hoặc liệt kê kế hoạch chưa thực hiện.

Không đánh dấu feature hoàn tất nếu acceptance còn thiếu. Không tự publish,
deploy hoặc thay production state khi task chỉ yêu cầu code/tài liệu.

## 7. Commit sau nhóm task lớn

- Sau khi hoàn thành mỗi giai đoạn P1–P8 hoặc một task lớn thay đổi nhiều
  module/contract/schema/infra, PHẢI tạo commit khi các quality gates liên
  quan đã chạy và kết quả/giới hạn được ghi rõ. Không đợi nhiều giai đoạn
  hoàn thành mới gom thành một commit khó review.
- Trước commit: kiểm tra diff, loại secret/cache/build artifacts và thay đổi
  không liên quan; cập nhật `task.md` chỉ cho task thật sự hoàn thành.
- Commit message nêu phạm vi và task IDs, ví dụ `P1: bootstrap backend and CI`.
  Nếu task còn bị chặn, commit phần đã kiểm chứng với trạng thái chưa hoàn
  thành được ghi rõ, không tạo commit mang nghĩa "complete" sai.
- Push khi người dùng yêu cầu hoặc quy trình repository đã cho phép; kiểm tra
  remote/branch trước push. Không force-push hay ghi đè lịch sử của người khác.
