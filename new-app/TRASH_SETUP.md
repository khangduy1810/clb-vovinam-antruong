# Dọn thùng rác và giữ lại 15 ngày

## Hành vi

- Điểm danh và học phí giữ tháng hiện tại và 2 tháng trước theo múi giờ Việt Nam. Lịch sử cũ chuyển vào thùng rác thêm 15 ngày rồi mới xóa vĩnh viễn. Hồ sơ võ sinh, tài khoản, lớp và nhật ký không áp dụng mốc 3 tháng. Tác vụ `cleanupClubTrash` cần được triển khai lại sau cập nhật này.

- Chỉ chủ CLB dùng nút **Dọn sạch thùng rác**. Phải nhập `XOA` trước khi xóa vĩnh viễn các mục đã chọn lúc mở hộp thoại, kể cả mục bị bộ lọc ẩn.
- Mục vừa được khôi phục hoặc thay đổi phiên bản được bỏ qua. Không xóa dữ liệu đang hoạt động, cấu hình CLB hoặc hồ sơ chủ CLB.
- Hạn giữ lại là 15 × 24 giờ tính từ ngày chuyển vào thùng rác. Lần xóa mới dùng thời gian Firebase; kiểm tra tự động trên web lấy giờ từ máy chủ, không dựa vào đồng hồ điện thoại.
- Khi chủ CLB mở thùng rác, web kiểm tra các mục quá hạn. Tác vụ `cleanupClubTrash` kiểm tra mỗi giờ, hoạt động kể cả khi không ai mở web **sau khi được triển khai lên Firebase**.
- Mục thiếu ngày xóa hợp lệ được giữ lại để chủ CLB kiểm tra hoặc dọn thủ công. Thông tin thời gian từ bản sao JSON vẫn đọc được.
- Dọn thùng rác chỉ xóa các bản ghi đã xóa tạm. Nhật ký, mã võ sinh đã cấp và tài khoản Firebase Authentication không bị xóa theo.

## Bật trên Firebase

1. Trong **Firestore Database → Rules**, thay toàn bộ bằng nội dung `new-app/firestore.rules`, rồi **Publish**. Đây là bước bắt buộc để nút dọn sạch và kiểm tra quá hạn trên web xóa được dữ liệu.
2. Để chạy khi mọi máy đều tắt web, trên máy có Node.js và Firebase CLI, chạy từ thư mục `new-app/`:

```sh
firebase login
npm --prefix functions ci
firebase deploy --only firestore:rules,functions:cleanupClubTrash,functions:weeklyClubBackup,functions:cleanupClubBackups,functions:downloadWeeklyBackup,functions:backupTrashAction --project clb-vovinam-antruong
```

Tác vụ này dùng tài khoản dịch vụ mặc định của Firebase Functions. Nếu Firebase báo thiếu quyền cho tài khoản chạy tác vụ, cấp quyền đọc/ghi Firestore cho đúng tài khoản được Firebase ghi trong thông báo; không mở quyền công khai cho cơ sở dữ liệu.

Sau khi tác vụ chạy lần đầu, tab Thùng rác hiển thị **Máy chủ dọn tự động gần nhất**. Nếu chưa có thời điểm này, giao diện chỉ xác nhận cơ chế kiểm tra khi mở thùng rác, chưa xác nhận lịch máy chủ đã chạy.

## Kiểm thử

Từ `new-app/`, dùng Firebase CLI:

```sh
npm run test:sync:build
firebase emulators:exec --project demo-antruong-v2 --only firestore,auth "node tests/trash.mjs && node tests/history.mjs && node tests/rules.mjs && node --test functions/trash-scheduled.test.js"
node --test functions/core.test.js functions/trash-core.test.js
```

## Bản sao lưu 3 tháng

Bản sao nhanh Firestore và bản sao tuần Cloud Storage giữ tháng hiện tại cùng 2 tháng trước. Bản cũ chuyển vào `backupTrash` (chỉ metadata, không nhân đôi file) với thời gian máy chủ mới; sau 15 ngày mới xóa file và dữ liệu gốc. Chỉ chủ CLB đọc danh sách, tải JSON để nhập lại qua Khôi phục dữ liệu hoặc dọn sạch sớm sau xác nhận XOA. Máy chủ kiểm tra mỗi ngày 02:30 và khi chủ CLB mở Cài đặt/Thùng rác.

Phải triển khai lại **tất cả** tác vụ trong lệnh trên: tác vụ sao lưu cũ có chính sách xóa trực tiếp 4 tháng. Tài khoản `weekly-clb-backup@clb-vovinam-antruong.iam.gserviceaccount.com` cần quyền đọc/ghi Firestore và đọc/liệt kê/xóa đối tượng trong bucket riêng. Không cấu hình lifecycle xóa tự động theo tuổi file trong bucket này vì sẽ bỏ qua 15 ngày khôi phục.

Bản sao vừa chuyển vào thùng rác luôn được giữ đủ 15 ngày, kể cả bản đã nhiều năm tuổi. Không đổi ngày xóa ở lần kiểm tra sau. Nếu bản nguồn hoặc phiên bản file đã thay đổi, thao tác dọn bỏ qua để bảo vệ dữ liệu mới. Nút tải JSON chỉ hoạt động trong thời hạn khôi phục. Cần xác nhận thông báo kiểm tra thành công trên web sau khi deploy; mã GitHub không tự triển khai Firebase Functions.
