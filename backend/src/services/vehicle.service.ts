import { Injectable } from '@nestjs/common';
@Injectable()
export class VehicleService {
  private rows = [
    { id: 1, plateNo: '沪A-7821', vehicleType: 'Refrigerated', brandModel: '东风天锦 KR', purchaseDate: '2023-03-12', insuranceExpireDate: '2026-09-30', inspectionExpireDate: '2026-11-20', status: 'Available', mileage: 88210, tankCapacity: 380, dailyFixedCost: 260 },
    { id: 2, plateNo: '沪B-3390', vehicleType: 'HeavyTruck', brandModel: '解放 J7', purchaseDate: '2024-05-08', insuranceExpireDate: '2027-01-15', inspectionExpireDate: '2026-12-01', status: 'Available', mileage: 41200, tankCapacity: 600, dailyFixedCost: 340 }
  ];
  findAll() { return this.rows; }
  findOne(id: number) { return this.rows.find((item: any) => item.id === id); }
  create(payload: any) { const row = { ...payload, id: this.rows.length + 1 }; this.rows.push(row); return row; }
  updateStatus(id: number, status: string) { const row: any = this.findOne(id); if (row) row.status = status; return row; }
}
