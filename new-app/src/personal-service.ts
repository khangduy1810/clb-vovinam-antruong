import {EmailAuthProvider,reauthenticateWithCredential,updatePassword,type Auth} from 'firebase/auth';
export async function changeOwnPassword(auth:Auth,current:string,next:string,confirm:string){
 const user=auth.currentUser;if(!user?.email)throw new Error('Vui lòng đăng nhập lại.');
 if(!current)throw new Error('Nhập mật khẩu hiện tại.');
 if(next.length<8)throw new Error('Mật khẩu mới cần ít nhất 8 ký tự.');
 if(next!==confirm)throw new Error('Hai lần nhập mật khẩu mới chưa khớp.');
 if(current===next)throw new Error('Mật khẩu mới cần khác mật khẩu hiện tại.');
 await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,current));
 await updatePassword(user,next);
}
export function personalError(e:any){
 const messages:Record<string,string>={'auth/invalid-credential':'Mật khẩu hiện tại chưa đúng.','auth/wrong-password':'Mật khẩu hiện tại chưa đúng.','auth/too-many-requests':'Thao tác quá nhiều lần. Vui lòng thử lại sau.','auth/network-request-failed':'Không kết nối được Firebase. Kiểm tra mạng rồi thử lại.','auth/requires-recent-login':'Phiên xác thực đã cũ. Đăng xuất rồi đăng nhập lại để đổi mật khẩu.','auth/weak-password':'Mật khẩu mới chưa đủ mạnh.','auth/password-does-not-meet-requirements':'Mật khẩu mới chưa đáp ứng chính sách của CLB.','permission-denied':'Ảnh chưa được lưu. Chủ CLB cần cập nhật Firestore Rules mới từ GitHub, sau đó tải lại trang.'};return messages[e?.code]||e?.message||'Chưa xử lý được yêu cầu. Hãy thử lại.';
}
