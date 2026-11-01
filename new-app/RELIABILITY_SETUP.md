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

## Tự khóa sau 10 phút

Khóa màn hình sau 10 phút không tương tác. Kiểm tra lại thời gian khi chuyển về tab, mở lại trang hoặc từ ứng dụng khác trở về; thao tác đầu tiên sau khi hết hạn không mở khóa. Mở lại bằng mật khẩu tài khoản qua Firebase reauthentication. Khóa áp dụng theo tài khoản trên trình duyệt hiện tại, các tab cùng trình duyệt dùng chung mốc hoạt động; máy khác theo dõi riêng. Khóa không thay đổi quyền tài khoản và không đăng xuất các thiết bị khác. Khi khóa, giao diện dữ liệu được tháo khỏi màn hình; bản điểm danh đang sửa giữ trong bộ nhớ trình duyệt như trước. Mật khẩu mở khóa không lưu vào trình duyệt hay Firestore. Không cần sửa Rules riêng cho chức năng khóa.

## Khóa tài khoản và thùng rác

Chủ CLB có nút Khóa/Mở khóa ở mỗi hồ sơ tài khoản. Khóa cập nhật membership về inactive, chặn quyền dữ liệu ở các máy. Không xóa người dùng Firebase Authentication hay mật khẩu. Chủ CLB được bảo vệ ở cả giao diện và Rules.

Chủ CLB có thể Chuyển vào thùng rác từ hồ sơ chi tiết (võ sinh, lớp, học phí, đơn hàng, thi đấu, phê duyệt) hoặc thẻ tài khoản. Thùng rác giữ nguyên tài liệu bằng cờ deleted, kèm người/thời điểm xóa và lịch sử; không tự xóa vĩnh viễn. Lớp còn võ sinh phải chuyển học viên trước. Khôi phục võ sinh cần khôi phục lớp trước. Khôi phục tài khoản giữ trạng thái khóa; chủ CLB kiểm tra quyền và mở khóa riêng. Mã võ sinh đã xóa vẫn được giữ để tránh cấp trùng. Đây là thùng rác hồ sơ trên trang, không quản lý tệp đã tải xuống điện thoại.

Publish Rules mới một lần, sau đó tải lại trang để dùng tính năng này. Không có dữ liệu thực tế nào được xóa hoặc khóa trong lúc phát triển/kiểm thử.
