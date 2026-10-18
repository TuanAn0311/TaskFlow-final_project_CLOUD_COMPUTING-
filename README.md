# TaskFlow

TaskFlow là hệ thống quản lý công việc gồm backend REST API, ứng dụng web và ứng dụng di động. Backend dùng Node.js/Express và PostgreSQL; web dùng React/Vite; mobile dùng Expo/React Native.

> Người mới sử dụng có thể xem [Hướng dẫn sử dụng TaskFlow bằng tiếng Việt](docs/huong-dan-su-dung.md) để cài đặt, chạy ứng dụng và thực hiện các thao tác thường gặp.

## Chức năng hiện có

- Đăng ký tài khoản nhân viên, đăng nhập và lấy thông tin tài khoản hiện tại. Mật khẩu được băm bằng bcrypt; API dùng JWT để xác thực.
- Phân quyền `admin` và `employee`. Nhân viên chỉ xem task do mình tạo hoặc đang được giao; quyền được kiểm tra ở backend.
- Tạo, xem, tìm kiếm/lọc, chỉnh sửa và xóa mềm task; task có mức ưu tiên, hạn hoàn thành và trạng thái tổng hợp từ các phân công.
- Giao task cho nhiều thành viên, thu hồi phân công, chuyển trạng thái công việc và lưu lịch sử trạng thái.
- Đính kèm tài liệu dùng chung cho task; lưu ghi chú và file báo cáo riêng theo từng người/lần hoàn thành, xem hoặc tải qua liên kết có thời hạn.
- Xem, thêm, sửa và xóa mềm bình luận theo quyền truy cập task.
- Quản trị viên xem/tìm kiếm/lọc danh sách thành viên và kích hoạt hoặc vô hiệu hóa tài khoản; không thể tự vô hiệu hóa hoặc vô hiệu hóa quản trị viên đang hoạt động cuối cùng.
- Web có dashboard, danh sách/phân trang task và thành viên, bộ lọc task/thành viên và giao diện chi tiết task.
- Mobile hỗ trợ đăng nhập/đăng ký, danh sách và lọc task, tạo task, xem/sửa/xóa task, phân công, trạng thái, bình luận và lịch sử. Phiên đăng nhập được lưu bằng Expo SecureStore.

## Cấu trúc thư mục

```text
cloud-project/
├── backend/
│   ├── src/
│   │   ├── routes/        Khai báo endpoint, validation và gắn middleware
│   │   ├── controllers/   Nhận request, gọi database layer, trả response
│   │   ├── database/      Kết nối PostgreSQL và repository/truy vấn dữ liệu
│   │   ├── middlewares/   Xác thực JWT, phân quyền, validation, xử lý lỗi
│   │   ├── services/      Tích hợp dịch vụ lưu file dùng chung
│   │   └── utils/         Lỗi dùng chung, logger và định dạng response
│   ├── __tests__/         Integration tests cho API
│   ├── .env.example       Mẫu cấu hình backend; không chứa cấu hình bí mật thật
│   └── server.js          Điểm khởi chạy backend
├── database/
│   ├── migrations/        Các migration SQL theo thứ tự phiên bản
│   ├── seeds/             Tạo admin ban đầu và dữ liệu phát triển
│   └── migrate.js         Chạy migration và ghi nhận migration đã áp dụng
├── web/
│   ├── src/
│   │   ├── models/        Gọi API
│   │   ├── controllers/   Quản lý state và thao tác giao diện
│   │   ├── features/      Các màn hình auth, task, team, profile, workspace
│   │   └── components/    Thành phần giao diện dùng lại
│   └── .env.example       Cấu hình URL backend cho web
├── mobile/
│   ├── App.js             Màn hình và luồng chính của ứng dụng
│   ├── index.js           Điểm đăng ký ứng dụng Expo
│   └── .env.example       Mẫu URL backend cho thiết bị thật
├── docs/
│   ├── api.md             Danh sách endpoint và quy ước API
│   ├── architecture.md    Kiến trúc và mô hình dữ liệu
│   ├── testing-deployment.md  Cách kiểm thử và triển khai
│   ├── huong-dan-su-dung.md  Hướng dẫn cài đặt và sử dụng bằng tiếng Việt
│   ├── testing.md            Kết quả kiểm thử audit và giới hạn đã xác minh
│   ├── audit-report.md       Báo cáo rà soát dự án
│   └── bug-fix-log.md       Nhật ký lỗi đã sửa và cách xác minh
└── render.yaml            Cấu hình Blueprint cho Render
```

Backend đi theo Layered Architecture: `routes → controllers → database`. Các migration tạo schema và index PostgreSQL; backend truy cập database qua pool kết nối dùng chung.

## Luồng dữ liệu

### Request từ web/mobile tới PostgreSQL

```text
Người dùng thao tác trên Web hoặc Mobile
                    │
                    ▼
Client gửi HTTP request tới /api
(đính kèm JWT trong header Authorization với route cần đăng nhập)
                    │
                    ▼
routes: chọn endpoint, kiểm tra dữ liệu và áp dụng middleware
                    │
                    ▼
controllers: đọc request, gọi repository, định dạng response
                    │
                    ▼
database repository: truy vấn PostgreSQL
(các thao tác nhiều bước dùng transaction)
                    │
                    ▼
PostgreSQL trả kết quả → controller trả JSON → client cập nhật giao diện
```

### Luồng khởi động backend

```text
backend/.env → nạp cấu hình → kiểm tra JWT_SECRET và kết nối PostgreSQL
             → khởi chạy Express → nhận request tại /api
```

Backend đọc cấu hình từ `backend/.env`. Có thể dùng `DATABASE_URL` hoặc các biến `DB_*`. Không đưa giá trị bí mật vào mã nguồn hoặc chia sẻ công khai. Nếu đã có `backend/.env`, giữ nguyên file đó và kiểm tra các biến cần thiết; chỉ tạo từ `.env.example` khi chưa có.

## Cách chạy project trên Windows

### Yêu cầu

- Node.js 22.12 trở lên.
- PostgreSQL 16 hoặc phiên bản tương thích, đang chạy và có database mà cấu hình backend được phép truy cập.
- Với mobile: Expo Go hoặc Android/iOS simulator. Thiết bị thật phải truy cập được địa chỉ mạng của máy chạy API.

### 1. Cài dependencies và khởi tạo database

Mở PowerShell tại thư mục gốc dự án:

```powershell
cd backend
npm ci
npm run migrate
```

Lệnh migration sử dụng cấu hình backend hiện có. Nếu cần tạo cấu hình mới, sao chép `backend/.env.example` thành `backend/.env`, điền thông tin kết nối PostgreSQL và một `JWT_SECRET` ngẫu nhiên đủ mạnh. Không chép đè `.env` đang sử dụng.

### 2. Tạo tài khoản quản trị viên (nếu database chưa có)

Trong PowerShell, tại `backend/`:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "mat-khau-rieng-dai-va-ngau-nhien"
$env:ADMIN_NAME = "System Administrator"
npm run seed:admin
```

Đăng ký từ ứng dụng chỉ tạo tài khoản nhân viên. Seed admin không thay đổi tài khoản nếu email đã tồn tại.

### 3. Chạy backend

Trong terminal thứ nhất, tại `backend/`:

```powershell
npm run dev
```

Backend mặc định chạy tại `http://localhost:3000`. Có thể kiểm tra API và kết nối PostgreSQL tại `http://localhost:3000/api/health`.

### 4. Chạy web

Mở terminal thứ hai tại thư mục gốc:

```powershell
cd web
npm ci
Copy-Item .env.example .env
npm run dev
```

Web mặc định chạy tại `http://localhost:5173` và dùng `VITE_API_URL` trong `web/.env` để tìm backend.

### 5. Chạy ứng dụng mobile

Mở terminal thứ ba tại thư mục gốc:

```powershell
cd mobile
npm ci
npm start
```

- Android Emulator dùng mặc định `http://10.0.2.2:3000`.
- iOS Simulator dùng mặc định `http://localhost:3000`.
- Điện thoại thật: đặt `EXPO_PUBLIC_API_URL` trong `mobile/.env` thành địa chỉ LAN của máy chạy backend, ví dụ `http://192.168.1.10:3000`. Không dùng `localhost` trên điện thoại để trỏ tới máy tính.
- Bản production phải được build với `EXPO_PUBLIC_API_URL` trỏ tới API có thể truy cập (dùng HTTPS khi triển khai); nếu thiếu cấu hình, ứng dụng không tự chuyển sang `localhost`.

### Lệnh kiểm tra

Chạy tại thư mục tương ứng:

```powershell
# backend/
npm test -- --runInBand
npm run migrate

# web/
npm run build

# mobile/
npx expo export --platform android
```

Integration tests backend sử dụng PostgreSQL được cấu hình và tạo dữ liệu kiểm thử tạm thời; nên dùng database dành riêng cho kiểm thử.
