# 0010 — Chia sẻ frontend qua Wi-Fi nội bộ

- Status: accepted
- Date: 2026-10-25
- Scope: Compose frontend và vận hành Windows local
- Sources: yêu cầu người dùng chia sẻ website cho thiết bị cùng Wi-Fi;
  [Docker port publishing](https://docs.docker.com/get-started/docker-concepts/running-containers/publishing-ports/),
  [Compose merge](https://docs.docker.com/reference/compose-file/merge/).

## Context

Compose mặc định publish cả ba service trên loopback. Thiết bị khác không
truy cập được website qua IP Wi-Fi. Nginx đã proxy API cùng origin nên chỉ
cần thêm một binding frontend. Không thêm auth/TLS/public ingress trong task.

## Options

- Bind frontend `0.0.0.0`: đơn giản nhưng mở cả các interface khác ngoài Wi-Fi.
- Thêm binding IP Wi-Fi cụ thể bằng overlay opt-in: giữ localhost hoạt động,
  mặc định dự án vẫn loopback, cần cập nhật IP nếu DHCP thay đổi.

## Decision

Chọn overlay `compose.lan.yaml`; lấy IP từ `FRONTEND_LAN_IP`, port từ
`FRONTEND_PORT`. Compose merge giữ mapping localhost và thêm mapping LAN.
Windows local bật bền vững bằng `COMPOSE_FILE=compose.yaml;compose.lan.yaml`
trong `.env` không commit. Không dùng wildcard binding, không đổi backend,
PostgreSQL, profile Wi-Fi hoặc cấu hình router.

Máy hiện tại có Wi-Fi `192.168.1.2/24`, profile Public. Effective firewall
đã có rule TCP Allow cho Docker Desktop Backend trên Public; không cần sửa
firewall/quyền Administrator. Máy khác có thể cần rule riêng giới hạn cổng,
IP local và subnet Wi-Fi; không tắt firewall.

## Consequences

Thiết bị có kết nối được vào LAN có thể dùng đầy đủ UI, gồm manual sync vì
ứng dụng chưa có phân quyền. Chỉ dùng mạng tin cậy; không port-forward ra
Internet. Máy chủ/Docker phải chạy; DHCP hoặc AP/client isolation có thể ảnh
hưởng URL/kết nối. HTTP không có TLS; clipboard API có thể không sẵn có khi
trình duyệt dùng địa chỉ LAN HTTP, UI đã có thông báo copy thủ công.

## Validation

Kiểm cấu hình merge/base và ports: frontend loopback + Wi-Fi, backend/DB chỉ
loopback; recreate riêng frontend; HTTP/deep-link/API qua IP LAN, browser
mobile/desktop và health checks. Kết nối từ thiết bị thứ hai phải được xác
nhận riêng, không suy từ kiểm tra LAN URL trên máy chủ. Bằng chứng ở `task.md`.

Kiểm chứng thực tế 25/10/2026: Compose/base/thiếu-IP checks đạt; HTTP LAN và
localhost 200, API đủ ba game; frontend hai binding cụ thể, backend/DB chỉ
loopback. Bốn browser flow desktop/mobile và một phiên Lotto mobile vật lý
qua LAN URL đạt. Người dùng xác nhận thiết bị khác truy cập được bằng HTTP;
host quan sát kết nối TCP từ một client LAN khác. Không cấu hình HTTPS nên
phải dùng đầy đủ tiền tố `http://`. Không thay firewall, router hoặc profile.
