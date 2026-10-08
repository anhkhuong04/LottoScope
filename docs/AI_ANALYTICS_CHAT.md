# AI Analytics Chat — phương án V1

- Cập nhật: 08/10/2026. **Thiết kế đề xuất; chưa triển khai code.**
- Mục tiêu: hỏi và phân tích lịch sử LottoScope bằng tiếng Việt, có bằng chứng.
- Bản đầu: **nhóm kín/local, dùng API key của quản trị viên ở backend**, theo
  xác nhận của người dùng. Public và quản lý tài khoản không thuộc lượt này.
- Nguồn chuẩn: [Domain](DOMAIN.md), [Analytics](ANALYTICS.md),
  [Architecture](ARCHITECTURE.md), [API](API.md). Không lặp công thức hoặc thay
  phạm vi MVP đã nghiệm thu; file này chỉ định nghĩa phần chat mới.

## 1. Phạm vi sử dụng

AI giúp người dùng hỏi dữ liệu thay vì mở nhiều bảng/bộ lọc. Backend tính
mọi số liệu; AI chọn tool, đối chiếu facts và giải thích. V1 hỗ trợ:

- Thống kê số/cặp, gap và kỳ gần nhất trong phạm vi đã chọn.
- Phân tích một bộ main; tìm exact match và historical overlap.
- So sánh tối đa hai bộ, gồm follow-up “thay 19 bằng 22 thì sao?”.
- So sánh tần suất giữa hai cửa sổ, có mẫu số và cutoff rõ ràng.
- Giải thích ý nghĩa metric và giới hạn dữ liệu, dẫn đến màn hình gốc.

“Bộ này có ổn không?” được hiểu là mô tả frequency/gap/pairs/exact match,
không xếp hạng khả năng trúng. Tiêu chí chưa rõ thì hỏi lại.

Ngoài V1: prediction, score tổng hợp, khuyến nghị mua vé, special/full-ticket
analytics, backtest, generator qua chat, triplets, RAG/vector DB, MCP, voice,
streaming, saved picks và nhiều provider. Generator hiện có vẫn ở màn hình
riêng; chat không tự thêm rule hot/cold hoặc chọn số ngẫu nhiên.

## 2. Khả thi và lựa chọn

**Khả thi về kiến trúc; độ khó trung bình đến cao ở orchestration và kiểm
chứng câu trả lời.** Đây là đánh giá từ code, chưa phải benchmark model.

| Thành phần | Đã có trong code | Cần thêm |
| --- | --- | --- |
| Frequency/gap/pairs | `AnalyticsService`, `analytics/metrics.py` | Adapter, lọc và giới hạn output |
| Phân tích bộ, exact/overlap | `CheckerService`, hàm pure `check_draws` | Hai bộ dùng cùng snapshot |
| So sánh cửa sổ | Core tính metric theo window | Tính percent/delta ở backend |
| Chat/follow-up | Chưa có | Context, tool loop, evidence, persistence và UI |
| AI runtime/quota | Chưa có SDK/config/auth chat | Provider adapter, session isolation, timeout và budget |

| Phương án | Đánh đổi | Quyết định đề xuất |
| --- | --- | --- |
| LLM trích intent, backend chạy mẫu truy vấn cố định | Dễ kiểm thử, ít vòng gọi; hạn chế câu hỏi phối hợp | Có thể dùng fallback sau |
| Tool calling có giới hạn trong backend hiện tại | Giữ multi-tool analysis, tái sử dụng core; cần kiểm chứng evidence | **Chọn V1** |
| Agent tự do/SQL/MCP hoặc hệ thống agent riêng | Quyền, chi phí và phạm vi lớn hơn nhu cầu | Không chọn |

Rủi ro chính: hiểu sai câu hỏi, trộn snapshot, bịa diễn giải, tăng chi phí.
Prompt đơn thuần không đủ. Nhóm 20–30 người có thể pilot với quota; chưa
có căn cứ cam kết 20–30 lượt chạy đồng thời hoặc độ trễ cố định.

## 3. Kiến trúc và luồng một turn

```text
Chat UI → HTTP API → ChatService / Orchestrator → Provider adapter → OpenAI
                             ↓                        ↑
                      Tool registry → Analytics facts
                             ↓
                 Existing pure analytics / checker
                             ↑
                  TurnSnapshot ← PostgreSQL
```

Thêm `app/chat/` cho context, orchestrator, tools, evidence và một OpenAI
adapter; route/schema/repository theo kiến trúc hiện có. Không cần framework
agent, microservice, Redis hoặc abstraction đa provider từ đầu.

1. Nhận message/context UI; kiểm tra ownership/quota; tạo turn pending với
   `request_id` unique và reserve budget trước khi gọi provider.
2. Model trích intent có cấu trúc: game/window, tối đa hai bộ và phần cần hỏi
   lại. Backend validate; chỉ dùng default UI khi user không chỉ định. Thiếu
   số hoặc “bộ trước” không rõ → clarification, không tự điền.
3. Chụp `TurnSnapshot` trong một transaction `REPEATABLE READ`: cutoff,
   `data_version`, window draws và lịch sử đến cutoff. **Đóng transaction
   trước khi chờ LLM**, giữ snapshot bất biến tạm thời trong lượt này.
4. Model gọi tool trong allowlist; backend chạy trên snapshot, trả facts có
   evidence ID. Game/window chính do backend gắn, không đổi giữa các tool.
5. Kiểm tra answer/evidence, cập nhật turn và context hợp lệ vào PostgreSQL,
   trả UI. Tool/provider lỗi không được ghi thành success.

Turn mới lấy latest trừ khi user chọn cutoff cụ thể. Khi version thay đổi,
tính lại cả hai bộ; không dùng facts cũ để so với facts mới. Lưu observations
để đối chiếu answer cũ: chỉ pin cutoff không ngăn correction thay đổi dữ liệu.

## 4. Năm tool V1

Tool chỉ đọc snapshot, không trigger ingestion, chạy SQL từ model hoặc gọi
URL tùy ý. Gộp frequency và gap, tái sử dụng checker thay vì tạo engine mới.

| Tool | Input ngoài context cố định | Output / implementation |
| --- | --- | --- |
| `get_recent_draws` | `limit` 1–20 | Kỳ đến cutoff, main/special riêng, source/deep link |
| `analyze_numbers` | Numbers hoặc tất cả; sort allowlist | Frequency, percent, dense rank, gap; `number_metrics` |
| `analyze_pairs` | Mode: pair cụ thể, partner của một số, hoặc top pairs; tối đa 20 dòng | Count/percent/gap; `pair_metrics`; từ chối input mode mâu thuẫn |
| `analyze_sets` | Một/hai bộ main hợp lệ | Per-number/pair, exact, histogram, tối đa 5 similar draws/bộ; `check_draws` |
| `compare_frequency_windows` | Numbers hoặc tất cả; hai count khác nhau trong 10/20/30/50/100 | Count, denominator, percent và delta từ cùng snapshot |

Output có `evidence_id`, tool/parameters, context, status và data. Output
rút gọn phải có `total`/`returned_count`/`truncated`; không đưa toàn history
hoặc bảng pairs vào prompt, không gọi top K là kết quả đầy đủ.

Semantics giữ nguyên [Analytics](ANALYTICS.md): gap theo window, chưa thấy
→ `null`, khác 0. Exact/overlap dùng lịch sử đến cutoff; per-number/pair dùng
window. Trả cả `actual_draw_count` và `history_draw_count` khi cần.

So sánh cửa sổ: delta = percent cửa sổ ngắn trừ cửa sổ dài, đơn vị **điểm
phần trăm**, do backend tính. Nêu denominator thực tế; window rỗng → percent/
delta `null`. Cửa sổ lồng nhau không là mẫu độc lập; không gọi chênh lệch này
là xu hướng có ý nghĩa thống kê hoặc dự báo kỳ tiếp theo.

## 5. Context, API và persistence

Context gồm game ID chuẩn, analysis window, cutoff lựa chọn, `current_set`
và `comparison_set` nullable. Follow-up tạo bộ mới từ context, validate số
bị thay/số mới và hiển thị bộ đã hiểu. Đổi game tạo hội thoại mới, không
chuyển bộ Lotto thành Mega; đổi window tính lại metrics. Context số không
chỉ dựa vào prose/tóm tắt của model.
Message yêu cầu game khác hội thoại → nhắc chuyển game/tạo hội thoại mới,
không thực thi tool với game khác rồi giữ nhãn/context cũ.

API đề xuất, sẽ đưa vào API contract sau khi duyệt thiết kế:

- `POST /api/v1/chat/conversations`: tạo với game/window UI.
- `POST /api/v1/chat/conversations/{id}/turns`: `request_id`, message, context
  thay đổi nếu có; trả turn ID, context, answer, evidence, usage và status
  `answered`/`clarification`/`partial`.
- `GET /api/v1/chat/conversations/{id}/turns`: history có paging.
- `DELETE /api/v1/chat/conversations/{id}`: xóa history/evidence.

Browser session dùng cookie ngẫu nhiên `HttpOnly`, `SameSite=Strict`, `Secure`
khi HTTPS; lưu hash/owner và kiểm tra quyền mọi endpoint. UUID hội thoại
không thay ownership. Cookie tách phiên **không bảo vệ endpoint public**;
bản local dùng trong phạm vi mạng tin cậy, không xây tài khoản ở V1.

Migration thêm session/expiry, conversation/context, turn/observations và
budget ledger trong PostgreSQL. Turn lưu request ID unique trong hội thoại,
status, answer/evidence, model, prompt/schema version, tokens và latency.
Xóa chat sau 7 ngày hoặc theo yêu cầu, không ảnh hưởng draws. Console chỉ log
metadata, không raw chat, key hoặc private reasoning.
Xóa chat không hoàn lại quota; budget ledger giữ counter/reservation độc lập,
không chứa nội dung hội thoại.

Một turn đang chạy/hội thoại. Cùng request ID trả trạng thái/kết quả đã có,
không tự gọi provider lần nữa. Timeout sau khi provider nhận request có thể
vẫn mất phí; idempotency ứng dụng không bảo đảm provider chỉ tính phí một lần.

## 6. OpenAI, độ tin cậy và giới hạn vận hành

Dùng Responses API, function calling `strict:true`; adapter giữ các response
items cần thiết cho tool loop. Backend vẫn validate nghiệp vụ.
[Function calling](https://developers.openai.com/api/docs/guides/function-calling)

Final output có cấu trúc: status, nhận xét với evidence reference, câu hỏi
làm rõ nullable và limitations. UI render bảng số trực tiếp từ facts backend;
reference phải tồn tại và field/value phải khớp. Không công bố nhận xét thiếu
evidence. Schema không chứng minh prose đúng; vẫn cần eval và wording rules,
không cam kết tuyệt đối “không hallucinate”.
[Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

API key chỉ ở backend; `store:false`, history gửi có giới hạn, không dùng
provider làm nơi lưu hội thoại chính. Thông báo user rằng message/facts tối
thiểu được gửi tới OpenAI; `store:false` không có nghĩa zero retention.
[Data controls](https://developers.openai.com/api/docs/guides/your-data)

Giới hạn khởi điểm đề xuất, cấu hình tập trung trước bật chat:

- Message ≤2.000 ký tự; history gửi ≤6 lượt + structured context.
- ≤5 provider requests/turn, gồm resolve intent/final; ≤6 tool calls;
  deadline tổng 60 giây, token caps do orchestrator enforce.
- ≤2 turn AI đồng thời toàn ứng dụng; 5 turn/phút/session; quá quota → 429.
- `LOTTO_CHAT_ENABLED=false` mặc định; thiếu key/model/token caps/budget
  thì không bật. Ngân sách ngày và model pilot do quản trị viên chọn.
- Reserve budget PostgreSQL trước call, reconcile usage mọi vòng/kể cả lỗi;
  timeout không rõ phí giữ reservation bảo thủ. Không retry mù hoặc chỉ dựa
  vào budget dashboard. Chi phí tính tổng token **tất cả** requests/turn.

Input sai → clarification/422; provider lỗi → 503, timeout → 504; DB lỗi →
error thật. Tool thiếu dữ liệu trả null/empty có phạm vi; lỗi không thay bằng
0. `partial` chỉ khi có phần evidence hợp lệ, nêu rõ phần thiếu. Prompt
injection không được mở rộng allowlist. Tắt chat không ảnh hưởng core app.

## 7. UX và nghiệm thu

Trang `/chat` dùng game/window hiện có, input text, history, ví dụ câu hỏi và
trạng thái đang phân tích. Answer ngắn + evidence có context/link gốc. Có
New chat, xóa history, retry; giữ draft khi lỗi, bỏ response muộn khi context
đổi. Render an toàn, không chạy HTML/script từ AI; mobile/keyboard theo rules.

Hỏi “số nào sắp ra/bộ nào dễ trúng” → giải thích giới hạn, đề nghị thống kê
lịch sử. Output nêu kết luận/tiêu chí/evidence; không yêu cầu hidden reasoning.

Acceptance:

- Fixtures tính tay cả game: 0/null, same-day order, special isolation,
  exact/overlap đúng scope, denominator/delta khi thiếu kỳ.
- Multi-tool/hai bộ cùng snapshot cả khi concurrent ingestion/correction;
  follow-up và đổi window không trộn version/evidence.
- Fake provider: unknown tool, invalid args/IDs, malformed output/refusal,
  lỗi/timeout, limits, request lặp, ownership và quota đồng thời.
- Eval tiếng Việt ≥30 câu + follow-up có expected tools/arguments/facts;
  gồm câu mơ hồ, injection, dự báo và thiếu dữ liệu. Pilot thật đo cost/
  latency; chặn mọi ca prediction, lẫn special hoặc evidence sai trước bật.
- E2E desktop/mobile cho answer/link, empty/error/retry, đổi game/response
  muộn, keyboard; quality gates, migration/backup theo Workflow.

## 8. Trình tự và quyết định còn lại

1. Duyệt scope V1; chọn model pilot, token caps và budget/ngày. Tạo ADR cho
   quyết định thực tế; cập nhật API/Data Model/wireframe tại nguồn tương ứng.
2. `TurnSnapshot`, tool adapters và fixture tests chạy offline.
3. Migration, context/ownership, tool loop, quota và fake provider tests.
4. OpenAI pilot/evidence checks; chọn model theo tiếng Việt, tool accuracy,
   latency/cost thực đo, không chỉ nhãn “reasoning” hoặc giá thấp.
5. UI/E2E/load test theo quota, docs vận hành; bật cho nhóm kín sau nghiệm thu.

Lượt này hoàn thành phân tích/biên tập. **Chưa chốt model và ngân sách**, chưa
có live AI evaluation hoặc cam kết throughput. Không triển khai chat, thay
migration hay đánh dấu feature hoàn thành chỉ từ tài liệu đề xuất này.
