# Deploy TaskFlow lên Render

Tài liệu này hướng dẫn đưa **API, PostgreSQL và website** lên Render bằng `render.yaml` ở thư mục gốc. Ứng dụng mobile không được deploy bằng Blueprint này.

## Trước khi bắt đầu

- Có tài khoản GitHub, Render và Supabase.
- Đã đẩy mã nguồn cần deploy lên GitHub.
- Không đưa file `.env`, mật khẩu, database URL hoặc secret lên GitHub.
- Xem giá, thời hạn lưu database và giới hạn hiện tại của Render. Gói miễn phí có thể không phù hợp để lưu dữ liệu lâu dài.

## 1. Tạo tài nguyên trên Render

1. Đăng nhập Render, chọn **New → Blueprint**.
2. Kết nối GitHub, chọn repository TaskFlow và nhánh cần deploy.
3. Render đọc `render.yaml`, hiển thị database `taskflow-db`, API `taskflow-api` và website `taskflow-web`. Kiểm tra khu vực và giá trước khi chọn **Apply**.
4. Khi được yêu cầu, nhập `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` như hướng dẫn ở bước 2. `JWT_SECRET` được Render tự tạo; API được tự nối với database.
5. Chờ các dịch vụ deploy xong. API tự chạy các migration trước khi khởi động.

Nếu URL API hoặc web của bạn khác URL khai báo trong `render.yaml`, sửa `VITE_API_URL` của website cho đúng URL API rồi push thay đổi để Render deploy lại. Blueprint tự đặt `WEB_ORIGIN` theo địa chỉ website.

## 2. Bật lưu tài liệu và báo cáo

1. Trong Supabase, tạo bucket tên `taskflow-files` và để ở chế độ **Private**.
2. Lấy **Project URL** và **service_role key** trong phần API/project settings của Supabase.
3. Trong Render, mở dịch vụ `taskflow-api` → **Environment** và đặt:
   - `SUPABASE_URL`: Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY`: service-role key.
   - `SUPABASE_STORAGE_BUCKET`: `taskflow-files`.
4. Lưu thay đổi để Render khởi động lại API.

Service-role key có quyền cao: chỉ lưu trong environment của API. Không đưa key vào GitHub, website, ứng dụng mobile hoặc tin nhắn. Nếu chưa cấu hình Supabase, các chức năng còn lại vẫn có thể dùng nhưng tải tài liệu/báo cáo sẽ không hoạt động.

## 3. Tạo tài khoản quản trị viên

Sau khi API deploy thành công, mở PowerShell tại thư mục `backend` trong bản mã nguồn đã deploy. Lệnh dưới đây kết nối tới database Render bằng External Database URL và xóa các giá trị tạm khỏi environment khi hoàn tất:

```powershell
$secureUrl = Read-Host "Render External Database URL" -AsSecureString
$urlPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
$securePassword = Read-Host "Mat khau admin (8-72 byte UTF-8)" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($urlPointer)
    $env:DB_SSL = "true"
    $env:ADMIN_EMAIL = Read-Host "Email admin"
    $env:ADMIN_NAME = Read-Host "Ten admin"
    $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    npm run seed:admin
}
finally {
    Remove-Item Env:DATABASE_URL, Env:DB_SSL, Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($urlPointer)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $secureUrl.Dispose()
    $securePassword.Dispose()
}
```

Lấy External Database URL trong trang database trên Render; không đưa URL này vào mã nguồn hoặc chia sẻ cho người khác. Seed không thay đổi tài khoản nếu email đã tồn tại.

## 4. Kiểm tra sau deploy

1. Mở `https://<URL-API>/api/health`. API và database phải báo khỏe mạnh.
2. Mở website, đăng nhập tài khoản admin và đăng ký một tài khoản nhân viên thử.
3. Tạo công việc, giao cho nhân viên và thử cập nhật trạng thái.
4. Nếu đã cấu hình Supabase, thử tải lên và mở một tài liệu hoặc báo cáo.

Nếu API không khỏe, xem log của `taskflow-api` trên Render. Nếu web không gọi được API, kiểm tra `VITE_API_URL` và `WEB_ORIGIN`.

## Cập nhật phiên bản

Push commit mới lên nhánh Render theo dõi để deploy. Blueprint chạy migration mỗi lần khởi động API; migration đã áp dụng sẽ được bỏ qua. Migration mới cần tương thích với phiên bản API đang chạy. Không sửa hoặc xóa migration đã áp dụng; tạo migration mới cho thay đổi tiếp theo.

## Deploy ứng dụng mobile

Mobile cần build và phát hành riêng bằng Expo/EAS. Khi build, đặt `EXPO_PUBLIC_API_URL` thành HTTPS URL của API Render. Không đưa database URL, JWT secret, mật khẩu admin hoặc Supabase service-role key vào ứng dụng.
