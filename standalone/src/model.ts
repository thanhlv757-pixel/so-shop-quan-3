export type Evidence = { id:string; name:string; type:string; size:number };
export const expenseCategories=['Chi theo đơn hàng','Mua dụng cụ','Hỗ trợ tiền xăng','Chi nội bộ khác','Chưa phân loại'] as const;
export const internalExpenseCategories=['Mua dụng cụ','Hỗ trợ tiền xăng','Chi nội bộ khác'] as const;
export type Expense = { id:string; date:string; category:typeof expenseCategories[number]; invoice:string; transferCode:string; salesOrderCode:string; purpose:string; detail:string; amount:number; evidence:Evidence[] };
export function getExpenseCategory(expense:{category?:string}){return expenseCategories.find(c=>c===expense.category)||'Chưa phân loại'}
export function isInternalExpense(expense:{category?:string}){return internalExpenseCategories.some(c=>c===getExpenseCategory(expense))}
export type StringDay = { date:string; counts:Record<string,number> };
export type Deposit = { id:string; customer:string; phone:string; category:string; product:string; variant:string; quantity:number; date:string; amount:number; status:string; note:string; closedDate:string; contactPlatform:string; contactHandle:string };
export const productCategories=['Vợt','Giày','Balo','Phụ kiện','Quần áo','Khác'] as const;
export const contactPlatforms=['Zalo','Facebook / Messenger','Instagram','TikTok','Điện thoại','Trực tiếp tại shop','Khác'] as const;
export type ShopData = { schemaVersion:1; employees:string[]; expenses:Expense[]; strings:StringDay[]; deposits:Deposit[]; budgets:Record<string,number> };
export const statuses = ['Đang chờ','Đã giao','Đã hoàn cọc'];
export const emptyData = ():ShopData => ({schemaVersion:1,employees:[],expenses:[],strings:[],deposits:[],budgets:{}});
export const STRINGING_KPI = 450;
export const STRINGING_BASE_RATE = 5000;
export const STRINGING_KPI_RATE = 10000;
export const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
export const daysInMonth = (month:string) => new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
export const money = (n:number) => new Intl.NumberFormat('vi-VN').format(n)+'đ';
export const dateLabel = (s:string) => s ? s.split('-').reverse().join('/') : '—';
export const sum = <T,>(rows:T[],f:(x:T)=>number) => rows.reduce((a,x)=>a+f(x),0);
export function metrics(data:ShopData,month:string){
 const expenses=data.expenses.filter(x=>x.date.startsWith(month));
 const strings=data.strings.filter(x=>x.date.startsWith(month));
 const spent=sum(expenses,x=>x.amount), racks=sum(strings,x=>sum(Object.values(x.counts),v=>v));
 const pending=data.deposits.filter(x=>x.status==='Đang chờ');
 const orderExpenses=expenses.filter(x=>getExpenseCategory(x)==='Chi theo đơn hàng');
 const internalExpenses=expenses.filter(isInternalExpense),unclassifiedExpenses=expenses.filter(x=>getExpenseCategory(x)==='Chưa phân loại');
 const achieved=racks>=STRINGING_KPI,rate=achieved?STRINGING_KPI_RATE:STRINGING_BASE_RATE;
 const payroll=data.employees.map(name=>{const count=sum(strings,r=>r.counts[name]||0);return {name,count,amount:count*rate}});
 return {expenses,strings,spent,racks,pending,held:sum(pending,x=>x.amount),budget:data.budgets[month]||0,remaining:(data.budgets[month]||0)-spent,achieved,rate,payroll,totalPay:racks*rate,kpiRemaining:Math.max(0,STRINGING_KPI-racks),orderExpenses,internalExpenses,unclassifiedExpenses,invoiceCount:orderExpenses.length,orderSpent:sum(orderExpenses,x=>x.amount),internalSpent:sum(internalExpenses,x=>x.amount),unclassifiedSpent:sum(unclassifiedExpenses,x=>x.amount)};
}
