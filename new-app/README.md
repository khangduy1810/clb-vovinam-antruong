# Vovinam An Trường v2 — GitHub + Firebase

Giữ giao diện bản mới đã duyệt. React/Vite chạy trên GitHub Pages; Firebase Authentication đăng nhập email/mật khẩu, Firestore giữ dữ liệu tập trung và kiểm tra quyền theo lớp. Không phụ thuộc đăng nhập ChatGPT hoặc Sites.

Mã nguồn ở `new-app/`; bản chạy tĩnh ở `v2/`. Thư mục gốc của trang cũ không bị thay thế. Dữ liệu học sinh, JSON sao lưu, mật khẩu/hash và khóa quản trị không nằm trong GitHub. Cấu hình Firebase web là định danh công khai, không cấp quyền đọc dữ liệu.

## Kích hoạt một lần (bắt buộc)

Hiện mã đã sẵn sàng nhưng chưa tự cấu hình được dự án Firebase của chủ CLB. GitHub Pages không tự tạo tài khoản, database hoặc triển khai Firestore Rules.

1. Trong Firebase project **clb-vovinam-antruong**, chọn **Build → Firestore Database → Create database → Standard edition → Production mode**, database `(default)`. Chọn vị trí phù hợp trước khi tạo. Không thay đổi Realtime Database của trang cũ.
2. Trong **Authentication → Sign-in method**, bật **Email/Password**. Ở **Users → Add user**, tạo email/mật khẩu cho chủ CLB. Chủ CLB tự đặt mật khẩu; không đưa vào GitHub hoặc gửi trong chat.
3. Triển khai `firestore.rules` và `firestore.indexes.json` ở thư mục này. Có thể dùng Cloud Shell sau khi đăng nhập Firebase CLI:

   ```bash
   git clone --branch v2-firebase-login https://github.com/khangduy1810/clb-vovinam-antruong.git
   cd clb-vovinam-antruong/new-app
   npx firebase-tools login --no-localhost
   npx firebase-tools deploy --project clb-vovinam-antruong --only firestore:rules,firestore:indexes
   ```

   Chỉ deploy Firestore. Không deploy file Rules của Realtime Database cũ. Nếu deploy indexes chưa hoàn tất, chờ chúng chuyển sang Enabled.

4. Tạo quyền chủ CLB bằng **một** trong hai cách:

   - Trong Google Cloud Shell đang đăng nhập tài khoản chủ dự án, chạy `node scripts/bootstrap-owner.mjs EMAIL_CHU_CLB`. Script xác nhận email đã có trong Firebase Auth, không hỏi mật khẩu, và không thay thế hồ sơ quyền đã tồn tại.
   - Hoặc tạo document Firestore tại `clubs/antruong-v2/members/EMAIL_CHU_CLB` (email viết thường), với các trường:

   | Trường | Kiểu | Giá trị |
   | --- | --- | --- |
   | id | string | ACC-ADMIN |
   | name | string | Tên người quản trị |
   | email | string | Email đăng nhập, viết thường |
   | status | string | active |
   | isSuperAdmin | boolean | true |
   | allClasses | boolean | true |
   | classIds | array | rỗng |
   | permissions | map | rỗng |
   | roleTitle | string | Chủ CLB |

5. Mở trang `/clb-vovinam-antruong/v2/`, đăng nhập chủ CLB, chọn file **Vovinam_FullBackup_2026-10-29.json** trong mục nhập dữ liệu. Giữ tab mở đến khi báo hoàn tất. Nếu gián đoạn, chọn lại đúng file để tiếp tục; dấu SHA-256 ngăn nhập nhầm file khác. Thành viên không đọc được dữ liệu khi chưa hoàn tất nhập. Kiểm tra **110 võ sinh / 4 lớp / 5 hồ sơ**. Mỗi người được giữ riêng, không gộp theo họ tên.
6. Trong tab **Tài khoản**, gắn email, chọn lớp, tab làm việc và trạng thái hoạt động cho HLV. Trong Firebase **Authentication → Users**, tạo tài khoản email/mật khẩu trùng email vừa gắn. Gửi link v2 cho HLV; mỗi người dùng email/mật khẩu riêng. Không cần mã phòng, ghép nối máy, Push hoặc Pull.

Có thể thêm `khangduy1810.github.io` vào **Authentication → Settings → Authorized domains** nếu Firebase yêu cầu cho tính năng email/link. Không cần dùng GitHub OAuth.

## Kiểm tra bằng hai máy trước khi dùng thật

- Chủ CLB đăng nhập máy A, HLV đăng nhập máy B bằng hai email khác nhau.
- HLV chỉ thấy các lớp và tab đã cấp; mở trực tiếp API cũng không vượt được Rules.
- HLV lưu tạm điểm danh; đăng nhập cùng HLV trên máy C, mở đúng lớp/ngày để tiếp tục.
- Cập nhật học phí hoặc hồ sơ ở A, kiểm tra B nhận qua listener nếu B có quyền tương ứng.
- Hai máy sửa cùng một hồ sơ cũ: lần lưu sau báo tải phiên bản mới, không ghi đè âm thầm.
- Tắt quyền/khóa hồ sơ HLV; truy cập dữ liệu từ máy B phải bị Rules từ chối.

## Sao lưu và giới hạn

Xuất JSON riêng cho chủ CLB. Tạo snapshot trước lần sửa đầu tiên của chủ mỗi ngày, giữ 30 bản; thay đổi của HLV không kích hoạt snapshot toàn CLB. Chưa cấu hình lịch sao lưu khi không ai mở trang. Chưa có giao diện phục hồi dữ liệu đang hoạt động bằng cách ghi đè toàn bộ; import chỉ dành cho vùng trống hoặc tiếp tục đúng lần nhập bị gián đoạn. Tải JSON độc lập định kỳ.

Firestore transactions cần mạng. Điểm danh chưa gửi có bản nháp riêng trên thiết bị; chỉ nút Lưu tạm có xác nhận máy chủ mới tiếp tục được ở máy khác. Không hứa độ trễ cố định. Mật khẩu cũ không chuyển sang Firebase Authentication.

## Phát triển và cập nhật bản chạy

```bash
cd new-app
npm ci
npm run build
```

Sau build, chạy `node scripts/update-pages.mjs` rồi commit cả `new-app/` và `v2/`. Đường dẫn assets tương đối nên hỗ trợ GitHub Pages trong thư mục con. Firebase Hosting là lựa chọn khác (`firebase deploy --only hosting`); không cần chuyển để chạy GitHub Pages.

Kiểm tra cục bộ: `firebase emulators:exec --project demo-antruong-v2 --only firestore,auth 'node tests/rules.mjs && node tests/auth.mjs'`. Java/Firebase CLI cần tương thích nhau. Kiểm tra bản sao lưu thật có thể truyền `IMPORT_BACKUP_PATH` chỉ trên máy cục bộ, không commit file đó.

## Quyền tại máy chủ

Rules kiểm tra email trong ID token, hồ sơ hoạt động, quyền theo tab, phạm vi lớp, phiên bản tăng đúng 1, cấu trúc cơ bản và nhật ký đi kèm lần ghi. Thành viên không tự sửa hồ sơ quyền, không đọc bản sao toàn CLB, không ghi sang lớp khác. Quy tắc đầy đủ danh sách điểm danh và liên kết từng dòng được kiểm tra tại ứng dụng; không coi đó là thay thế cho kiểm tra nghiệp vụ server riêng nếu sau này bổ sung backend.

Tài liệu chính thức: [Firebase Auth email/password](https://firebase.google.com/docs/auth/web/password-auth), [Rules theo người dùng](https://firebase.google.com/docs/firestore/security/rules-conditions), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).

## Khắc phục hồ sơ thiếu tên khi nhập dữ liệu

Nếu báo `Unsupported field value: undefined (found in field actor ...)`, hồ sơ membership của tài khoản đăng nhập thiếu `name` hoặc không phải string. Trong Firestore Console, mở `clubs/antruong-v2/members/<email đăng nhập>`, thêm/sửa `name` kiểu string thành tên người dùng. Bản mới kiểm tra trường này trước khi ghi và hiển thị email thay vì để trống lời chào. Không dùng tên dự phòng để vượt kiểm tra nhật ký tại Rules.

Tải lại trang v2, chọn lại **đúng file JSON trước đó** để tiếp tục. Các hồ sơ đã ghi được bỏ qua; thao tác cuối chỉ chuyển trạng thái nhập sang ready kèm nhật ký sau khi hồ sơ tên đã hợp lệ. Không xóa collection và không đổi hash/trạng thái nhập thủ công.

## Hồ sơ cá nhân: ảnh và mật khẩu

Mọi tài khoản hoạt động có mục **Hồ sơ cá nhân**; cũng có thể bấm ảnh/chữ cái ở góc trên hoặc cuối menu. Đổi mật khẩu bằng mật khẩu hiện tại, mật khẩu mới và xác nhận. Firebase Authentication xác thực lại trước khi cập nhật; mật khẩu không được ghi vào Firestore, JSON sao lưu hoặc localStorage. Mật khẩu mới tối thiểu 8 ký tự, backend Firebase vẫn áp dụng chính sách dự án.

Ảnh được xử lý trên trình duyệt thành JPEG vuông 256×256, sau đó lưu ở `clubs/antruong-v2/profiles/<Firebase UID>`. JPEG/PNG/WebP được hỗ trợ; HEIC/HEIF phụ thuộc khả năng giải mã của trình duyệt, nếu không đọc được cần xuất JPG. Tối đa ảnh gốc 8 MB và dữ liệu sau xử lý 180.000 ký tự. Rules chỉ cho tài khoản hoạt động đọc/ghi ảnh chính UID đó; không cho thay đổi quyền, email hay lớp từ document ảnh. Ảnh hiện trên thiết bị khác khi người đó đăng nhập cùng tài khoản. Ảnh riêng này chưa nằm trong JSON sao lưu hồ sơ nghiệp vụ.

**Chủ dự án cần Publish lại `new-app/firestore.rules` sau cập nhật này.** Nếu chưa áp dụng, màn hình báo rõ ảnh chưa lưu được; chức năng đổi mật khẩu và các chức năng cũ vẫn hoạt động. Không bật quyền đọc/ghi công khai, không sửa Rules Realtime Database và không cần cấu hình Firebase Storage.

Kiểm tra bổ sung: emulator Auth xác thực mật khẩu hiện tại và đăng nhập bằng mật khẩu mới trên client khác; emulator Firestore kiểm tra ảnh chính chủ, từ chối sửa/đọc ảnh người khác, quyền chưa cấp, dữ liệu quá lớn hoặc chèn thêm trường phân quyền. Kiểm tra bố cục bằng component thử nghiệm không có phiên đăng nhập thật.

## Lịch sao lưu tuần giữ 4 tháng

Xem [WEEKLY_BACKUP_SETUP.md](WEEKLY_BACKUP_SETUP.md). Website đã có danh sách/trạng thái và nút tải JSON; backend trong `functions/` chạy Chủ nhật 02:00 và dọn bản quá 4 tháng mỗi ngày. **Chủ dự án cần bật Blaze và chạy script triển khai trước; lịch chưa được tự kích hoạt bởi GitHub Pages.** File nằm trong Cloud Storage riêng tư, không phải GitHub công khai hay tự tải/xóa trong ứng dụng Tệp của iPhone.

## Cấp đai và mã võ sinh

Cấp đai dùng danh sách chọn Vovinam, từ Tự vệ nhập môn đến Bạch đai. Giá trị nhập tay trước đây được giữ cho đến khi người dùng chọn lại.

Khi chủ CLB mở phiên bản này, hệ thống đánh lại toàn bộ mã hiển thị liên tục từ `VVN.0001`, kể cả hồ sơ trong thùng rác và mã đã đúng định dạng. Thứ tự cấp số dựa trên số của mã trước đó, sau đó UID; danh sách trên giao diện không bị sắp xếp lại. Giữ nguyên UID hồ sơ, tên, cấp đai và liên kết điểm danh/học phí.

Đây là chuyển đổi một lần, có bản sao lưu trước khi bắt đầu. Khóa bảo trì ngăn ghi trong lúc chuyển; kế hoạch UID → mã được lưu trước và tiếp tục đúng kế hoạch khi tải lại nếu bị gián đoạn. Mỗi hồ sơ có giao dịch và nhật ký riêng. Khi xong mới dọn chỉ mục mã cũ và mở lại dữ liệu. Những lần đăng nhập sau không đánh số lại. Võ sinh mới được cấp số tiếp theo tự động, có đặt chỗ trong giao dịch chống trùng mã. Không cần cập nhật Firestore Rules.

Kiểm tra: `npm run test:students`, `npm run test:flows`, `npm run build`.

## Sắp tên, võ sinh đã nghỉ và mã không tái sử dụng

Danh sách võ sinh, học phí, điểm danh và báo cáo hiển thị theo tên gọi (từ cuối của họ tên) với thứ tự tiếng Việt; tên trùng được phân định bằng họ tên đầy đủ rồi mã và UID. Chỉ sắp bản hiển thị, không thay đổi mã hay liên kết dữ liệu.

Trong hồ sơ võ sinh chọn **Trạng thái võ sinh → Đã nghỉ**. Tab Võ sinh có bộ lọc Đang học / Đã nghỉ / Tất cả. Người đã nghỉ không được thêm vào buổi điểm danh mới; các điểm danh đã chốt, dấu điểm danh và ghi chú đã nhập vẫn được giữ. Sổ học phí vẫn hiện người đã nghỉ nếu tháng đó đã có bản ghi học phí.

Võ sinh mới nhận mã `VVN.0001` trở đi khi máy chủ xác nhận lưu; không nhập mã thủ công. Đặt chỗ mã được giữ cả khi nghỉ, chuyển vào thùng rác và dọn vĩnh viễn. Khởi tạo lại danh mục và khôi phục JSON trên database hiện tại cũng không xóa các đặt chỗ không còn hồ sơ. Quy trình đánh lại toàn bộ mã một lần ở trên là ngoại lệ theo yêu cầu trước đó, không chạy lại sau khi đã hoàn tất.

Kiểm tra bổ sung: `npm run test:student-policy` kiểm tra tên tiếng Việt, lịch sử điểm danh, và chạy gateway thật với adapter Firestore bộ nhớ để thử hai lượt thêm đồng thời, nghỉ/xóa, khởi tạo lại danh mục và khôi phục JSON. Đây là kiểm tra hành vi ứng dụng; không thay thế bộ kiểm tra Firestore Rules.

## Sửa cấp đai hiện tại về Tự vệ nhập môn (02/11/2026)

Theo yêu cầu chủ CLB, bản này sửa một lần cấp đai của toàn bộ hồ sơ võ sinh hiện có về **Tự vệ nhập môn** khi chủ CLB mở web. Thực hiện sau khi tác vụ chuẩn hóa mã hoàn tất, có sao lưu trước khi sửa. Danh sách UID được cố định lúc bắt đầu; từng giao dịch chỉ sửa `data.belt`, tăng phiên bản và ghi nhật ký. Mã, tên, trạng thái học/nghỉ, thùng rác và liên kết điểm danh/học phí giữ nguyên.

Tiến độ được ghi cùng giao dịch sửa hồ sơ nên tải lại sau gián đoạn sẽ tiếp tục từ hồ sơ chưa xong. Khi hoàn tất, tác vụ không chạy lại; các lần nâng đai sau này và võ sinh thêm sau lúc bắt đầu không bị hạ đai. Không cần Publish Firestore Rules mới. Kiểm tra bổ sung trong `npm run test:student-policy` bao gồm mất kết nối, tiếp tục, hồ sơ đã nghỉ/thùng rác và không ghi đè lần nâng đai sau này.
