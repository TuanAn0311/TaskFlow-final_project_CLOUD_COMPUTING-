# Hướng dẫn sử dụng TaskFlow

Tài liệu này hướng dẫn từ lúc chuẩn bị máy, khởi chạy TaskFlow trên máy cá nhân, đưa API/web lên Render, cấu hình lưu file đến khi đăng nhập và sử dụng công việc. TaskFlow có giao diện web và ứng dụng di động; cả hai cùng sử dụng một API và cơ sở dữ liệu.

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

### Bật chức năng tải tài liệu và báo cáo

TaskFlow lưu file trong một **bucket riêng tư của Supabase Storage**; không cần mở bucket công khai. Để bật chức năng này:

1. Tạo project Supabase của riêng bạn và tạo bucket tên `taskflow-files` trong **Storage**. Để bucket ở chế độ **Private**.
2. Trong phần cấu hình/API của Supabase, lấy **Project URL** và **service_role key**. Chỉ backend được giữ service role key; tuyệt đối không đưa key này vào web/mobile, Git hoặc tài liệu công khai.
3. Điền ba giá trị sau vào `backend/.env`:

   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-private-service-role-key
   SUPABASE_STORAGE_BUCKET=taskflow-files
   ```

4. Chạy migration ở bước tiếp theo rồi khởi động lại backend. Khi deploy theo Render Blueprint, nhập `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` vào phần biến môi trường của API; bucket `taskflow-files` phải được tạo trước. Backend gọi Supabase Storage REST API nên không cần cài thêm SDK Supabase.

Gói miễn phí của nhà cung cấp có giới hạn và điều kiện riêng, có thể thay đổi; kiểm tra quota, giới hạn kích thước và chính sách lưu trữ hiện hành trong Supabase trước khi dùng cho dữ liệu quan trọng. File hỗ trợ: PDF, Word, Excel, PowerPoint, TXT, PNG và JPG; tối đa 10 MB/file, tối đa 5 file mỗi lần tải lên. File được mở bằng đường dẫn có chữ ký, hết hạn sau 2 phút.

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

Khi tạo công việc, có thể chọn tài liệu đính kèm trước khi nhấn **Create task**. Sau đó người có quyền xem công việc có thể mở tài liệu trong tab mới hoặc tải xuống. Nếu tải file thất bại, công việc vẫn được tạo; mở chi tiết công việc để thử tải lại.

PDF, ảnh và TXT thường được trình duyệt mở trực tiếp; khả năng xem trước các định dạng Office tùy trình duyệt/thiết bị. Nếu trình duyệt không xem trước được, dùng **Download** để mở bằng ứng dụng phù hợp.

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

Khi nhấn **Complete**, có thể nhập ghi chú và chọn file báo cáo (cả hai đều không bắt buộc). Báo cáo được lưu riêng theo từng người và từng lần hoàn thành. Nếu trạng thái đã chuyển sang **Completed** nhưng file báo cáo tải lên thất bại, mở mục **Completion reports** và chọn **Add report files** để thử lại.

PDF, ảnh và TXT thường xem trực tiếp được trong tab mới; các định dạng Office phụ thuộc khả năng của trình duyệt/thiết bị và có thể cần tải xuống để mở.

Trạng thái hiển thị trên danh sách công việc là trạng thái tổng hợp từ các phân công; mỗi thành viên có trạng thái riêng trong phần **Assignments**. Các thay đổi được ghi nhận trong **Status history**.

### Bình luận và lịch sử

Trong chi tiết công việc, nhập nội dung vào **Comments** rồi nhấn **Add comment** để trao đổi. Tác giả bình luận hoặc quản trị viên có thể sửa/xóa bình luận. Lịch sử trạng thái ở **Status history** cho biết ai thay đổi trạng thái và thời điểm thay đổi.

### Sửa hoặc xóa công việc

- Người tạo công việc hoặc quản trị viên có thể sửa tiêu đề, mô tả, mức ưu tiên và hạn hoàn thành, sau đó nhấn **Save changes**.
- Chỉ quản trị viên thấy thao tác **Delete task**. Đây là xóa mềm: công việc bị ẩn khỏi thao tác thông thường, không phải cách khôi phục dữ liệu.

### Quản lý thành viên (quản trị viên)

Mở **Team** để tìm thành viên theo tên/email hoặc lọc tài khoản đang hoạt động/đã vô hiệu hóa. Nhấn **Deactivate** để vô hiệu hóa, hoặc **Reactivate** để kích hoạt lại. Quản trị viên không thể tự vô hiệu hóa mình hoặc vô hiệu hóa quản trị viên đang hoạt động cuối cùng.

## 6. Đưa TaskFlow lên Render

Phần này triển khai **API, PostgreSQL và web** bằng Blueprint có sẵn trong `render.yaml`. Cần có tài khoản GitHub, Render và Supabase. Tên nút trong giao diện nhà cung cấp có thể thay đổi theo thời gian.

### Trước khi bắt đầu

- Hoàn tất các thay đổi cần deploy và kiểm tra chúng trong Git. Nếu repository có thư mục `mobile/` với Git riêng, lưu ý các thay đổi mobile cần được push riêng; Render Blueprint hiện chỉ triển khai API và web.
- Không đưa `backend/.env`, mật khẩu, JWT secret, database URL hoặc Supabase service-role key lên GitHub. Từ thư mục gốc, kiểm tra `git status --short`; xác nhận `backend/.env` không xuất hiện như file mới hoặc file được stage. Nếu file đó đã từng được commit, `.gitignore` không đủ để xóa nó khỏi lịch sử—hãy thay các key bị lộ và xử lý lịch sử repo trước khi public.
- Có thể kiểm tra trước build web (thay URL ví dụ bằng URL API Render sau khi được tạo):

  ```powershell
  cd web
  npm ci
  $env:VITE_API_URL = "https://api.example.com"
  npm run build
  Remove-Item Env:VITE_API_URL
  cd ..
  ```

### Bước 1: Push mã nguồn lên GitHub

1. Nếu đã có repository GitHub, push các file dự án đã kiểm tra lên nhánh sẽ deploy. Nếu chưa có, tạo repository mới trên GitHub, không thêm file `.env` vào đó, rồi kết nối thư mục gốc với repository theo hướng dẫn GitHub.
2. Tại PowerShell ở thư mục gốc, kiểm tra nhánh và các file đang thay đổi:

   ```powershell
   git status --short
   git branch --show-current
   git remote -v
   git check-ignore backend\.env
   ```

   `git check-ignore` cần báo rằng `backend/.env` bị ignore. Nếu `git remote -v` không hiện repository GitHub, trước tiên kết nối repo với GitHub theo hướng dẫn GitHub; không tự thay remote nếu repository đã được thiết lập.

3. Stage các thay đổi triển khai API/web, migration và tài liệu. Ví dụ nếu các thay đổi trong những thư mục này đều thuộc phiên bản bạn muốn đưa lên:

   ```powershell
   git add README.md render.yaml backend database docs web
   git status --short
   git diff --cached --name-only
   ```

   Xem danh sách file đã stage. Nếu thấy `backend/.env`, mật khẩu, file build hoặc thay đổi không định deploy, **dừng lại** và bỏ file đó khỏi danh sách stage trước khi tiếp tục. Không stage thư mục `mobile` ở repo gốc nếu Git báo đó là repository nhúng/submodule. Nếu có thay đổi riêng không liên quan, stage từng file cần thiết thay vì cả thư mục.

4. Nếu danh sách stage đã đúng, commit và push nhánh hiện tại:

   ```powershell
   git commit -m "Add task documents and completion reports"
   $branch = git branch --show-current
   git push -u origin $branch
   ```

   Nếu Git yêu cầu đăng nhập, hoàn tất xác thực GitHub theo hướng dẫn của Git. Không dán token hoặc mật khẩu vào lệnh/README.

5. Mở repo trên GitHub để xác nhận các file như `render.yaml`, `backend/package.json`, `database/migrations/010_create_task_documents_and_completion_reports.sql` và `web/package.json` đã có trên nhánh vừa push.
6. Nếu Git báo `mobile` là repository nhúng/submodule, không xóa hoặc thay đổi cấu hình đó chỉ để deploy web. Có thể triển khai backend/web trước; nếu cần bản mobile, push repository mobile riêng và build bằng Expo/EAS sau.

### Bước 2: Tạo tài nguyên Render từ Blueprint

1. Đăng nhập Render, chọn **New → Blueprint** (hoặc mục tạo Blueprint tương đương).
2. Kết nối GitHub nếu được yêu cầu, chọn repository TaskFlow và nhánh vừa push.
3. Render đọc `render.yaml` và hiển thị ba tài nguyên: PostgreSQL `taskflow-db`, API `taskflow-api` và static site `taskflow-web`. Kiểm tra tên, vùng và giá/giới hạn của các gói trước khi xác nhận **Apply**.
4. Chờ Render tạo các tài nguyên và chạy deploy. Blueprint tự nối database với API, tạo `JWT_SECRET`, và nối URL web/API cho các cấu hình cần thiết.
5. Blueprint đánh dấu `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` là giá trị nhập thủ công. Nếu Render yêu cầu nhập ngay khi tạo Blueprint, có thể nhập ở bước cấu hình environment sau đây; nếu chưa có Supabase, tạo tài nguyên trước nhưng chưa thể upload/xem file cho đến khi khai báo đủ hai biến này.

Render free có thể có giới hạn thời gian chạy, dung lượng, thời hạn database và backup; những chính sách này có thể thay đổi. Xem thông tin plan hiện tại trên Render trước khi dùng với dữ liệu thật.

### Bước 3: Tạo bucket Supabase riêng tư

1. Tạo project Supabase.
2. Trong **Storage**, tạo bucket tên chính xác `taskflow-files` và giữ ở chế độ **Private**. Không bật public access.
3. Mở phần API/project settings của Supabase, lấy **Project URL** và **service_role key**.
4. Trong Render, mở dịch vụ `taskflow-api` → **Environment**. Thêm/cập nhật:
   - `SUPABASE_URL`: Project URL, ví dụ `https://your-project.supabase.co`.
   - `SUPABASE_SERVICE_ROLE_KEY`: service-role key bí mật.
   - `SUPABASE_STORAGE_BUCKET`: `taskflow-files` (Blueprint đặt sẵn giá trị này).
5. Lưu thay đổi để Render khởi động lại/deploy API.

Service-role key có quyền cao: chỉ lưu trong biến môi trường của API trên Render. Không đưa key vào GitHub, `web/.env`, `mobile/.env`, mã trình duyệt, ứng dụng mobile, ảnh chụp màn hình hoặc tin nhắn. Kiểm tra quota và giới hạn của Supabase; không giả định gói miễn phí là không giới hạn hoặc phù hợp để lưu trữ lâu dài.

### Bước 4: Chạy migration trên database Render

Migration cần chạy vào **database PostgreSQL do Render tạo**, không phải database local. Chờ database Render ở trạng thái sẵn sàng, mở database trên Render, sao chép **External Database URL** và dùng từ máy tin cậy có kết nối Internet.

Tại PowerShell mở ở thư mục `backend/`, nhập URL ẩn bằng `Read-Host` rồi chạy:

```powershell
$secureUrl = Read-Host "Render External Database URL" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)

try {
    $env:DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $env:DB_SSL = "true"
    npm run migrate
}
finally {
    Remove-Item Env:DATABASE_URL, Env:DB_SSL -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $secureUrl.Dispose()
}
```

Kết quả mong đợi kết thúc bằng `Migration complete.` và áp dụng migration chưa có (trong đó có migration tạo `task_documents` và `task_completion_reports`). Nếu báo lỗi kết nối, kiểm tra External Database URL, database còn hoạt động và kết nối SSL; không thay URL local trong `backend/.env`. Nếu migration báo constraint hoặc SQL error, dừng deploy tính năng đó và xử lý lỗi trước khi dùng API.

**Mỗi khi thêm migration mới trong các lần cập nhật sau:** push đúng commit, chạy migration từ commit đó trên database Render trước, sau đó mới cho API deploy commit đó. Không chạy migration production bằng database local hoặc database test.

### Bước 5: Tạo tài khoản quản trị viên đầu tiên

Sau khi migration Render hoàn tất, vẫn ở `backend/`, dùng lại External Database URL (nhập ẩn như bước trước) và cung cấp email, tên admin cùng mật khẩu. Ví dụ chạy trong một khối để luôn xóa biến tạm:

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

Không gửi mật khẩu admin cho người khác. Nếu lệnh báo email đã tồn tại, seed không đổi tài khoản hiện có; hãy thử đăng nhập bằng tài khoản đó hoặc xác minh quyền quản trị với người quản lý database.

### Bước 6: Kiểm tra website và API sau deploy

1. Mở URL công khai của `taskflow-api` trong Render và thêm `/api/health`, ví dụ `https://taskflow-api.onrender.com/api/health`. Kết quả phải báo thành công và database khỏe mạnh.
2. Mở URL của `taskflow-web` trong Render, đăng nhập bằng tài khoản admin đã tạo.
3. Đăng ký một tài khoản nhân viên thử nghiệm bằng web, đăng nhập admin, vào **Team** để xác nhận thành viên hiển thị.
4. Tạo task kèm một file PDF nhỏ, giao task cho tài khoản nhân viên; đăng nhập nhân viên và xác nhận tài liệu mở/tải được.
5. Chuyển assignment từ **Todo** sang **In progress**, rồi **Completed** kèm ghi chú và một file báo cáo. Xác nhận báo cáo xuất hiện và có thể mở/tải.
6. Nếu web báo lỗi CORS hoặc không kết nối API, kiểm tra log dịch vụ API, `WEB_ORIGIN`, `VITE_API_URL` và địa chỉ public của hai dịch vụ. Blueprint tự liên kết hai host; sau khi sửa environment, redeploy/restart dịch vụ tương ứng.
7. Sau khi xác nhận, xóa/vô hiệu hóa tài khoản thử nghiệm và kiểm tra quota database/storage.

### Cập nhật phiên bản đã deploy

Khi push commit mới lên nhánh được Render theo dõi, Render có thể tự deploy. Nếu commit có migration mới, tạm dừng auto-deploy (nếu đang bật), chạy migration đúng commit trên PostgreSQL Render, rồi triển khai commit đó. Dùng migration tương thích ngược để tránh API mới chạy trước schema mới hoặc ngược lại. Không chỉnh sửa/xóa migration đã được áp dụng trên production để “chạy lại”; tạo migration mới cho thay đổi tiếp theo.

### Triển khai ứng dụng di động (tùy chọn)

Render Blueprint không build hoặc phát hành ứng dụng di động. Để export/build riêng, dùng HTTPS URL của API Render làm `EXPO_PUBLIC_API_URL` khi chạy Expo/EAS; không đặt database URL, JWT secret, admin password hay Supabase service-role key trong app. Việc export JS bundle chỉ kiểm tra bundling, chưa thay thế kiểm thử trên thiết bị thật.

## 7. Quyền truy cập cần nhớ

- Nhân viên chỉ xem công việc do mình tạo hoặc đang được giao; quyền truy cập được kiểm tra ở máy chủ.
- Nhân viên không thể tự tạo tài khoản quản trị viên và không thể giao công việc cho người khác.
- Tài khoản bị vô hiệu hóa không thể tiếp tục sử dụng hệ thống.
- Nếu không thấy nút hoặc trang nào đó, có thể thao tác đó chỉ dành cho quản trị viên hoặc tài khoản chưa có quyền xem công việc.

## 8. Khi gặp sự cố

| Hiện tượng                                  | Việc nên kiểm tra                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web/mobile không kết nối được API           | Đảm bảo backend đang chạy; thử mở <http://localhost:3000/api/health>. Kiểm tra URL API trong file cấu hình client.                                                        |
| API không khởi động                         | Kiểm tra PostgreSQL đang chạy, database và thông tin trong `backend/.env` đúng; xác nhận đã chạy `npm run migrate` và đã cấu hình `JWT_SECRET`.                           |
| Web báo lỗi kết nối/CORS                    | Kiểm tra `VITE_API_URL` trong `web/.env` và `WEB_ORIGIN` trong `backend/.env` khớp địa chỉ web đang mở. Khởi động lại backend sau khi đổi cấu hình.                       |
| Điện thoại không kết nối được               | Dùng IP LAN của máy tính, cho phép kết nối qua firewall nếu cần, và bảo đảm hai thiết bị cùng mạng. `localhost` trên điện thoại là chính điện thoại, không phải máy tính. |
| Đăng nhập được nhưng không thấy công việc   | Thử xóa bộ lọc; nhân viên chỉ thấy công việc do mình tạo hoặc được giao.                                                                                                  |
| Không tạo được tài khoản admin qua Register | Đây là thiết kế của hệ thống; admin phải được tạo bằng lệnh `npm run seed:admin`.                                                                                         |
| Không tải lên được tài liệu hoặc báo cáo | Kiểm tra ba biến `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, bucket riêng tư đã tồn tại, quota còn đủ và file đúng loại/kích thước. |
| Render API báo thiếu bảng `task_documents` hoặc `task_completion_reports` | Chạy `npm run migrate` tại `backend/` với `DATABASE_URL` là External Database URL của Render và `DB_SSL=true`; không dùng database local. |
| Render API không truy cập được database | Kiểm tra database Render còn hoạt động, URL external đúng, SSL bật và database/service ở cùng vùng nếu nhà cung cấp yêu cầu. |
| API trên Render báo thiếu cấu hình file storage | Kiểm tra `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` trên đúng API service; xác nhận bucket `taskflow-files` tồn tại và private. Lưu environment để Render restart API. |

Nếu vẫn chưa xử lý được, ghi lại thông báo lỗi, thao tác vừa thực hiện và môi trường đang dùng (web/mobile); không gửi mật khẩu, token, hoặc nội dung file `.env`.

## 9. Tài liệu tham khảo

- [README dự án](../README.md): kiến trúc, thiết lập và lệnh chạy/kiểm tra.
- [Tài liệu API](./api.md): danh sách endpoint dành cho tích hợp hoặc kiểm thử API.
- [Tài liệu kiểm thử và triển khai](./testing-deployment.md): kiểm thử backend, build ứng dụng và triển khai Render.
