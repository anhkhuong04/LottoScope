# LottoScope Screenshots

Captured from the local Docker production build (`http://127.0.0.1:8088`) on **2026-11-24** against recorded PostgreSQL data (no mocked responses or post-capture image edits). Data values reflect the snapshot at capture time rather than live future draws.

| File                                           | View & State                                                                                                     | Viewport      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| [`dashboard.png`](dashboard.png)               | Mega 6/45 Overview, last 30 draws window, latest draw `#01592`, top 6 numbers & top 5 pairs                      | `1440 × 1020` |
| [`numbers.png`](numbers.png)                   | Lotto 5/35 main-number (`01–35`) frequency & rank grid over the last 30 draws                                    | `1440 × 900`  |
| [`checker.png`](checker.png)                   | Mega 6/45 Combination Checker (`01 09 11 28 33 42`) with exact match & overlap distribution across `1,592` draws | `1440 × 1400` |
| [`draw-machine.png`](draw-machine.png)         | Lotto 5/35 3D Draw Simulator after completing a full 5-main + 1-special-ball local physics draw                  | `1440 × 900`  |
| [`mobile-dashboard.png`](mobile-dashboard.png) | Mega 6/45 Overview mobile layout with bottom navigation bar                                                      | `390 × 844`   |

## Guidelines

- Keep existing filenames when refreshing screenshots so relative links in [README.md](../../../README.md) remain valid.
- Wait for charts, frequency data, and the WebGL/Rapier 3D canvas to settle before capturing.
- Never include credentials, admin dashboards, or sensitive environment details.

## Historical Design Snapshots (03/11/2026)

- [`machine-preview-static.png`](machine-preview-static.png): Early `/generator/preview` design reference (55 teal spheres, static framing prior to Rapier physics integration and Y-rotor redesign).
- [`machine-integrated.png`](machine-integrated.png): Previous Rapier 3D acrylic-frame drum build captured at `1365 × 900` before the spherical Y-blade rotor and flat-canvas redesign.
