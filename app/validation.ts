import { z } from 'zod';
import { expenseCategories } from './model';
const short=z.string().max(500), day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T00:00:00Z');return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===s},'Ngày không hợp lệ');
const cash=z.number().int().min(0).max(1e12), count=z.number().int().min(0).max(100000);
const employees=z.array(z.string().trim().min(1).max(60)).max(30).refine(a=>new Set(a).size===a.length,'Nhân viên bị trùng');
export const evidenceSchema=z.object({id:z.string().uuid(),name:z.string().min(1).max(120),type:z.enum(['image/jpeg','image/png','image/webp']),size:z.number().int().min(1).max(2*1024*1024)});
export const dataSchema=z.object({schemaVersion:z.literal(1),employees,
 expenses:z.array(z.object({id:short.min(1),date:day,category:z.enum(expenseCategories).default('Chưa phân loại'),invoice:short,transferCode:short.default(''),salesOrderCode:short.default(''),purpose:short.min(1),detail:short,amount:cash.refine(n=>n>0),evidence:z.array(evidenceSchema).max(3).default([])})).max(20000),
 strings:z.array(z.object({date:day,counts:z.record(count)})).max(5000),
 deposits:z.array(z.object({id:short.min(1),customer:short.min(1),phone:short,category:z.enum(['Vợt','Giày','Balo','Phụ kiện','Quần áo','Khác']).default('Khác'),product:short.min(1),variant:short,quantity:count.refine(n=>n>0),date:day,amount:cash.refine(n=>n>0),status:z.enum(['Đang chờ','Đã giao','Đã hoàn cọc']),note:short,closedDate:z.union([day,z.literal('')]),contactPlatform:short.default(''),contactHandle:short.default('')})).max(10000),
 budgets:z.record(cash).refine(a=>Object.keys(a).every(s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s)))
}).superRefine((v,ctx)=>{
 for(const rows of [v.expenses,v.deposits])if(new Set(rows.map(r=>r.id)).size!==rows.length)ctx.addIssue({code:'custom',message:'Mã bản ghi bị trùng'});
 if(new Set(v.strings.map(r=>r.date)).size!==v.strings.length)ctx.addIssue({code:'custom',message:'Ngày đan vợt bị trùng'});
 const attachments=v.expenses.flatMap(r=>r.evidence.map(a=>a.id));
 if(new Set(attachments).size!==attachments.length)ctx.addIssue({code:'custom',message:'Ảnh bằng chứng không được gắn trùng nhiều khoản chi'});
 if(v.strings.some(r=>Object.keys(r.counts).some(n=>!v.employees.includes(n))))ctx.addIssue({code:'custom',message:'Dữ liệu đan có nhân viên chưa khai báo'});
 if(v.deposits.some(r=>r.status==='Đang chờ'?!!r.closedDate:!r.closedDate||r.closedDate<r.date))ctx.addIssue({code:'custom',message:'Ngày hoàn tất cọc phải từ ngày nhận cọc'});
});
