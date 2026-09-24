import { Injectable } from '@nestjs/common';
@Injectable()
export class DriverService {
  private rows = [
    { id: 1, name: '赵强', phone: '13800000001', identityNo: '310101199001010011', licenseType: 'B2', licenseExpireDate: '2028-05-01', hireDate: '2022-01-10', status: 'Available', monthlySalary: 9800 },
    { id: 2, name: '钱伟', phone: '13800000002', identityNo: '310101199202020022', licenseType: 'A2', licenseExpireDate: '2027-03-01', hireDate: '2023-06-15', status: 'Available', monthlySalary: 11500 }
  ];
  findAll() { return this.rows; }
  findOne(id: number) { return this.rows.find((item: any) => item.id === id); }
  create(payload: any) { const row = { ...payload, id: this.rows.length + 1 }; this.rows.push(row); return row; }
  updateStatus(id: number, status: string) { const row: any = this.findOne(id); if (row) row.status = status; return row; }
}
