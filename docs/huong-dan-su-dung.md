# Hướng dẫn sử dụng TaskFlow

TaskFlow giúp tạo công việc, giao việc, theo dõi tiến độ và trao đổi với nhóm. Có hai vai trò:

- **Nhân viên:** tạo công việc, xem công việc mình tạo hoặc được giao, cập nhật phần việc của mình.
- **Quản trị viên:** có quyền của nhân viên, đồng thời quản lý thành viên và phân công công việc.

## Chạy TaskFlow trên máy tính

### Cần chuẩn bị

- Node.js 22 trở lên.
- PostgreSQL đang chạy.

### 1. Tạo database và cấu hình

Tạo một database PostgreSQL, ví dụ `taskflow`. Tại thư mục gốc dự án, chạy:

```powershell
Copy-Item backend\.env.example backend\.env
```

Mở `backend\.env` và điền thông tin database (`DB_USER`, `DB_PASSWORD`, `DB_NAME`) cùng một giá trị bí mật cho `JWT_SECRET`.

### 2. Chạy API

Mở PowerShell tại thư mục gốc dự án:

```powershell
cd backend
npm ci
npm run migrate
npm run dev
```

Giữ cửa sổ này mở. Mở <http://localhost:3000/api/health> để kiểm tra API.

### 3. Chạy website

Mở PowerShell thứ hai tại thư mục gốc dự án:

```powershell
cd web
npm ci
npm run dev
```

Mở địa chỉ website được in trong terminal (thường là <http://localhost:5173>).

### 4. Tạo tài khoản và đăng nhập

- Nhân viên có thể chọn **Register** hoặc **Create account** trên website.
- Tạo tài khoản quản trị viên một lần bằng PowerShell tại thư mục gốc dự án:

  ```powershell
  cd backend
  $env:ADMIN_EMAIL = "admin@example.com"
  $env:ADMIN_PASSWORD = "mat-khau-cua-ban"
  $env:ADMIN_NAME = "Quan tri vien"
  npm run seed:admin
  Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_NAME
  ```

- Dùng điện thoại: cài Expo Go, tạo `mobile\.env` từ `mobile\.env.example`, rồi thay địa chỉ API bằng IP máy tính. Trong thư mục `mobile`, chạy `npm ci` một lần và `npm start`. Điện thoại cần cùng mạng với máy tính; không dùng `localhost` làm địa chỉ API trên điện thoại.

## Thao tác thường dùng

1. **Tạo việc:** mở **Dashboard**, nhập tiêu đề và thông tin công việc, rồi chọn **Create task**.
2. **Tìm việc:** mở **Tasks**. Tìm theo tên hoặc dùng bộ lọc trạng thái, mức ưu tiên và hạn hoàn thành.
3. **Giao việc:** quản trị viên mở chi tiết công việc, chọn thành viên trong **Assignments**, rồi nhấn **Assign selected**.
4. **Cập nhật tiến độ:** trong **Assignments**, nhấn **Start**, **Complete** hoặc **Reopen** để đổi trạng thái.
5. **Trao đổi:** mở chi tiết công việc, viết trong **Comments**, rồi nhấn **Add comment**.
6. **Quản lý nhóm:** quản trị viên mở **Team** để tìm, vô hiệu hóa hoặc kích hoạt lại tài khoản thành viên.

Người dùng chỉ thấy công việc mình tạo hoặc được giao. Nếu không thấy công việc, hãy kiểm tra bộ lọc và quyền tài khoản.

## Tài liệu và báo cáo

Có thể đính kèm tài liệu khi tạo công việc, hoặc gửi báo cáo khi hoàn thành. Tính năng này cần cấu hình Supabase Storage riêng tư; xem [hướng dẫn deploy Render](./deploy-render.md). Mỗi file tối đa 10 MB.

## Nếu gặp sự cố

- **Website không kết nối được:** kiểm tra API tại <http://localhost:3000/api/health>.
- **API không chạy:** kiểm tra PostgreSQL, thông tin trong `backend\.env` và đã chạy `npm run migrate`.
- **Điện thoại không kết nối được:** dùng IP LAN của máy tính và đảm bảo hai thiết bị cùng mạng.
- **Không thấy công việc:** xóa bộ lọc; nhân viên chỉ thấy công việc mình tạo hoặc được giao.

Không chia sẻ mật khẩu, token hoặc nội dung file `.env`.

## Xem thêm

- [Hướng dẫn deploy Render](./deploy-render.md)
- [Triển khai và kiểm thử](./testing-deployment.md)
- [Tài liệu API](./api.md)
