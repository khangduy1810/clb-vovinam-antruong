# Đăng nhập tập trung cho CLB Vovinam An Trường

Mã trang đã tích hợp Firebase Authentication và dữ liệu theo lớp/tài khoản. Chế độ cũ tiếp tục hoạt động cho tới khi quản trị viên hoàn tất chuyển dữ liệu một lần. Chỉ thêm cấu hình Firebase hoặc bật Email/Password chưa kích hoạt chế độ mới.

## Kích hoạt một lần trên máy có dữ liệu đầy đủ

1. Xuất JSON độc lập trên các máy có thay đổi cần giữ; đối chiếu và chọn bản đầy đủ trước khi chuyển. Đăng nhập Super Admin trên máy này.
2. Vào **Cài đặt → Chuyển sang đăng nhập tập trung → Thiết lập quản trị viên Firebase**.
3. Nhập email và mật khẩu quản trị viên Firebase (tối thiểu 8 ký tự). Nếu đã tạo email đó trong Authentication → Users, chọn ô tài khoản đã có. Mật khẩu được gửi trực tiếp đến Firebase Authentication, không ghi vào mã nguồn hay dữ liệu đồng bộ.
4. Bấm **Tải Rules dành cho quản trị viên này**. Tệp chứa đúng Firebase UID vừa được xác thực. Trong Firebase Console của dự án `clb-vovinam-antruong`, vào Realtime Database → Rules, thay toàn bộ nội dung bằng tệp này và Publish. Đây là bước quản trị dự án, không thể thực hiện bằng Firebase Web API key. Rules mới khóa database cũ khỏi truy cập công khai; dành khoảng thời gian này cho chuyển đổi.
5. Bấm **Tải JSON dữ liệu máy này**, kiểm tra số lượng võ sinh/lớp/buổi điểm danh, tích ô xác nhận, rồi **Kiểm tra Rules và chuyển dữ liệu**. Trang kiểm tra truy cập ẩn danh đã bị chặn và ghi dữ liệu ban đầu bằng một giao dịch có kiểm tra phiên bản. Không ghi đè hệ thống trung tâm đã tồn tại.
6. Trang tự tải lại. Admin đăng nhập bằng email vừa thiết lập. Nguồn dữ liệu mới là `central_v2`. Bản cũ vẫn được giữ trên Firebase dưới namespace cũ nhưng bị Rules chặn truy cập từ website; JSON độc lập vẫn do quản trị viên giữ.

Trong lúc mở quy trình thiết lập, đồng bộ kiểu cũ được tạm dừng trên máy đó. Tải lại trang để hủy nếu chưa kích hoạt hệ thống mới.

## Cấp tài khoản cho HLV, thủ quỹ

Trong **Tài khoản / Phân quyền**, mở từng tài khoản cũ chưa liên kết, đặt mật khẩu khởi tạo mới ít nhất 8 ký tự, kiểm tra lớp và quyền rồi lưu. Hoặc tạo tài khoản mới tại đây. Mật khẩu cũ dạng hash không được tự nhập sang Firebase Authentication.

Trang tạo tài khoản Authentication và hồ sơ quyền tương ứng. Người dùng nhận **link web + tên đăng nhập + mật khẩu**. Với tài khoản tạo từ trang, tên đăng nhập được ánh xạ tới email nội bộ `ten_dang_nhap@accounts.clb-vovinam-antruong.invalid`; đây là định danh đăng nhập, không phải hộp thư. Quản trị viên gốc dùng email đã đăng ký. Tên đăng nhập đã liên kết không đổi tại biểu mẫu phân quyền.

Tài khoản được tạo trong Firebase Console nhưng chưa có hồ sơ quyền không được vào dữ liệu CLB. Không tạo các tài khoản nhân viên riêng trong Console rồi kỳ vọng trang tự nhận quyền; dùng biểu mẫu tài khoản của trang.

Các thiết bị tải lại trang, đăng nhập tài khoản được cấp; không nhập URL database, không ghép máy, không tải danh sách mật khẩu từ máy khác. Tài khoản thường chỉ nhận các trường dữ liệu và lớp mà Rules cho phép. Đăng xuất dọn dữ liệu đang hiển thị; bộ nhớ ngoại tuyến và bản dự phòng tách theo Firebase UID.

## Quản lý mật khẩu và khóa tài khoản

- Người dùng đổi mật khẩu của mình trong trang; thao tác xác thực lại với Firebase.
- Với tên đăng nhập nội bộ, quản trị viên đặt lại mật khẩu tại Firebase Authentication → Users. Hồ sơ dùng email thật có thể nhận yêu cầu đặt lại mật khẩu qua email.
- Khóa hoặc xóa hồ sơ quyền trên trang chặn quyền truy cập dữ liệu, kể cả khi danh tính vẫn tồn tại trong Firebase Authentication.
- Quyền tài khoản được lấy từ máy chủ; không hợp nhất quyền từ các máy cũ hoặc từ JSON nhập vào.

## Phạm vi kỹ thuật

- `central.js`: Firebase Auth REST, làm mới phiên, dữ liệu theo lớp/trường/bản ghi, ETag, khôi phục kết nối và bộ nhớ đệm riêng theo tài khoản. Không cần Cloud Functions hoặc máy chủ Node để chạy trang.
- `central-rules.js`: sinh Rules đóng mặc định, gắn UID quản trị viên gốc, kiểm tra quyền đọc/ghi ở Firebase. Không bật `.read: true` hoặc `.write: true` ở gốc.
- `index.html`: dùng chế độ mới khi `central_v2/meta/enabled` được bật sau chuyển đổi; chế độ cũ không được dùng làm đường dự phòng sau đăng nhập trung tâm.
- Bản ghi thu/điểm danh có kiểm tra phiên bản riêng. Thay đổi nhiều bản ghi được xác nhận lần lượt và gửi lại phần chưa hoàn tất. Đóng trang hoặc mất mạng giữa chừng có thể để một phần thao tác chờ gửi, cần chờ trạng thái xác nhận trước khi thao tác trên máy khác.
- Chuyển lớp, xóa lớp có thể liên quan nhiều nhóm dữ liệu; nên dùng tài khoản quản trị viên toàn quyền và kiểm tra trạng thái gửi hoàn tất.
- Mã được kiểm tra bằng dữ liệu thử; việc kích hoạt thật cần quản trị viên Publish Rules và xác nhận nguồn dữ liệu trên máy của mình. Không tự triển khai Rules vào dự án thật bằng API key Web.

## Kiểm thử cho người bảo trì mã

Chạy từ thư mục gốc của repo:

```sh
node tests/central.cjs
npx firebase-tools emulators:exec --only database,auth --project demo-vovinam --config tests/firebase.json 'node tests/central-emulator.cjs'
```

Firebase CLI hiện tại cần Node và Java tương thích (Java 21 trở lên). Bài kiểm thử emulator chỉ dùng localhost, dự án demo, tài khoản thử và Rules sinh động; không ghi vào Firebase thật. Bộ kiểm thử giao diện dùng DOM giả lập; không thay thế kiểm tra trực tiếp trên điện thoại.
