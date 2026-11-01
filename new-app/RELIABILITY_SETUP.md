# Bật các thay đổi về độ tin cậy

1. Publish toàn bộ `firestore.rules` mới vào Firestore mặc định của dự án `clb-vovinam-antruong`.
2. Tải lại `/v2/`. Tất cả tài khoản, gồm chủ CLB và hồ sơ cũ, cần xác minh email. Trang đăng nhập có nút gửi lại thư và kiểm tra sau xác minh. Không tạo hay nhập mật khẩu qua Firestore.
3. Chủ CLB mở **Cài đặt & sao lưu → Khởi tạo / kiểm tra danh mục mã võ sinh** một lần. Hệ thống cũng tự thực hiện trước lần chủ CLB lưu võ sinh. Nếu phát hiện mã trùng, dừng và báo mã; không tự gộp hoặc đổi thứ tự hồ sơ.

## Mã võ sinh và đồng bộ

Mỗi mã có một reservation trong `studentCodes` được ghi cùng giao dịch với hồ sơ. Rules buộc hồ sơ trỏ đúng reservation, nên giao dịch đồng thời không thể cùng giữ một mã. Mã được so sánh không phân biệt hoa/thường, bỏ khoảng trắng đầu/cuối; không cho `/`, tối đa 80 ký tự. Sửa mã sẽ giải phóng mã cũ trong cùng giao dịch. Giao dịch nhập/khôi phục của chủ CLB dùng chế độ bảo trì riêng và xây lại toàn bộ reservation trước khi mở dữ liệu.

## Điểm danh

Danh sách buổi chưa chốt nhận thêm võ sinh mới, bỏ người đã chuyển lớp hoặc ngừng trong danh sách, giữ dấu và ghi chú của những người còn lại cùng các học viên học bù hợp lệ. Buổi đã chốt giữ nguyên danh sách lịch sử. Bản lưu tạm trên máy chủ vẫn dùng được trên máy khác; localStorage chỉ giữ bản đang sửa trên máy này.

## Khôi phục

- Chỉ chủ CLB đã xác minh email có thể khôi phục từ JSON. Xem trước, kiểm tra liên kết và nhập `KHOI PHUC` trước khi ghi.
- Lưu bản hoàn tác **trước khi** thay dữ liệu; nội dung được chia thành nhiều tài liệu để tránh giới hạn một tài liệu Firestore.
- Khóa thao tác của thành viên trong lúc thay thế, ghi nhật ký khi hoàn tất. Nếu gián đoạn, chọn lại cùng file để tiếp tục hoặc chọn bản hoàn tác đã lưu. Không mở bản dở dang cho thành viên.
- Dữ liệu nghiệp vụ thay bằng nội dung file. File xuất mới chứa thêm membership và ảnh đại diện; file cũ không có những phần này thì giữ quyền và ảnh hiện tại. Hồ sơ chủ CLB hiện tại được giữ; bản của chủ CLB khác bị từ chối.
- Mật khẩu và danh sách người dùng Firebase Authentication không nằm trong JSON, không được tạo/xóa/khôi phục bởi luồng này. Nhật ký hiện tại được giữ, bổ sung sự kiện khôi phục.
- Bản hoàn tác được giữ trên Firestore và tải được trong trang, không tự xóa. Không thực hiện bất kỳ khôi phục thực tế nào trong quá trình kiểm thử bản phát hành.
- Sao lưu tuần khi đóng web vẫn tạm dừng; thay đổi này không triển khai Cloud Functions hay nâng cấp thanh toán.

## Kiểm thử cục bộ

`npm run build`, `npm run test:flows`, `node tests/profile.mjs`, và bộ Auth/Firestore emulator trong `tests/rules.mjs`, `tests/auth.mjs`.

Kiểm thử khôi phục end-to-end dùng `npm run test:recovery:build` rồi chạy `node tests/.recovery-built.mjs` bên trong `firebase emulators:exec --only firestore,auth --project clb-vovinam-antruong`. Tất cả kết nối trong bài này được trỏ rõ tới localhost, không ghi dự án thực tế.
