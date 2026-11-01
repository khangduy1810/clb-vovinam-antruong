/** Display fallbacks never replace the canonical name required by deployed audit rules. */
export function normalizeActor(profile:any,user:{email:string;uid:string}){
 const auditName=typeof profile.name==='string'&&profile.name.length>0?profile.name:null;
 return {...profile,name:auditName||user.email.toLowerCase(),auditName,email:user.email.toLowerCase(),identityId:user.uid};
}
export function requireAuditName(actor:any):string{
 if(typeof actor.auditName==='string'&&actor.auditName.length>0)return actor.auditName;
 throw new Error('Hồ sơ tài khoản đang thiếu tên. Trong Firestore, mở clubs/antruong-v2/members/'+actor.email+', thêm trường name (kiểu string), giá trị Duy Khang hoặc tên người dùng, rồi lưu. Sau đó tải lại trang và chọn lại đúng file JSON để tiếp tục; không cần xóa dữ liệu đã nhập.');
}
