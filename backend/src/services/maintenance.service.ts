import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleStatus } from '../types/enums';
import { DispatchService } from './dispatch.service';
import { VehicleService } from './vehicle.service';

@Injectable()
export class MaintenanceService {
  private rows: any[] = [{ id: 1, vehicleId: 1, maintenanceType: 'Routine', item: '机油与制动检查', cost: 2100, vendor: '青浦维保站', date: '2026-06-06', nextMileage: 93000, nextDate: '2026-09-06', status: 'Completed' }];

  constructor(
    private readonly vehicleService: VehicleService,
    private readonly dispatchService: DispatchService
  ) {}

  findAll() { return this.rows; }

  findOne(id: number) {
    const row = this.rows.find((item: any) => item.id === id);
    if (!row) throw new NotFoundException(`维保记录 ${id} 不存在`);
    return row;
  }

  create(payload: any) {
    const vehicle = this.vehicleService.findOne(Number(payload.vehicleId));
    if (!vehicle) throw new NotFoundException(`车辆 ${payload.vehicleId} 不存在`);
    const status = payload.status || 'Scheduled';
    if (status === 'InProgress') {
      this.assertVehicleCanEnterMaintenance(vehicle);
      this.vehicleService.updateStatus(vehicle.id, VehicleStatus.Maintenance);
    }
    const row = { ...payload, status, id: this.rows.length + 1 };
    this.rows.push(row);
    return row;
  }

  start(id: number) {
    const row = this.findOne(id);
    if (row.status !== 'Scheduled') {
      throw new BadRequestException(`维保记录状态为 ${row.status}，不能开始维保`);
    }
    const vehicle = this.vehicleService.findOne(row.vehicleId);
    this.assertVehicleCanEnterMaintenance(vehicle);
    row.status = 'InProgress';
    this.vehicleService.updateStatus(row.vehicleId, VehicleStatus.Maintenance);
    return row;
  }

  complete(id: number) {
    const row = this.findOne(id);
    if (row.status !== 'InProgress') {
      throw new BadRequestException(`维保记录状态为 ${row.status}，不能结束维保`);
    }
    row.status = 'Completed';
    const vehicle = this.vehicleService.findOne(row.vehicleId);
    if (vehicle && vehicle.status === VehicleStatus.Maintenance) {
      this.vehicleService.updateStatus(vehicle.id, VehicleStatus.Available);
    }
    return row;
  }

  private assertVehicleCanEnterMaintenance(vehicle: any) {
    if (!vehicle) throw new NotFoundException('车辆不存在');
    if (vehicle.status === VehicleStatus.Maintenance) {
      throw new BadRequestException(`车辆 ${vehicle.plateNo} 已在维保中`);
    }
    const unfinished = this.dispatchService.findUnfinishedByVehicle(vehicle.id);
    if (unfinished.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        message: '车辆存在未完成调度，暂不能进入维保',
        reasons: unfinished.map((order: any) => `未完成调度单 ${order.orderNo}(${order.status})`)
      });
    }
  }
}
