import fs from 'node:fs/promises';
import path from 'node:path';
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<13)){throw new Error('Cần Node.js >= 22.13 để chạy dự án.')}
const root=process.cwd();
await fs.access(path.join(root,'app/model.ts'));
await fs.mkdir(path.join(root,'.sites-runtime'),{recursive:true});
await fs.writeFile(path.join(root,'.sites-runtime/execution-profile.json'),JSON.stringify({executionProfile:'portable'})+'\n');
console.log('Đã chọn portable cho bản copy. Không đổi project ID hoặc dữ liệu trên web.');
console.log('Tiếp theo: npx --yes pnpm@11.25.0 install --frozen-lockfile');
console.log('Đọc docs/LOCAL_SETUP.md để build, tạo D1 local và mở ứng dụng.');
