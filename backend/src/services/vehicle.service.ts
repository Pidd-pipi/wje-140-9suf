import { Injectable, NotFoundException } from '@nestjs/common';
import { VehicleStatus } from '../types/enums';

@Injectable()
export class VehicleService {
  private rows: any[] = [
    { id: 1, plateNo: '沪A-7821', vehicleType: 'Refrigerated', brandModel: '东风天锦 KR', purchaseDate: '2023-03-12', insuranceExpireDate: '2026-09-30', inspectionExpireDate: '2026-11-20', status: 'Available', mileage: 88210, tankCapacity: 380, dailyFixedCost: 260, nextMaintenanceDate: '2026-09-06', nextMaintenanceMileage: 93000 },
    { id: 2, plateNo: '沪B-3360', vehicleType: 'MediumTruck', brandModel: '解放 J6L', purchaseDate: '2024-05-08', insuranceExpireDate: '2027-03-01', inspectionExpireDate: '2027-05-01', status: 'Available', mileage: 45200, tankCapacity: 300, dailyFixedCost: 210, nextMaintenanceDate: '2027-01-15', nextMaintenanceMileage: 50000 },
    { id: 3, plateNo: '沪C-9012', vehicleType: 'HeavyTruck', brandModel: '重汽豪沃 T7H', purchaseDate: '2021-11-20', insuranceExpireDate: '2026-08-31', inspectionExpireDate: '2026-07-15', status: 'Available', mileage: 152300, tankCapacity: 600, dailyFixedCost: 340, nextMaintenanceDate: '2026-12-01', nextMaintenanceMileage: 160000 },
    { id: 4, plateNo: '沪D-5517', vehicleType: 'LightTruck', brandModel: '江铃顺达', purchaseDate: '2025-02-14', insuranceExpireDate: '2027-01-10', inspectionExpireDate: '2027-02-10', status: 'Maintenance', mileage: 21400, tankCapacity: 120, dailyFixedCost: 150, nextMaintenanceDate: '2026-10-01', nextMaintenanceMileage: 25000 },
    { id: 5, plateNo: '沪E-8801', vehicleType: 'MediumTruck', brandModel: '福田欧马可 S5', purchaseDate: '2024-09-01', insuranceExpireDate: '2027-06-30', inspectionExpireDate: '2027-08-31', status: 'Available', mileage: 32100, tankCapacity: 260, dailyFixedCost: 200, nextMaintenanceDate: '2027-02-01', nextMaintenanceMileage: 60000 },
  ];
  findAll() { return this.rows; }
  findOne(id: number) { return this.rows.find((item: any) => item.id === id); }
  create(payload: any) {
    const row = { status: VehicleStatus.Available, ...payload, id: this.rows.length ? Math.max(...this.rows.map((item) => item.id)) + 1 : 1 };
    this.rows.push(row);
    return row;
  }
  updateStatus(id: number, status: string) {
    const row = this.findOne(id);
    if (!row) throw new NotFoundException(`车辆 ${id} 不存在`);
    row.status = status;
    return row;
  }
  updateMaintenancePlan(id: number, nextDate?: string, nextMileage?: number) {
    const row = this.findOne(id);
    if (!row) throw new NotFoundException(`车辆 ${id} 不存在`);
    if (nextDate) row.nextMaintenanceDate = nextDate;
    if (nextMileage) row.nextMaintenanceMileage = nextMileage;
    return row;
  }
}
