import {randomBytes,scryptSync} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
const rl=createInterface({input:process.stdin,output:process.stdout});
console.log('Chạy trên máy riêng. Mật khẩu nhập tại đây sẽ hiện trên màn hình.');
const password=await rl.question('Mật khẩu mới (ít nhất 12 ký tự): ');rl.close();
if(password.length<12)throw Error('Mật khẩu phải có ít nhất 12 ký tự');
const salt=randomBytes(16).toString('hex');
console.log('SHOP_PASSWORD_HASH='+salt+':'+scryptSync(password,salt,64).toString('hex'));
