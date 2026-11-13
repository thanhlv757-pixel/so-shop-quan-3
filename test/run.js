const ExcelJS=require('exceljs');const {buildWorkbook}=require('./builder.js');
const m=require('../migration/months/2026-10.json');
const fs=require('fs');
const ex=m.expenses.map(e=>({id:e.id,date:e.date,amount:e.amount,category:e.category,purpose:e.purpose,detail:e.detail,invoice:e.invoice,transfer_code:e.transferCode,sales_order_code:e.salesOrderCode,evidence:e.evidence.map(x=>({path:'migrated/'+x.id+'.jpg'}))}));
const deps=[{customer:'Anh Minh',phone:'0901234567',contact_platform:'Zalo',contact_handle:'zalo.me/abc',category:'Vợt',product:'Yonex Astrox 99 Pro',variant:'4U',quantity:1,date:'2026-10-20',amount:500000,status:'Đang chờ',closed_date:null,note:'Chờ hàng về'},{customer:'Chị Lan',phone:'',contact_platform:'Facebook / Messenger',contact_handle:'',category:'Giày',product:'Victor A970',variant:'41',quantity:2,date:'2026-10-05',amount:300000,status:'Đã giao',closed_date:'2026-10-12',note:''}];
(async()=>{
 const sharp=null;
 for (const withImg of [false,true]){
  let images=null;
  if(withImg){images={};for(const e of ex)for(const p of e.evidence){const b=fs.readFileSync('../migration/images/'+p.path.split('/')[1]);images[p.path]={base64:'data:image/jpeg;base64,'+b.toString('base64'),w:400,h:600}}}
  const wb=buildWorkbook(ExcelJS,{month:'2026-10',today:'2026-11-12',settings:{employees:['Thành','Thái','Bình'],kpi_target:450,rate_low:5000,rate_high:10000},budget:500000,expenses:ex,strings:m.strings,deposits:deps,images});
  await wb.xlsx.writeFile(withImg?'out_img.xlsx':'out.xlsx');
 }
 // empty month
 const wb=buildWorkbook(ExcelJS,{month:'2026-11',today:'2026-11-12',settings:{employees:[],kpi_target:450,rate_low:5000,rate_high:10000},budget:0,expenses:[],strings:[],deposits:[],images:null});
 await wb.xlsx.writeFile('out_empty.xlsx');
 console.log('ok');
})().catch(e=>{console.error(e);process.exit(1)});
