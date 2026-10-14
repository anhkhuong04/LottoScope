# Vietlott Analytics — Frontend Wireframe Specification

## 1. Purpose

`wireframe.md` mô tả cấu trúc frontend, navigation, screen layout, user flow và interaction model của **Vietlott Analytics**.

Tài liệu này là source of truth cho phần **frontend experience**.

Mục tiêu của frontend:

- giúp người dùng xem nhanh dữ liệu lịch sử;
- phân tích số theo nhiều góc nhìn;
- kiểm tra combination;
- tạo combination theo rule;
- hỗ trợ strategy và backtesting ở phase sau;
- sử dụng tốt trên desktop và mobile;
- giữ giao diện rõ ràng, data-centric và không gây hiểu nhầm rằng hệ thống có khả năng dự đoán chắc chắn kết quả xổ số.

Frontend phải ưu tiên:

1. clarity;
2. fast scanning;
3. low interaction cost;
4. explainability;
5. responsive behavior;
6. consistent data presentation.

---

# 2. UX Principles

## 2.1 Data First

Các màn hình phân tích phải ưu tiên dữ liệu hơn decoration.

UI không nên sử dụng quá nhiều hiệu ứng, gradient hoặc animation làm giảm khả năng đọc bảng và biểu đồ.

---

## 2.2 Explain, Do Not Predict

Frontend không được sử dụng wording như:

```text
Best number
Winning number
Most likely to win
Guaranteed
Prediction accuracy
```

Thay vào đó dùng wording mô tả:

```text
Frequency
Gap
Historical overlap
Top pairs
Recent occurrence
Strategy result
Backtest result
```

---

## 2.3 Progressive Disclosure

Không hiển thị toàn bộ dữ liệu phức tạp cùng lúc.

Ưu tiên:

```text
Overview
→ Drill down
→ Detail
```

Ví dụ:

```text
Top Pair
→ Click Pair
→ Pair history
→ Draw list
```

---

## 2.4 Consistent Game Context

Mọi màn hình analytics phải luôn biết game hiện tại:

```text
Lotto 5/35
Mega 6/45
```

Game selector phải được giữ nhất quán giữa các màn hình.

Khi người dùng đổi game:

- analytics window có thể giữ nguyên nếu hợp lệ;
- dữ liệu phải reload theo game mới;
- combination input phải reset nếu rule của game thay đổi;
- không được giữ dữ liệu cũ gây nhầm lẫn.

---

# 3. Information Architecture

Mở rộng Power 6/55 (14/10/2026): game selector thêm Power, tái sử dụng mọi
màn hình và flow A–D. Numbers có 55 số; checker/picker yêu cầu đúng 6 main
trong 01–55, generator chỉ sinh main. History/dashboard/detail hiển thị
special tách khỏi main; bảng giải có năm hạng và tóm tắt cả Jackpot 1/2.
Đổi game phải reset input, hủy response muộn và giữ window còn hợp lệ.
Nghiệm thu desktop/tablet/mobile, deep links, loading/empty/error và accessibility
cho game thứ ba; tiêu chí MVP phía dưới ghi scope nghiệm thu ban đầu.

Frontend được chia thành các khu vực chính:

```text
Dashboard
Draw History
Numbers
Pairs
Combination Checker
Generator
Strategies        [Phase 2]
Backtesting       [Phase 2]
Saved Picks       [Phase 2]
Settings          [Optional]
```

MVP navigation:

```text
Dashboard
History
Numbers
Pairs
Checker
Generator
```

Phase 2 bổ sung:

```text
Strategies
Backtesting
Saved Picks
```

---

# 4. Recommended Routes

```text
/
├── /dashboard
├── /history
├── /numbers
│   └── /numbers/:number
├── /pairs
│   └── /pairs/:pair
├── /checker
├── /generator
├── /strategies              [Phase 2]
│   └── /strategies/:id
├── /backtesting             [Phase 2]
├── /saved-picks             [Phase 2]
└── /settings                [Optional]
```

Default route:

```text
/ → /dashboard
```

---

# 5. Global Application Shell

## 5.1 Desktop Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Top Bar                                                      │
│ Logo / App Name           Game Selector        Actions       │
├───────────────┬──────────────────────────────────────────────┤
│ Sidebar       │                                              │
│               │ Main Content                                 │
│ Dashboard     │                                              │
│ History       │                                              │
│ Numbers       │                                              │
│ Pairs         │                                              │
│ Checker       │                                              │
│ Generator     │                                              │
│               │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

### Top Bar

Bao gồm:

- application name;
- game selector;
- optional global refresh status;
- optional theme toggle;
- optional settings action.

### Sidebar

MVP:

```text
Dashboard
History
Numbers
Pairs
Checker
Generator
```

Sidebar:

- fixed trên desktop;
- collapsible nếu viewport hẹp;
- active item phải rõ ràng;
- icon chỉ hỗ trợ nhận diện, không thay text.

---

## 5.2 Mobile Layout

```text
┌──────────────────────────┐
│ Top App Bar              │
│ App Name   Game Selector │
├──────────────────────────┤
│                          │
│ Main Content             │
│                          │
├──────────────────────────┤
│ Bottom Navigation        │
└──────────────────────────┘
```

Mobile ưu tiên bottom navigation cho các mục thường dùng.

Đề xuất:

```text
Dashboard
History
Checker
Generator
More
```

`More` mở:

```text
Numbers
Pairs
Strategies [Phase 2]
Backtesting [Phase 2]
Settings
```

Không cố nhồi tất cả menu vào bottom navigation.

---

# 6. Global Controls

## 6.1 Game Selector

Hiển thị ở application shell.

```text
[ Lotto 5/35 ▼ ]
```

Options:

```text
Lotto 5/35
Mega 6/45
```

Game selector là global state.

---

## 6.2 Analysis Window Selector

Sử dụng trên các màn hình analytics.

Options mặc định:

```text
10 draws
20 draws
30 draws
50 draws
100 draws
Custom range
All time
```

Default:

```text
30 draws
```

UI example:

```text
Analysis window
[ Last 30 draws ▼ ]
```

Custom range:

```text
From [ date ]
To   [ date ]
[ Apply ]
```

---

## 6.3 Data Freshness Indicator

Frontend nên hiển thị trạng thái dữ liệu ở vị trí phụ, không chiếm ưu tiên.

Ví dụ:

```text
Last updated: 12:35 01/10/2026
```

Nếu update thất bại:

```text
Data update delayed
```

Không sử dụng error wording gây hiểu rằng dữ liệu hiện tại chắc chắn sai nếu chỉ là job mới nhất thất bại.

---

# 7. Dashboard

## 7.1 Goal

Dashboard trả lời nhanh:

1. kỳ gần nhất là gì;
2. dữ liệu 30 kỳ gần đây trông như thế nào;
3. số nào xuất hiện nhiều/ít;
4. số nào đang có gap cao;
5. pair nào xuất hiện nhiều;
6. người dùng có thể đi tiếp vào phân tích chi tiết nào.

---

## 7.2 Desktop Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Dashboard                         [Last 30 draws ▼]          │
├──────────────────────────────────────────────────────────────┤
│ Latest Draw                                                  │
│ Draw #XXXX | 01/10/2026                                     │
│                                                            │
│   07   19   25   29   33     | Special 04                  │
├───────────────────────┬──────────────────────────────────────┤
│ Summary Card          │ Summary Card                         │
│ Total Draws           │ Analysis Window                      │
│ 1,245                 │ 30 draws                             │
├───────────────────────┼──────────────────────────────────────┤
│ Summary Card          │ Summary Card                         │
│ Most Frequent         │ Highest Current Gap                  │
│ 19                    │ 31                                   │
├──────────────────────────────────────────────────────────────┤
│ Number Frequency                                             │
│ [ Bar Chart / Grid ]                                         │
├───────────────────────────────┬──────────────────────────────┤
│ Top Pairs                     │ Highest Gaps                  │
│ 19–25   5                     │ 31   gap 9                    │
│ 15–33   4                     │ 04   gap 8                    │
│ 07–29   3                     │ 22   gap 7                    │
├───────────────────────────────┴──────────────────────────────┤
│ Recent Draws                                                 │
│ table                                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 7.3 Dashboard Sections

### Latest Draw Card

Hiển thị:

- draw id;
- draw date;
- draw time nếu có;
- main numbers;
- special number nếu game hỗ trợ;
- link `View details`.

Number balls chỉ là visual representation.

Không dùng animation roulette hoặc slot-machine style.

---

### Summary Cards

MVP nên có tối đa 4 cards:

```text
Total stored draws
Current analysis window
Most frequent number
Highest current gap
```

Không nên hiển thị quá nhiều cards.

---

### Frequency Overview

Có hai presentation modes:

```text
Chart
Number Grid
```

Chart mode:

- x-axis: number;
- y-axis: frequency;
- tooltip có count và percentage.

Grid mode:

```text
01  4
02  7
03  2
...
```

Grid đặc biệt hữu ích trên mobile.

---

### Top Pairs

Hiển thị top 5 hoặc top 10 pairs.

Click pair → mở Pair Detail.

---

### Highest Gaps

Hiển thị top numbers theo `current_gap`.

Click number → Number Detail.

---

### Recent Draws

Desktop table:

```text
Draw ID | Date | Numbers | Special | Actions
```

Mobile:

mỗi draw là compact card.

---

# 8. Draw History Screen

## 8.1 Goal

Cho phép người dùng tra cứu và duyệt lịch sử draw.

---

## 8.2 Desktop Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Draw History                                                 │
├──────────────────────────────────────────────────────────────┤
│ Filters                                                      │
│ [Date From] [Date To] [Draw ID]                 [Reset]     │
├──────────────────────────────────────────────────────────────┤
│ Draw ID │ Date │ Main Numbers │ Special │ Actions           │
│--------------------------------------------------------------│
│ #1234   │ ...  │ 07 19 25...  │ 04      │ View              │
│ #1233   │ ...  │ ...           │ ...     │ View              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8.3 Filters

MVP:

- date from;
- date to;
- draw id;
- pagination.

Không cần advanced filtering theo từng number ở MVP.

Bổ sung 14/10/2026: phân trang dùng chung ở history, number/pair detail,
pair list và checker có ô “Đến trang”, tổng số trang và nút “Đi”. Nhập số
trang rồi Enter hoặc nhấn “Đi” để chuyển; gõ chưa gửi request. Chỉ nhận số
nguyên trong 1..tổng trang, báo lỗi tại ô nhập; Escape khôi phục trang hiện
tại. Giữ nút trước/sau, bộ lọc và URL/back/forward hiện có. Khi chỉ một trang,
vô hiệu hóa điều hướng. Mobile xuống dòng, không yêu cầu cuộn ngang, controls
có touch target ít nhất 44px; label/focus/lỗi hỗ trợ bàn phím và screen reader.

---

## 8.4 Draw Detail

Có thể sử dụng:

- side drawer trên desktop;
- bottom sheet/full page trên mobile.

Hiển thị:

```text
Draw ID
Date
Time
Main numbers
Special number
Source
Prize tiers / match conditions / winner count / published VND amount
```

Bổ sung theo yêu cầu 07/10/2026: bảng giải thưởng nằm dưới kết quả quay,
loading/error/retry độc lập. Desktop/tablet dùng bảng, mobile hiển thị từng
hạng thành card; nhấn mạnh Jackpot/Độc Đắc, phân biệt main và special trong
điều kiện. Nguồn/thu thập của bảng riêng với kết quả quay; thiếu dữ liệu không
thay bằng 0. Contract ở [API.md](API.md).

Optional:

```text
Previous draw overlap
Next draw overlap
```

không bắt buộc trong MVP.

---

# 9. Numbers Screen

## 9.1 Goal

Cho phép so sánh frequency và gap của tất cả số.

---

## 9.2 Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Numbers                            [Last 30 draws ▼]          │
├──────────────────────────────────────────────────────────────┤
│ View: [ Grid ] [ Table ] [ Chart ]                          │
├──────────────────────────────────────────────────────────────┤
│ 01   Frequency 4   Gap 2                                    │
│ 02   Frequency 7   Gap 0                                    │
│ 03   Frequency 2   Gap 8                                    │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 9.3 Number Grid

Grid là view mặc định.

Mỗi cell:

```text
┌───────────┐
│    19     │
│ Freq: 7   │
│ Gap: 1    │
└───────────┘
```

Không encode quá nhiều meaning bằng màu.

Nếu sử dụng màu:

- phải có text/value đi kèm;
- không dùng màu duy nhất để biểu diễn Hot/Cold;
- đảm bảo contrast accessibility.

---

## 9.4 Table View

Columns:

```text
Number
Frequency
Frequency %
Current Gap
Average Gap
Max Gap
Last Seen
```

Cho phép sort theo từng column.

---

# 10. Number Detail

Route:

```text
/numbers/:number
```

Wireframe:

```text
┌──────────────────────────────────────────────────────────────┐
│ Number 19                           [Last 30 draws ▼]         │
├──────────────────────────────────────────────────────────────┤
│ Frequency │ Current Gap │ Avg Gap │ Max Gap                  │
│ 7         │ 1           │ 3.2     │ 9                        │
├──────────────────────────────────────────────────────────────┤
│ Appearance Timeline                                          │
│ ●───●──────●─●────────●                                      │
├──────────────────────────────────────────────────────────────┤
│ Appeared With                                                │
│ 25 → 5                                                       │
│ 33 → 4                                                       │
│ 07 → 3                                                       │
├──────────────────────────────────────────────────────────────┤
│ Recent Draws Containing 19                                   │
└──────────────────────────────────────────────────────────────┘
```

MVP detail gồm:

- frequency;
- current gap;
- average gap;
- max gap;
- last seen;
- draw history containing number;
- most frequent pair partners.

---

# 11. Pairs Screen

## 11.1 Goal

Phân tích co-occurrence của hai số.

---

## 11.2 Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Pair Analysis                       [Last 30 draws ▼]         │
├──────────────────────────────────────────────────────────────┤
│ Minimum frequency [ 1 ▼ ]                                   │
│ Sort [ Highest frequency ▼ ]                                │
├──────────────────────────────────────────────────────────────┤
│ Pair        Count       % of draws        Last Seen          │
│ 19–25       5           16.7%             2 draws ago        │
│ 15–33       4           13.3%             1 draw ago         │
│ 07–29       3           10.0%             4 draws ago        │
└──────────────────────────────────────────────────────────────┘
```

---

## 11.3 Pair Interaction

Click pair:

```text
19–25
```

→ Pair Detail.

---

# 12. Pair Detail

Wireframe:

```text
┌──────────────────────────────────────────────────────────────┐
│ Pair 19–25                          [Last 30 draws ▼]         │
├──────────────────────────────────────────────────────────────┤
│ Frequency │ % of Draws │ Current Pair Gap │ Last Seen        │
├──────────────────────────────────────────────────────────────┤
│ Appearance Timeline                                          │
├──────────────────────────────────────────────────────────────┤
│ Draws Containing Pair                                        │
│ #1234   01/10/2026   07 19 25 29 33                         │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

# 13. Combination Checker

## 13.1 Goal

Cho phép người dùng nhập combination và xem lịch sử liên quan.

Đây là một trong những màn hình quan trọng nhất của MVP.

---

## 13.2 Desktop Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Combination Checker                                          │
├──────────────────────────────────────────────────────────────┤
│ Enter numbers                                                │
│                                                              │
│ [07] [19] [25] [29] [33]                                   │
│                                                              │
│ [ Check Combination ]                                        │
├──────────────────────────────────────────────────────────────┤
│ Result                                                       │
│                                                              │
│ Exact historical match                                      │
│ None                                                         │
│                                                              │
│ Exact match within last 365 days                             │
│ None                                                         │
├───────────────────────────────┬──────────────────────────────┤
│ Historical Overlap            │ Similar Draws                │
│ 4/5 → 3 draws                 │ #1202  4/5                   │
│ 3/5 → 17 draws                │ #1188  4/5                   │
│ 2/5 → 41 draws                │ #1121  3/5                   │
├───────────────────────────────┴──────────────────────────────┤
│ Number Analysis                                               │
│ 07  Freq 4  Gap 2                                            │
│ 19  Freq 7  Gap 1                                            │
│ ...                                                          │
├──────────────────────────────────────────────────────────────┤
│ Pair Analysis                                                 │
│ 19–25 → 5                                                     │
│ 07–29 → 3                                                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 13.3 Number Input

Không sử dụng plain text field duy nhất nếu tránh được.

Ưu tiên number picker / token input.

Lotto 5/35:

```text
5 main numbers
+
optional special number nếu checker có mode kiểm tra full ticket
```

Mega 6/45:

```text
6 main numbers
```

Validation phải diễn ra ngay trên client:

- duplicate number;
- out-of-range;
- thiếu số;
- thừa số.

Example:

```text
Number 36 is outside the valid range 01–35.
```

---

## 13.4 Checker Result Hierarchy

Thứ tự hiển thị:

1. Exact match;
2. overlap summary;
3. similar historical draws;
4. per-number analytics;
5. pair analytics.

Không bắt đầu bằng một score tổng hợp.

---

# 14. Generator

## 14.1 Goal

Cho phép người dùng sinh combination theo rule rõ ràng.

Generator phải nhấn mạnh:

```text
rules
constraints
explanation
```

không phải “prediction”.

---

## 14.2 Desktop Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Combination Generator                                        │
├───────────────────────┬──────────────────────────────────────┤
│ Rules                 │ Generated Results                    │
│                       │                                      │
│ Analysis Window       │ Combination #1                       │
│ [30 draws ▼]          │ 07 15 19 27 33                      │
│                       │                                      │
│ Exclude exact match   │ ✓ No exact match in 365 days        │
│ [365 days]            │ ✓ Pair rule satisfied               │
│                       │ ✓ Odd/Even 3:2                       │
│ Max previous overlap  │                                      │
│ [3]                   │ [View explanation]                  │
│                       │                                      │
│ Minimum pair count    │ Combination #2                       │
│ [1]                   │ ...                                  │
│                       │                                      │
│ Odd / Even            │                                      │
│ [3:2 ▼]               │                                      │
│                       │                                      │
│ Sum Range             │                                      │
│ [70] – [120]          │                                      │
│                       │                                      │
│ [ Generate ]          │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

---

## 14.3 Generator Rules — MVP

Supported UI rules:

```text
analysis window
exclude exact match within N days
max overlap with previous draw
minimum historical pair frequency
exclude N lowest-frequency numbers
odd/even ratio
sum range
number of combinations to generate
```

Không cần tất cả rule bật mặc định.

Mỗi rule nên có:

```text
toggle
value
help text
```

Ví dụ:

```text
☑ Exclude combinations seen in the last [365] days
```

---

## 14.4 Generated Result Card

Mỗi result:

```text
07 15 19 27 33

Rules
✓ No exact match within 365 days
✓ Previous draw overlap ≤ 3
✓ Contains historical pair ≥ 1
✓ Odd/Even = 3:2

[Explain]
```

Không dùng:

```text
Score: 92/100
Recommended
Best
```

trừ khi sau này có specification riêng cho scoring.

---

## 14.5 Explanation Drawer

Click `Explain`:

```text
Combination
07 15 19 27 33

Number frequency
07 → 4
15 → 6
19 → 7
27 → 5
33 → 7

Current gaps
...

Historical pairs
19–27 → 3
15–33 → 2

Historical exact match
None within 365 days

Maximum recent overlap
3/5
```

Desktop: side drawer.

Mobile: full-screen sheet/page.

---

# 15. Strategy Management — Phase 2

Route:

```text
/strategies
```

List:

```text
Balanced 30
Pair Focus
Low Overlap
Custom Strategy
```

Each strategy card:

```text
Name
Game
Analysis Window
Active Rules
Last Backtest
Actions
```

Actions:

```text
Run
Edit
Duplicate
Backtest
Delete
```

---

# 16. Strategy Editor — Phase 2

Wireframe:

```text
┌──────────────────────────────────────────────────────────────┐
│ Edit Strategy: Balanced 30                                  │
├──────────────────────────────────────────────────────────────┤
│ Name                                                         │
│ [ Balanced 30 ]                                              │
│                                                              │
│ Analysis Window                                              │
│ [30 draws ▼]                                                 │
│                                                              │
│ Rules                                                        │
│ ☑ Exclude exact match [365] days                            │
│ ☑ Max previous overlap [3]                                  │
│ ☑ Minimum pair frequency [1]                                │
│ ☑ Odd/Even [3:2]                                            │
│                                                              │
│ [Save Strategy]                                              │
└──────────────────────────────────────────────────────────────┘
```

---

# 17. Backtesting — Phase 2

## 17.1 Goal

Cho phép kiểm chứng strategy trên dữ liệu lịch sử.

---

## 17.2 Wireframe

```text
┌──────────────────────────────────────────────────────────────┐
│ Backtesting                                                  │
├──────────────────────────────────────────────────────────────┤
│ Strategy [ Balanced 30 ▼ ]                                  │
│ Evaluation Range [ From ] [ To ]                            │
│ Simulations per draw [ 10 ]                                 │
│ Random seed [ optional ]                                    │
│                                                              │
│ [ Run Backtest ]                                             │
├──────────────────────────────────────────────────────────────┤
│ Results                                                      │
│ Total simulations  2,000                                    │
│ Match 0            ...                                      │
│ Match 1            ...                                      │
│ Match 2            ...                                      │
│ Match 3            ...                                      │
│ Match 4            ...                                      │
│ Match 5            ...                                      │
├──────────────────────────────────────────────────────────────┤
│ Strategy vs Random Baseline                                 │
│ [ comparative chart ]                                       │
└──────────────────────────────────────────────────────────────┘
```

Frontend phải mô tả rõ:

```text
Backtest uses only information available before each evaluated draw.
```

---

# 18. Saved Picks — Phase 2

Mục đích:

- lưu combination người dùng thực sự chọn;
- đối chiếu kết quả sau draw;
- thống kê lịch sử cá nhân.

Wireframe:

```text
┌──────────────────────────────────────────────────────────────┐
│ Saved Picks                                                  │
├──────────────────────────────────────────────────────────────┤
│ Draw │ Combination │ Match │ Status │ Notes                 │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

Không đưa ROI hoặc profit tracking vào MVP/Phase 2 nếu chưa có specification riêng.

---

# 19. Loading States

Mỗi data section phải có loading state riêng.

Không block toàn màn hình nếu chỉ một widget đang reload.

Recommended:

```text
Skeleton card
Skeleton table rows
Skeleton chart
```

Game switch có thể trigger page-level loading nếu toàn bộ context thay đổi.

---

# 20. Empty States

Ví dụ:

### No draw data

```text
No draw data is available for this game yet.
```

### No pair matching filter

```text
No pairs meet the current frequency filter.
```

### No historical exact match

Đây không phải error.

```text
No exact historical match found.
```

---

# 21. Error States

Phân biệt:

```text
network error
server error
invalid input
no data
stale data
```

Không dùng một generic message cho mọi trường hợp.

Ví dụ:

```text
Unable to load pair analysis.
[Retry]
```

Không xoá dữ liệu cũ khỏi màn hình ngay nếu refresh mới thất bại và dữ liệu cũ vẫn hợp lệ.

---

# 22. Input Validation

Frontend validate ngay các lỗi có thể biết được.

Ví dụ combination input:

```text
Duplicate number: 19
```

```text
Lotto 5/35 accepts numbers from 01 to 35.
```

```text
Select exactly 5 main numbers.
```

Backend vẫn là authority cuối cùng.

Client-side validation không thay thế server validation.

---

# 23. Responsive Design

## 23.1 Desktop

Target:

```text
≥ 1024px
```

Ưu tiên:

- sidebar;
- multi-column cards;
- tables;
- charts;
- side-by-side generator configuration/result.

---

## 23.2 Tablet

Target:

```text
768–1023px
```

Behavior:

- collapsible sidebar;
- 2-column summary cards;
- tables có horizontal scroll nếu cần;
- generator có thể chuyển sang stacked layout.

---

## 23.3 Mobile

Target:

```text
< 768px
```

Behavior:

- bottom navigation;
- single-column layout;
- grid/table chuyển sang card khi cần;
- touch target ≥ 44px;
- chart phải scroll hoặc simplify nếu quá dày;
- filter sử dụng bottom sheet hoặc collapsible section;
- không yêu cầu horizontal scroll cho primary workflows.

---

# 24. Data Visualization Guidelines

## 24.1 Frequency

Ưu tiên:

```text
bar chart
number grid
```

Không dùng pie chart cho 35 hoặc 45 số.

---

## 24.2 Gap

Ưu tiên:

```text
sorted horizontal bar chart
table
```

---

## 24.3 Timeline

Number appearance hoặc pair appearance:

```text
dot timeline
simple line/tick timeline
```

Không cần animation phức tạp.

---

## 24.4 Backtesting

Ưu tiên:

```text
bar chart
distribution chart
comparison table
```

Strategy và Random Baseline phải được label rõ.

---

# 25. Color Semantics

Color không được tạo hàm ý dự đoán.

Không mặc định:

```text
green = likely winner
red = bad number
```

Nếu cần phân biệt frequency group:

```text
High frequency
Medium frequency
Low frequency
```

phải đi kèm label hoặc legend.

Không dựa hoàn toàn vào color vì accessibility.

---

# 26. Number Ball Component

Reusable visual component:

```text
[ 19 ]
```

Properties:

```text
value
size
variant
selected
disabled
```

Variants có thể gồm:

```text
main
special
neutral
selected
```

Không dùng animation kiểu quay số trong analytics screen.

---

# 27. Tables

Table phải hỗ trợ khi phù hợp:

- sortable columns;
- pagination;
- sticky header trên desktop;
- row hover;
- keyboard focus;
- empty state.

Không cần client-side filtering toàn dataset nếu backend đã hỗ trợ query.

---

# 28. Accessibility

Frontend cần đạt các nguyên tắc cơ bản:

- keyboard navigation;
- visible focus state;
- semantic headings;
- label cho form control;
- sufficient contrast;
- không dùng color làm tín hiệu duy nhất;
- chart có textual fallback hoặc accessible summary;
- button/action có label rõ.

---

# 29. Performance UX

Frontend phải tránh:

- load toàn bộ lịch sử draw vào browser;
- tính toán analytics nặng ở client;
- render hàng nghìn rows cùng lúc;
- fetch lại cùng data không cần thiết.

Frontend chịu trách nhiệm presentation.

Backend chịu trách nhiệm analytics.

---

# 30. Recommended State Separation

Frontend state nên phân biệt:

```text
Global State
├── selectedGame
├── theme
└── userPreferences

URL State
├── analysisWindow
├── filters
├── pagination
└── sort

Server State
├── draws
├── analytics
├── pairs
├── checkerResult
└── generatorResult

Local UI State
├── drawerOpen
├── modalOpen
└── temporaryFormValues
```

Các filter quan trọng nên nằm trên URL nếu có thể để:

- refresh không mất context;
- copy/share URL;
- browser back/forward hoạt động đúng.

---

# 31. Primary User Flows

## Flow A — Inspect Recent Statistics

```text
Open Dashboard
→ Select Game
→ Select Last 30 Draws
→ Review Frequency
→ Click Number
→ View Number Detail
```

---

## Flow B — Check a Combination

```text
Open Checker
→ Select Game
→ Enter Numbers
→ Validate Input
→ Check
→ View Exact Match
→ View Overlap
→ View Pair Analysis
```

---

## Flow C — Generate a Combination

```text
Open Generator
→ Select Game
→ Configure Rules
→ Generate
→ Review Results
→ Open Explanation
```

---

## Flow D — Inspect Pair

```text
Open Pairs
→ Select Analysis Window
→ Sort by Frequency
→ Select Pair
→ View Pair Detail
→ View Historical Draws
```

---

## Flow E — Backtest Strategy [Phase 2]

```text
Open Strategies
→ Select Strategy
→ Backtest
→ Choose Historical Range
→ Run
→ Compare Strategy vs Random Baseline
```

---

# 32. MVP Screen Priority

Implementation order:

```text
1. Application Shell
2. Dashboard
3. Draw History
4. Numbers
5. Number Detail
6. Pair Analysis
7. Pair Detail
8. Combination Checker
9. Generator
```

Phase 2:

```text
10. Strategies
11. Backtesting
12. Saved Picks
```

---

# 33. MVP Acceptance Criteria

Frontend MVP hoàn thành khi:

1. Người dùng có thể chuyển giữa Lotto 5/35 và Mega 6/45.
2. Dashboard hiển thị latest draw và analytics summary.
3. Người dùng có thể thay đổi analysis window.
4. Draw history hỗ trợ paging và date filter.
5. Numbers screen hiển thị frequency và gap.
6. Number detail hiển thị lịch sử của một số.
7. Pair screen hiển thị pair frequency.
8. Pair detail hiển thị các draw chứa pair.
9. Checker validate đúng input theo game.
10. Checker hiển thị exact match và overlap.
11. Generator cho phép cấu hình rule cơ bản.
12. Generated result có explanation.
13. Loading, empty và error states được xử lý rõ ràng.
14. Giao diện sử dụng tốt trên desktop và mobile.
15. Không có wording gây hiểu hệ thống đang dự đoán chắc chắn kết quả.

---

# 34. Out of Scope for This Document

`wireframe.md` không định nghĩa:

- backend data model;
- database schema;
- API implementation;
- analytics algorithm chi tiết;
- scraping logic;
- deployment architecture;
- exact visual branding;
- final typography/color palette;
- component library cụ thể.

Các nội dung này thuộc tài liệu khác.

---

# 35. Relationship With Other Documentation

```text
PROJECT_OVERVIEW.md
        │
        ├── WHAT / WHY
        │
        ▼
wireframe.md
        │
        ├── frontend structure
        ├── screens
        ├── user flows
        └── interactions
        │
        ▼
API.md
        │
        └── frontend/backend contract
```

Domain behavior vẫn phải tuân theo:

```text
DOMAIN.md
ANALYTICS.md
```

Frontend không được tự định nghĩa lại business rule.

---

# 36. Agent Guidance

Khi Codex triển khai frontend từ tài liệu này:

1. Không tự thêm feature ngoài scope chỉ vì UI library hỗ trợ.
2. Không tự thêm prediction score.
3. Không đưa business analytics logic vào frontend.
4. Không hard-code rule game rải rác trong component.
5. Reuse component cho:
   - game selector;
   - analysis window;
   - number ball;
   - metric card;
   - data table;
   - empty/error/loading state.
6. Ưu tiên feature-based structure.
7. Giữ filter và navigation có thể deep-link khi hợp lý.
8. Mọi màn hình phải được kiểm tra ở desktop và mobile.
9. Nếu specification frontend mâu thuẫn với domain documentation, domain documentation có ưu tiên cao hơn.
10. Nếu requirement không rõ, không tự suy diễn logic nghiệp vụ; đánh dấu TODO hoặc yêu cầu cập nhật specification.

---

# 37. Suggested Future Visual Design Document

Sau `wireframe.md`, có thể tạo thêm:

```text
DESIGN_SYSTEM.md
```

để định nghĩa:

```text
color tokens
typography
spacing
component variants
chart style
icons
dark mode
responsive tokens
```

Wireframe chỉ định nghĩa **structure và behavior**, không khóa project vào một visual design cụ thể.
