# Vietlott Analytics

## 1. Project Overview

**Vietlott Analytics** là một hệ thống phân tích dữ liệu xổ số Vietlott, tập trung vào việc thu thập, lưu trữ, xử lý và phân tích dữ liệu lịch sử một cách có cấu trúc.

Phiên bản đầu tiên tập trung vào:

- Lotto 5/35
- Mega 6/45

Mở rộng sau MVP ngày 14/10/2026: Power 6/55, cùng các luồng phân tích lịch sử.
Scope ban đầu và bằng chứng nghiệm thu MVP được giữ theo mốc cũ.

Hệ thống được xây dựng để:

- tự động thu thập kết quả quay;
- lưu trữ lịch sử chính xác;
- phân tích tần suất và khoảng cách xuất hiện của các số;
- phân tích quan hệ giữa các số;
- kiểm tra một bộ số với dữ liệu lịch sử;
- sinh combination theo rule;
- hỗ trợ xây dựng và kiểm chứng strategy bằng backtesting.

Đây là một **data analytics system**, không phải hệ thống dự đoán kết quả xổ số.

> Frontend/UI không được mô tả trong tài liệu này. Thiết kế giao diện, user flow và wireframe sẽ được định nghĩa riêng trong `wireframe.md`.

---

## 2. Project Goals

Các mục tiêu chính:

1. Tự động thu thập kết quả xổ số.
2. Lưu trữ lịch sử kết quả một cách chính xác và có cấu trúc.
3. Tự động tính toán các thống kê từ dữ liệu lịch sử.
4. Cho phép phân tích theo các cửa sổ dữ liệu khác nhau:
   - 10 kỳ;
   - 20 kỳ;
   - 30 kỳ;
   - 50 kỳ;
   - 100 kỳ;
   - khoảng ngày tùy chỉnh;
   - toàn bộ lịch sử.
5. Cho phép kiểm tra một combination với dữ liệu lịch sử.
6. Sinh combination theo rule do người dùng cấu hình.
7. Cho phép lưu và backtest strategy.
8. Có kiến trúc đủ đơn giản để triển khai nhanh nhưng vẫn dễ mở rộng.
9. Có thể bổ sung game hoặc analytics mới mà không cần viết lại core system.

---

## 3. Non-Goals

Hệ thống **không** được thiết kế để:

- khẳng định số nào có khả năng xuất hiện cao hơn ở kỳ tiếp theo;
- dự đoán chắc chắn kết quả;
- coi Hot Number, Cold Number, Gap hoặc Pair Frequency là bằng chứng rằng một số sẽ xuất hiện;
- sử dụng thuật ngữ như `winning probability` nếu không có mô hình xác suất hợp lệ;
- tự động đặt cược hoặc mua vé;
- quảng bá bất kỳ strategy nào như phương pháp đảm bảo sinh lời.

Các metric của hệ thống chỉ mô tả và kiểm chứng dữ liệu lịch sử.

---

## 4. Supported Games

### 4.1 Lotto 5/35

Một kết quả gồm:

- 5 `main_numbers` trong miền `01–35`;
- 1 `special_number` trong miền `01–12`.

Ví dụ:

```text
07 19 25 29 33 | 04
```

Hệ thống phải phân biệt rõ:

```text
main_numbers
special_number
```

`special_number` không được trộn vào thống kê của `main_numbers`.

---

### 4.2 Mega 6/45

Một kết quả gồm:

- 6 `main_numbers` trong miền `01–45`.

Ví dụ:

```text
02 06 12 15 25 26
```

Mega 6/45 không sử dụng `special_number` theo domain model của Lotto 5/35.

---

### 4.3 Power 6/55 — mở rộng sau MVP

Game `power_655` có sáu main khác nhau trong 01–55 và một special trong 01–55,
lấy từ 49 số còn lại, không được trùng main. Special chỉ hiển thị trong draw
và điều kiện giải; checker/generator tiếp tục nhận sáu main. Năm hạng giải là
Jackpot 1, Jackpot 2, Giải Nhất, Giải Nhì, Giải Ba. Nguồn chuẩn chi tiết ở
[DOMAIN.md](DOMAIN.md), quyết định triển khai ở
[ADR 0006](DECISIONS/0006-power-655.md).

---

## 5. Core Domain Concepts

### 5.1 Draw

Một `Draw` đại diện cho một kỳ quay chính thức.

Các thuộc tính cấp cao:

```text
game
draw_id
draw_date
draw_time
main_numbers
special_number
source
created_at
updated_at
```

Yêu cầu:

- `game + draw_id` phải unique;
- các số phải được validate theo rule của từng game;
- dữ liệu phải được normalize trước khi lưu.

---

### 5.2 Combination

Một `Combination` là một bộ số dùng để:

- kiểm tra lịch sử;
- generate;
- áp dụng strategy;
- backtest;
- lưu bộ số người dùng đã chọn trong tương lai.

Combination phải được normalize trước khi so sánh.

Ví dụ:

```text
19 07 33 25 29
```

phải được normalize thành:

```text
07 19 25 29 33
```

Thứ tự nhập không ảnh hưởng đến identity của combination.

---

### 5.3 Analysis Window

`Analysis Window` xác định tập dữ liệu được dùng để phân tích.

Ví dụ:

```text
last_10_draws
last_20_draws
last_30_draws
last_50_draws
last_100_draws
date_range
all_time
```

Analytics không được hard-code mặc định 30 kỳ trong core logic.

---

### 5.4 Strategy

`Strategy` là một tập hợp các rule có thể tái sử dụng để:

- filter combination;
- generate combination;
- backtest trên lịch sử.

Ví dụ:

```text
analysis_window = 30
exclude_exact_days = 365
max_previous_overlap = 3
minimum_pair_frequency = 1
odd_even_balance = true
```

---

## 6. Core Features

### 6.1 Data Collection

Hệ thống phải có pipeline:

```text
Data Source
    ↓
Fetcher
    ↓
Parser
    ↓
Validator
    ↓
Normalizer
    ↓
Database
```

Yêu cầu:

- tự động lấy kỳ quay mới;
- không insert duplicate;
- validate range của các số;
- validate số lượng `main_numbers`;
- validate `special_number` nếu game yêu cầu;
- lưu source của dữ liệu;
- có retry khi source tạm thời lỗi;
- ingestion job phải idempotent.

Database là **single source of truth**.

Không sử dụng DataFrame làm persistent storage.

---

### 6.2 Draw History

Hệ thống phải hỗ trợ truy vấn lịch sử theo:

- game;
- khoảng ngày;
- số kỳ gần nhất;
- `draw_id`;
- combination cụ thể.

Kết quả phải được sort theo thời gian nhất quán.

---

### 6.3 Number Frequency

Frequency được định nghĩa:

```text
frequency(number, window)
=
số lần number xuất hiện trong các draw thuộc window
```

Ví dụ:

```text
Number    Frequency (30 draws)

01        4
02        7
03        2
...
```

Có thể tính:

- count;
- percentage;
- ranking.

Hot/Cold chỉ là classification dựa trên frequency trong window.

Không sử dụng Hot/Cold như prediction.

---

### 6.4 Gap / Recency

Gap mô tả số kỳ kể từ lần xuất hiện gần nhất.

Ví dụ:

```text
Number 25

Frequency: 6
Last appeared: 3 draws ago
Gap: 3
```

Các metric:

```text
current_gap
average_gap
max_gap
last_seen_draw
```

Frequency và Gap phải được xử lý độc lập.

---

### 6.5 Pair Analysis

Phân tích số lần hai `main_numbers` cùng xuất hiện.

Ví dụ:

```text
19 + 25 → 5 lần
15 + 33 → 4 lần
07 + 29 → 3 lần
```

Pair identity phải canonical.

Ví dụ:

```text
(25, 19)
```

được normalize thành:

```text
(19, 25)
```

Hệ thống phải hỗ trợ:

```text
pair_frequency
top_pairs
draws_containing_pair
```

Triplet analysis không thuộc MVP nhưng kiến trúc không nên ngăn cản việc bổ sung sau này.

---

### 6.6 Combination Checker

Người dùng hoặc API client có thể cung cấp một combination.

Ví dụ:

```text
07 19 25 29 33
```

Hệ thống kiểm tra:

#### Exact Match

```text
exact_match_count
last_exact_match
```

#### Historical Overlap

Lotto 5/35:

```text
2/5
3/5
4/5
5/5
```

Mega 6/45:

```text
2/6
3/6
4/6
5/6
6/6
```

#### Recent Similarity

Ví dụ:

```text
Input:
07 19 25 29 33

Historical draw:
07 19 25 29 31

Overlap:
4/5
```

Hệ thống chỉ mô tả similarity, không tự đánh giá combination là tốt hoặc xấu.

---

### 6.7 Combination Generator

Sau MVP, giao diện Mega/Power chuyển sang [lồng cầu vật lý](DRAW_SIMULATION.md)
ngày 24/10/2026; Lotto cũng thay thế hoàn toàn UI rule ngày 25/10/2026 theo yêu
cầu người dùng. Chỉ generator API backend tiếp tục contract rule/explanation
dưới đây; mô phỏng dùng `main_count` của game. Theo yêu cầu bổ sung ngày
25/10/2026, Lotto quay thêm 1 special từ lồng riêng 1–12 sau 5 main; checker
vẫn chỉ nhận main, Mega/Power vẫn chỉ mô phỏng main.

Generator tạo combination dựa trên configurable rules.

Ví dụ:

```text
exclude_exact_match_within_days = 365
max_overlap_previous_draw = 3
minimum_historical_pair_count = 1
exclude_bottom_frequency_numbers = 5
odd_even_ratio = [2, 3]
sum_range = [70, 120]
```

Pipeline:

```text
Generate Candidate
        ↓
Normalize
        ↓
Apply Rules
        ↓
Validate
        ↓
Calculate Analytics
        ↓
Return Combination + Explanation
```

Generator phải hỗ trợ optional random seed để kết quả có thể reproducible khi cần.

---

### 6.8 Combination Explanation

Mỗi generated combination phải có explanation.

Ví dụ:

```text
Combination:
07 15 19 27 33

Frequency (30 draws):
07 → 4
15 → 6
19 → 7
27 → 5
33 → 7

Historical pairs:
19–27 → 3
15–33 → 2

Exact historical match:
None within last 365 days

Maximum recent overlap:
3/5
```

Không sử dụng opaque `AI score` trong MVP.

Nếu sau này có scoring model, từng thành phần của score phải giải thích được.

---

## 7. Backtesting

Backtesting dùng dữ liệu lịch sử để kiểm tra strategy.

Nguyên tắc quan trọng:

> Khi backtest draw `N`, strategy chỉ được phép nhìn thấy dữ liệu trước draw `N`.

Không được sử dụng future data.

Pipeline:

```text
Historical Data
      ↓
Choose Evaluation Draw N
      ↓
Provide Only Draws < N
      ↓
Generate / Select Combination
      ↓
Compare With Actual Draw N
      ↓
Store Metrics
```

Các metric có thể gồm:

```text
total_simulations
match_0
match_1
match_2
match_3
match_4
match_5
match_6
```

Strategy nên có khả năng so sánh với:

```text
Random Baseline
```

Mục tiêu là kiểm tra strategy có tạo ra khác biệt đo lường được hay chỉ phản ánh random variation.

---

## 8. Technical Architecture

Kiến trúc ưu tiên:

```text
External Data Sources
        ↓
Data Ingestion
        ↓
Application Services
        ↓
Analytics / Strategy / Backtesting
        ↓
Repository Layer
        ↓
PostgreSQL
        ↑
      FastAPI
```

Ứng dụng sử dụng kiến trúc **modular monolith**.

Không triển khai microservices ở giai đoạn đầu.

Frontend không thuộc phạm vi của tài liệu này và sẽ được mô tả riêng trong `wireframe.md`.

---

## 9. Technology Stack

### 9.1 Language

```text
Python
```

Python được sử dụng cho:

- API;
- data ingestion;
- analytics;
- strategy engine;
- generator;
- backtesting;
- scheduled jobs.

---

### 9.2 Backend API

```text
FastAPI
Pydantic
```

FastAPI là HTTP API layer của hệ thống.

Business logic không được đặt trực tiếp trong route handler.

---

### 9.3 Analytics

Ưu tiên:

```text
Polars
NumPy
```

Polars được sử dụng cho các tác vụ xử lý dữ liệu dạng bảng khi phù hợp.

DataFrame chỉ tồn tại trong analytics/data-processing layer.

Persistent data luôn nằm trong PostgreSQL.

---

### 9.4 Database

```text
PostgreSQL
SQLAlchemy
Alembic
```

Yêu cầu:

- unique constraints;
- indexes phù hợp;
- foreign keys;
- transactional writes;
- versioned migrations.

---

### 9.5 HTTP / Data Collection

Ưu tiên:

```text
httpx
```

Mỗi nguồn dữ liệu phải được triển khai qua adapter riêng.

Ví dụ:

```text
VietlottDataSource
```

HTML parsing hoặc source-specific logic không được xuất hiện trong business logic.

Nếu source thay đổi cấu trúc, phạm vi thay đổi nên chủ yếu nằm ở datasource adapter/parser.

---

### 9.6 Background Jobs

Giai đoạn đầu ưu tiên:

```text
APScheduler
```

Không đưa Celery hoặc Redis vào project nếu chưa có workload thực tế yêu cầu distributed worker.

---

### 9.7 Development Tooling

Dependency management:

```text
uv
```

Code quality:

```text
Ruff
Pyright
pytest
```

Yêu cầu:

- Python type hints;
- clear naming;
- deterministic business logic;
- automated tests cho logic quan trọng.

---

### 9.8 Deployment

Deployment ban đầu:

```text
Docker Compose
```

Services tối thiểu:

```text
backend
postgres
```

Có thể bổ sung reverse proxy khi deploy production.

Không sử dụng Kubernetes ở giai đoạn này.

Mục tiêu:

- đơn giản;
- reproducible;
- dễ backup;
- dễ migrate;
- chạy ổn định trên VPS nhỏ.

---

## 10. Suggested Backend Structure

```text
backend/
├── app/
│   ├── api/
│   ├── core/
│   ├── db/
│   ├── models/
│   ├── repositories/
│   ├── schemas/
│   │
│   ├── games/
│   │   ├── lotto_535/
│   │   └── mega_645/
│   │
│   ├── ingestion/
│   │   ├── sources/
│   │   ├── parsers/
│   │   └── validators/
│   │
│   ├── analytics/
│   │   ├── frequency.py
│   │   ├── gap.py
│   │   ├── pairs.py
│   │   └── overlap.py
│   │
│   ├── strategies/
│   ├── generators/
│   ├── backtesting/
│   └── jobs/
│
├── tests/
├── migrations/
└── pyproject.toml
```

Không tạo abstraction nếu chưa có use case thực tế.

Ưu tiên readable code hơn design pattern phức tạp.

---

## 11. MVP Scope

MVP tập trung vào:

```text
1. Domain model
2. Database schema
3. Historical draw import
4. Automatic draw collection
5. Draw history queries
6. Frequency analysis
7. Gap analysis
8. Pair analysis
9. Combination checker
10. Basic rule-based generator
11. Combination explanation
12. Automated tests cho core analytics
```

Không đưa vào MVP:

```text
Machine Learning
AI prediction
Frontend implementation
Native mobile application
Multi-user system
Social features
Payments
Complex notification system
Microservices
Distributed workers
```

---

## 12. Phase 2

Sau khi MVP ổn định:

```text
Strategy management
Backtesting
Random baseline comparison
Saved picks
Triplet analysis
Analytics export
Scheduled notifications
Additional Vietlott games
```

---

## 13. Engineering Principles

### 13.1 Correctness Before Optimization

Tính đúng của dữ liệu và analytics quan trọng hơn tối ưu performance sớm.

---

### 13.2 Database Is the Source of Truth

Không lưu state quan trọng chỉ trong memory hoặc DataFrame.

---

### 13.3 Idempotent Ingestion

Chạy collector nhiều lần không được tạo duplicate draw.

---

### 13.4 Centralized Domain Rules

Không hard-code các giá trị như:

```text
35
45
5
6
12
```

rải rác trong code.

Mỗi game phải có domain definition/configuration riêng.

---

### 13.5 Deterministic Analytics

Với cùng dataset và cùng parameters, analytics phải trả cùng kết quả.

---

### 13.6 Explainable Generator

Người dùng phải có khả năng biết tại sao combination vượt qua hoặc bị loại bởi một rule.

---

### 13.7 Prevent Data Leakage

Backtesting không được sử dụng dữ liệu tương lai.

---

### 13.8 Avoid Premature Abstraction

Không áp dụng Clean Architecture, DDD hoặc design pattern một cách máy móc.

Chỉ tạo abstraction khi abstraction giải quyết một vấn đề thực tế.

---

### 13.9 Test Business-Critical Logic

Ưu tiên test:

```text
draw validation
number normalization
frequency
gap
pair counting
combination matching
overlap calculation
strategy filtering
generator rules
backtesting
```

---

## 14. Product Philosophy

Ứng dụng phải trả lời câu hỏi:

> “Dữ liệu lịch sử đang cho thấy điều gì?”

thay vì:

> “Kỳ tiếp theo chắc chắn sẽ ra số nào?”

Hệ thống hỗ trợ quy trình:

```text
Collect
→ Explore
→ Analyze
→ Define Strategy
→ Test
→ Compare
```

Mục tiêu là cung cấp dữ liệu và công cụ phân tích minh bạch, không tạo cảm giác chắc chắn giả tạo từ một quá trình ngẫu nhiên.

---

## 15. Definition of Success

MVP được xem là thành công khi:

1. Có thể lưu chính xác kết quả Lotto 5/35 và Mega 6/45.
2. Có thể tự động cập nhật kỳ quay mới.
3. Có thể truy vấn lịch sử nhanh chóng.
4. Frequency theo analysis window được tính chính xác.
5. Gap của từng số được tính chính xác.
6. Pair frequency được tính chính xác.
7. Combination checker kiểm tra được exact match và overlap.
8. Generator tạo được combination theo configurable rules.
9. Generated combination có explanation.
10. Core analytics có automated tests.
11. Hệ thống có thể deploy bằng Docker theo quy trình đơn giản.
12. Kiến trúc cho phép thêm game và analytics mới mà không phải viết lại core system.

---

## 16. Source of Truth

Khi có mâu thuẫn trong quá trình phát triển, ưu tiên:

```text
1. Domain documentation
2. Architecture documentation
3. Feature specification
4. Automated tests
5. Implementation
```

Nếu implementation khác documentation, agent không được tự giả định implementation là đúng.

Agent phải xác định nguyên nhân và cập nhật đúng layer.

---

## 17. Documentation Strategy

Project nên duy trì:

```text
docs/
├── PROJECT_OVERVIEW.md
├── DOMAIN.md
├── ARCHITECTURE.md
├── DATA_MODEL.md
├── DATA_PIPELINE.md
├── ANALYTICS.md
├── API.md
├── MVP.md
├── wireframe.md
└── DECISIONS/
```

Vai trò:

- `PROJECT_OVERVIEW.md`: mô tả **WHAT** và **WHY**.
- `DOMAIN.md`: định nghĩa domain rules và invariants.
- `ARCHITECTURE.md`: mô tả cấu trúc kỹ thuật và module boundaries.
- `DATA_MODEL.md`: định nghĩa entity, schema và relationship.
- `DATA_PIPELINE.md`: mô tả ingestion, validation và update flow.
- `ANALYTICS.md`: định nghĩa chính xác các metric và thuật toán.
- `API.md`: mô tả API contract.
- `MVP.md`: scope, milestone và acceptance criteria.
- `wireframe.md`: mô tả frontend, navigation, screen layout và user flow.
- `DECISIONS/`: lưu Architecture Decision Records (ADR).

`PROJECT_OVERVIEW.md` không nên chứa chi tiết implementation hoặc thiết kế frontend.
