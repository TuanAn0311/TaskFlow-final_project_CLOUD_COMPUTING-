# Hướng dẫn sử dụng TaskFlow

Tài liệu này hướng dẫn từ lúc chuẩn bị máy, khởi chạy TaskFlow đến khi tạo và theo dõi công việc. TaskFlow có giao diện web và ứng dụng di động; cả hai cùng sử dụng một API và cơ sở dữ liệu.

## 1. TaskFlow dùng để làm gì?

TaskFlow giúp nhóm tạo công việc, giao cho thành viên, theo dõi tiến độ, trao đổi qua bình luận và xem lại lịch sử thay đổi.

Có hai loại tài khoản:

- **Nhân viên (`employee`)**: đăng ký tài khoản, tạo công việc, xem công việc mình tạo hoặc được giao, cập nhật tiến độ trên phần việc được giao và trao đổi trong công việc mình có quyền xem.
- **Quản trị viên (`admin`)**: có các quyền của nhân viên, đồng thời xem và quản lý thành viên, giao hoặc thu hồi công việc, chỉnh sửa hoặc xóa công việc.

Đăng ký trên màn hình ứng dụng chỉ tạo tài khoản nhân viên. Tài khoản quản trị viên đầu tiên được tạo riêng theo hướng dẫn ở mục 3.

## 2. Chuẩn bị trước khi chạy

Trên máy tính Windows, cài đặt:

1. **Node.js 22.12 trở lên** (bản LTS được khuyến nghị).
2. **PostgreSQL 16** hoặc phiên bản tương thích.
3. Git (nếu bạn cần tải mã nguồn từ kho Git).

Nếu muốn chạy ứng dụng di động, cài **Expo Go** trên điện thoại hoặc chuẩn bị Android/iOS simulator. Điện thoại và máy tính chạy API cần kết nối được với nhau qua mạng.

## 3. Khởi chạy lần đầu trên máy tính

Các lệnh dưới đây dành cho **PowerShell**. Mở PowerShell tại thư mục dự án.

### Bước 1: Tạo và cấu hình cơ sở dữ liệu

Trong PostgreSQL, tạo một database mới, ví dụ `taskflow`. Có thể tạo bằng pgAdmin: kết nối tới PostgreSQL, nhấn chuột phải **Databases** → **Create** → **Database...**, nhập tên database rồi lưu.

Vào thư mục `backend`. Nếu chưa có `backend/.env`, tạo từ file mẫu:

```powershell
cd backend
Copy-Item .env.example .env
```

Mở `backend/.env` bằng trình soạn thảo và điền thông tin PostgreSQL. Ví dụ cấu hình phát triển trên máy cá nhân:

```dotenv
DB_USER=postgres
DB_PASSWORD=mat-khau-postgres-cua-ban
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskflow
JWT_SECRET=thay-bang-mot-chuoi-bi-mat-ngau-nhien
NODE_ENV=development
WEB_ORIGIN=http://localhost:5173
```

Giữ nguyên các thiết lập khác trong file mẫu nếu bạn chưa biết cần thay đổi gì. Không gửi file `.env` hoặc mật khẩu cho người khác, và không đưa các giá trị bí mật lên Git.

### Bước 2: Cài backend và tạo cấu trúc bảng

Vẫn ở thư mục `backend`, chạy:

```powershell
npm ci
npm run migrate
```

Migration tạo các bảng cần thiết trong database. Chỉ cần chạy lại `npm run migrate` khi có phiên bản dự án mới yêu cầu cập nhật database.

### Bước 3: Tạo quản trị viên đầu tiên

Nếu chưa có tài khoản admin, vẫn tại `backend/`, chạy các lệnh sau và thay email, mật khẩu bằng thông tin riêng của bạn:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "mat-khau-rieng-dai-va-kho-doan"
$env:ADMIN_NAME = "Quản trị viên"
npm run seed:admin
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_NAME
```

Mật khẩu phải dài từ 8 đến 72 byte UTF-8. Nếu email đã có trong database, lệnh không thay đổi tài khoản đó. Không dùng seed dữ liệu phát triển cho môi trường thật.

### Bước 4: Khởi chạy API

Tại thư mục `backend/`, chạy:

```powershell
npm run dev
```

Giữ terminal này mở. Mở trình duyệt tới <http://localhost:3000/api/health>. Nếu API kết nối được database, endpoint sẽ báo trạng thái thành công.

### Bước 5: Khởi chạy giao diện web

Mở **terminal PowerShell thứ hai** tại thư mục gốc dự án:

```powershell
cd web
npm ci
Copy-Item .env.example .env
npm run dev
```

Nếu `web/.env` đã tồn tại, không cần chép lại file mẫu. Mặc định web kết nối API tại `http://localhost:3000`. Mở địa chỉ Vite được in trong terminal, thường là <http://localhost:5173>.

### Bước 6: (Tùy chọn) Khởi chạy ứng dụng di động

Mở **terminal thứ ba** tại thư mục gốc dự án:

```powershell
cd mobile
npm ci
npm start
```

Expo sẽ hiển thị mã QR và các lựa chọn mở ứng dụng. Android Emulator và iOS Simulator có địa chỉ API mặc định phù hợp cho môi trường phát triển. Nếu chạy trên điện thoại thật, hãy tạo `mobile/.env` từ `mobile/.env.example` rồi thay `EXPO_PUBLIC_API_URL` bằng địa chỉ IP LAN của máy tính, ví dụ `http://192.168.1.10:3000`. Điện thoại và máy tính cần cùng mạng; không dùng `localhost` làm địa chỉ API trên điện thoại.

## 4. Đăng nhập và bắt đầu sử dụng

1. Mở web hoặc ứng dụng di động.
2. Đăng nhập bằng email và mật khẩu. Nếu chưa có tài khoản nhân viên, chọn **Register**/**Create account** để đăng ký. Tài khoản admin dùng email và mật khẩu đã tạo ở bước 3.
3. Sau khi đăng nhập, bạn sẽ thấy bảng điều khiển, các mục điều hướng như **Dashboard**, **Tasks**, **Team**, **Profile** và thông tin tổng quan trạng thái.
4. Chọn **Logout** khi muốn đăng xuất. Ứng dụng di động lưu phiên đăng nhập an toàn trên thiết bị; đăng xuất để kết thúc phiên trên thiết bị đó.

Giao diện hiện dùng một số nhãn tiếng Anh. Bảng dưới giải thích những từ thường gặp:

| Nhãn trên ứng dụng        | Nghĩa                         |
| ------------------------- | ----------------------------- |
| Dashboard                 | Bảng điều khiển               |
| Tasks / Task overview     | Danh sách công việc           |
| Team / Team members       | Thành viên                    |
| Profile                   | Hồ sơ tài khoản               |
| Priority                  | Mức độ ưu tiên                |
| Due date / Due            | Hạn hoàn thành                |
| Assignments               | Phân công                     |
| Comments                  | Bình luận                     |
| Status history            | Lịch sử trạng thái            |
| Start / Complete / Reopen | Bắt đầu / Hoàn thành / Mở lại |
| Unassigned                | Chưa được giao                |
| Todo                      | Cần thực hiện                 |
| In progress               | Đang thực hiện                |
| Completed                 | Đã hoàn thành                 |

## 5. Các thao tác công việc thường dùng

### Tạo công việc

1. Mở **Dashboard** (trên web) hoặc khu vực tạo công việc trong ứng dụng.
2. Nhập tiêu đề; mô tả là tùy chọn.
3. Chọn mức ưu tiên **Low** (thấp), **Medium** (trung bình) hoặc **High** (cao), và chọn hạn hoàn thành nếu cần.
4. Nhấn **Create task**.

Nhân viên tạo công việc sẽ tự động được giao vào công việc đó. Quản trị viên có thể giao công việc cho thành viên sau khi tạo.

### Tìm và lọc công việc

Mở **Tasks** để xem danh sách. Có thể tìm theo tiêu đề/mô tả, lọc theo trạng thái, mức ưu tiên và khoảng hạn hoàn thành. Quản trị viên có thêm bộ lọc người được giao và người tạo. Nếu có nhiều kết quả, dùng điều khiển phân trang ở cuối danh sách.

Nhấn tiêu đề công việc hoặc **Open details** để mở chi tiết. Nếu danh sách trống, hãy xóa bớt bộ lọc hoặc xác nhận tài khoản có quyền xem công việc đó.

### Giao công việc (quản trị viên)

1. Mở chi tiết công việc.
2. Trong **Assignments**, chọn một hoặc nhiều thành viên đang hoạt động. Trên máy tính có thể giữ `Ctrl` (Windows) hoặc `Command` (macOS) để chọn nhiều người.
3. Nhấn **Assign selected**.
4. Thành viên được giao sẽ thấy công việc và có thể cập nhật trạng thái của phần việc mình phụ trách.

Quản trị viên có thể nhấn **Remove** để thu hồi một phân công đang hoạt động. Phân công đã thu hồi vẫn được lưu trong lịch sử.

### Cập nhật tiến độ

Trong mục **Assignments**, người được giao hoặc quản trị viên có thể chuyển trạng thái theo thứ tự:

- **Todo** → nhấn **Start** để chuyển sang **In progress**.
- **In progress** → nhấn **Complete** để chuyển sang **Completed**.
- **Completed** → nhấn **Reopen** để quay lại **In progress** nếu cần làm tiếp.

Trạng thái hiển thị trên danh sách công việc là trạng thái tổng hợp từ các phân công; mỗi thành viên có trạng thái riêng trong phần **Assignments**. Các thay đổi được ghi nhận trong **Status history**.

### Bình luận và lịch sử

Trong chi tiết công việc, nhập nội dung vào **Comments** rồi nhấn **Add comment** để trao đổi. Tác giả bình luận hoặc quản trị viên có thể sửa/xóa bình luận. Lịch sử trạng thái ở **Status history** cho biết ai thay đổi trạng thái và thời điểm thay đổi.

### Sửa hoặc xóa công việc

- Người tạo công việc hoặc quản trị viên có thể sửa tiêu đề, mô tả, mức ưu tiên và hạn hoàn thành, sau đó nhấn **Save changes**.
- Chỉ quản trị viên thấy thao tác **Delete task**. Đây là xóa mềm: công việc bị ẩn khỏi thao tác thông thường, không phải cách khôi phục dữ liệu.

### Quản lý thành viên (quản trị viên)

Mở **Team** để tìm thành viên theo tên/email hoặc lọc tài khoản đang hoạt động/đã vô hiệu hóa. Nhấn **Deactivate** để vô hiệu hóa, hoặc **Reactivate** để kích hoạt lại. Quản trị viên không thể tự vô hiệu hóa mình hoặc vô hiệu hóa quản trị viên đang hoạt động cuối cùng.

## 6. Quyền truy cập cần nhớ

- Nhân viên chỉ xem công việc do mình tạo hoặc đang được giao; quyền truy cập được kiểm tra ở máy chủ.
- Nhân viên không thể tự tạo tài khoản quản trị viên và không thể giao công việc cho người khác.
- Tài khoản bị vô hiệu hóa không thể tiếp tục sử dụng hệ thống.
- Nếu không thấy nút hoặc trang nào đó, có thể thao tác đó chỉ dành cho quản trị viên hoặc tài khoản chưa có quyền xem công việc.

## 7. Khi gặp sự cố

| Hiện tượng                                  | Việc nên kiểm tra                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/mobile không kết nối được API           | Đảm bảo backend đang chạy; thử mở <http://localhost:3000/api/health>. Kiểm tra URL API trong file cấu hình client.                                                        |
| API không khởi động                         | Kiểm tra PostgreSQL đang chạy, database và thông tin trong `backend/.env` đúng; xác nhận đã chạy `npm run migrate` và đã cấu hình `JWT_SECRET`.                           |
| Web báo lỗi kết nối/CORS                    | Kiểm tra `VITE_API_URL` trong `web/.env` và `WEB_ORIGIN` trong `backend/.env` khớp địa chỉ web đang mở. Khởi động lại backend sau khi đổi cấu hình.                       |
| Điện thoại không kết nối được               | Dùng IP LAN của máy tính, cho phép kết nối qua firewall nếu cần, và bảo đảm hai thiết bị cùng mạng. `localhost` trên điện thoại là chính điện thoại, không phải máy tính. |
| Đăng nhập được nhưng không thấy công việc   | Thử xóa bộ lọc; nhân viên chỉ thấy công việc do mình tạo hoặc được giao.                                                                                                  |
| Không tạo được tài khoản admin qua Register | Đây là thiết kế của hệ thống; admin phải được tạo bằng lệnh `npm run seed:admin`.                                                                                         |

Nếu vẫn chưa xử lý được, ghi lại thông báo lỗi, thao tác vừa thực hiện và môi trường đang dùng (web/mobile); không gửi mật khẩu, token, hoặc nội dung file `.env`.

## 8. Tài liệu tham khảo

- [README dự án](../README.md): kiến trúc, thiết lập và lệnh chạy/kiểm tra.
- [Tài liệu API](./api.md): danh sách endpoint dành cho tích hợp hoặc kiểm thử API.
- [Tài liệu kiểm thử và triển khai](./testing-deployment.md): kiểm thử backend, build ứng dụng và triển khai Render.
