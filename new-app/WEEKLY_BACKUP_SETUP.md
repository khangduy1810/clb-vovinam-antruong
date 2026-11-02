# Kích hoạt sao lưu tuần chạy khi đóng trang

Mã đã có trong GitHub; lịch chỉ hoạt động sau khi triển khai Cloud Functions và Cloud Scheduler trên dự án Firebase. Không coi một commit GitHub hoặc trạng thái kết nối Firestore là bằng chứng lịch đã bật.

## Cơ chế

- `weeklyClubBackup`: Chủ nhật 02:00, múi giờ `Asia/Ho_Chi_Minh`.
- Một file riêng cho mỗi tuần, bắt đầu Chủ nhật. Retry không ghi đè bản đã hoàn tất, không sinh thêm bản trùng.
- `cleanupClubBackups`: mỗi ngày 02:30 giờ Việt Nam, giữ tháng hiện tại cùng 2 tháng trước; bản cũ chuyển vào Thùng rác 15 ngày rồi mới xóa vĩnh viễn. Ví dụ trong tháng 11 giữ từ 01/09, bản cũ hơn vẫn tải được JSON trong thời hạn thùng rác. Không xóa dữ liệu CLB đang dùng hoặc thư mục khác.
- File gzip riêng tư nằm trong bucket `clb-vovinam-antruong-backups`, prefix `weekly/antruong-v2/`. Khi chủ CLB tải, máy chủ giải nén thành JSON.
- Bản sao gồm records nghiệp vụ, membership/phân quyền, ảnh cá nhân, metadata và nhật ký tại một snapshot Firestore nhất quán. Không có mật khẩu Firebase Authentication hoặc khóa bí mật trong file. Bản sao này tách khỏi 30 bản sao nhanh cũ trong Firestore.
- File tải về ứng dụng Tệp là bản độc lập. Website không tự xóa/ghi đè file trên iPhone; chính sách 3 tháng và thùng rác 15 ngày chỉ áp dụng trên máy chủ.

## Điều kiện do chủ dự án thực hiện

1. Trong Firebase, bật **Blaze** và gắn tài khoản thanh toán. Cloud Functions, Cloud Scheduler và Cloud Storage có thể phát sinh phí theo sử dụng. Script không tự bật thanh toán và không đặt giới hạn chi tiêu thay người dùng.
2. Mở Google Cloud Shell, đăng nhập tài khoản có quyền quản trị dự án `clb-vovinam-antruong`.
3. Chạy:

   ```bash
   git clone https://github.com/khangduy1810/clb-vovinam-antruong.git
   cd clb-vovinam-antruong/new-app
   npx firebase-tools login --no-localhost
   bash scripts/setup-weekly-backup.sh
   ```

   Nếu đã clone thì cập nhật `main` rồi chạy từ `new-app/`. Script tạo bucket riêng tư với Public Access Prevention, service account riêng và các quyền cần thiết; cài dependencies; triển khai đúng ba Functions, Firestore Rules và indexes. Không đụng Realtime Database cũ, không đưa khóa quản trị lên GitHub. Chủ dự án tự thực hiện các bước xác thực/quyền trên tài khoản Google của mình.

## Xác nhận hoạt động

1. Mở **Google Cloud → Cloud Scheduler**. Phải thấy job tương ứng `weeklyClubBackup` và `cleanupClubBackups`, đúng múi giờ/lịch trên.
2. Chọn job `weeklyClubBackup` → **Run now** để tạo bản đầu tiên. Chờ job thành công; nếu lỗi, đọc nhật ký Function trước khi thử lại.
3. Website → **Cài đặt & sao lưu → Sao lưu tuần trên máy chủ** phải hiện thời điểm thành công và bản của tuần hiện tại. Tải JSON và kiểm tra trường `format`, `exportedAt`, `weekId` cùng số lượng records. Thử bằng HLV: không được đọc danh sách hoặc tải file của chủ CLB.
4. Kiểm tra bucket vẫn riêng tư, không có quyền `allUsers`/`allAuthenticatedUsers`. Không thêm Firebase download tokens để công khai file.

Nếu triển khai lỗi IAM/API/bucket, lịch chưa được xem là kích hoạt. Gửi thông báo lỗi không kèm token, mật khẩu hoặc file dữ liệu cá nhân.

## Phạm vi và giới hạn

- Chưa được triển khai hay xác nhận trên Firebase thật trong phiên viết mã; chưa có quyền Google Cloud của chủ dự án.
- Đọc snapshot và nén hiện giới hạn 100 MB JSON, runtime 512 MiB RAM và 9 phút. Cần thiết kế export dạng streaming/managed export nếu dữ liệu tăng lớn. Lưu trữ bucket, thao tác đọc Firestore và số lượt tải có hạn mức/phí riêng.
- Tác vụ chạy lịch không gửi file trực tiếp vào iPhone khi đóng web. Chủ CLB chọn tải bất kỳ bản còn hạn.
- Việc khôi phục trên vùng dữ liệu đang dùng không được tự động thực hiện. Trình nhập JSON hiện phục hồi records vào vùng trống; membership/profiles/metadata trong bản sao tuần cần quy trình khôi phục do quản trị viên kiểm soát, không tự ghi đè quyền đang hoạt động.
- Kiểm tra cục bộ: `node --test functions/core.test.js`, import Functions để kiểm tra manifest; emulator Rules kiểm tra owner-only/server-write-only cho index bản sao. Chưa gọi lịch hoặc bucket production.

Tài liệu Firebase: https://firebase.google.com/docs/functions/schedule-functions

Cập nhật chính sách sao lưu mới và lệnh triển khai đầy đủ: xem [TRASH_SETUP.md](TRASH_SETUP.md). Không cấu hình lifecycle xóa file theo tuổi trong bucket vì sẽ bỏ qua thời gian thùng rác.
