import { Injectable, NotFoundException } from '@nestjs/common';
import { DriverStatus } from '../types/enums';

@Injectable()
export class DriverService {
  private rows: any[] = [
    { id: 1, name: '赵强', phone: '13800000001', identityNo: '310101199001010011', licenseType: 'B2', licenseExpireDate: '2028-05-01', hireDate: '2022-01-10', status: 'Available', monthlySalary: 9800 },
    { id: 2, name: '钱进', phone: '13800000002', identityNo: '310101198802020022', licenseType: 'A2', licenseExpireDate: '2026-06-30', hireDate: '2021-06-15', status: 'Available', monthlySalary: 11500 },
    { id: 3, name: '孙明', phone: '13800000003', identityNo: '310101199503030033', licenseType: 'B2', licenseExpireDate: '2027-08-01', hireDate: '2023-03-01', status: 'Suspended', monthlySalary: 9200 },
    { id: 4, name: '李伟', phone: '13800000004', identityNo: '310101199204040044', licenseType: 'B2', licenseExpireDate: '2027-10-15', hireDate: '2022-09-01', status: 'Available', monthlySalary: 9500 },
    { id: 5, name: '王磊', phone: '13800000005', identityNo: '310101199105050055', licenseType: 'A2', licenseExpireDate: '2027-12-01', hireDate: '2020-11-20', status: 'Available', monthlySalary: 12000 },
  ];
  findAll() { return this.rows; }
  findOne(id: number) { return this.rows.find((item: any) => item.id === id); }
  create(payload: any) {
    const row = { status: DriverStatus.Available, ...payload, id: this.rows.length ? Math.max(...this.rows.map((item) => item.id)) + 1 : 1 };
    this.rows.push(row);
    return row;
  }
  updateStatus(id: number, status: string) {
    const row = this.findOne(id);
    if (!row) throw new NotFoundException(`司机 ${id} 不存在`);
    row.status = status;
    return row;
  }
}
