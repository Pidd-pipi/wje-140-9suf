import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MaintenanceStatus, VehicleStatus } from '../types/enums';
import { DispatchService } from './dispatch.service';
import { VehicleService } from './vehicle.service';

@Injectable()
export class MaintenanceService {
  private rows: any[] = [
    { id: 1, vehicleId: 1, maintenanceType: 'Routine', item: '机油与制动检查', cost: 2100, vendor: '青浦维保站', date: '2026-06-06', nextMileage: 93000, nextDate: '2026-09-06', status: 'Completed' },
    { id: 2, vehicleId: 4, maintenanceType: 'Emergency', item: '变速箱故障检修', cost: 6800, vendor: '闵行维修厂', date: '2026-09-22', nextMileage: 25000, nextDate: '2026-10-01', status: 'InProgress' },
  ];

  constructor(
    private readonly vehicles: VehicleService,
    private readonly dispatch: DispatchService,
  ) {}

  findAll() { return this.rows; }
  findOne(id: number) { return this.rows.find((item: any) => item.id === id); }

  private assertNoUnfinishedDispatch(vehicleId: number) {
    const unfinished = this.dispatch.findUnfinishedByVehicle(vehicleId);
    if (unfinished.length) {
      throw new ConflictException({
        message: '车辆存在未完成调度，暂不能进入维保',
        reasons: unfinished.map((order) => `调度单 ${order.orderNo} 状态为 ${order.status}`),
      });
    }
  }

  create(payload: any) {
    const vehicleId = Number(payload.vehicleId);
    const vehicle = this.vehicles.findOne(vehicleId);
    if (!vehicle) throw new NotFoundException(`车辆 ${vehicleId} 不存在`);
    const status = payload.status ?? MaintenanceStatus.Scheduled;
    if (status === MaintenanceStatus.Completed) {
      this.vehicles.updateMaintenancePlan(vehicleId, payload.nextDate, payload.nextMileage);
    } else {
      this.assertNoUnfinishedDispatch(vehicleId);
      this.vehicles.updateStatus(vehicleId, VehicleStatus.Maintenance);
    }
    const row = { ...payload, vehicleId, status, id: this.rows.length ? Math.max(...this.rows.map((item) => item.id)) + 1 : 1 };
    this.rows.push(row);
    return row;
  }

  start(id: number) {
    const record = this.findOne(id);
    if (!record) throw new NotFoundException(`维保记录 ${id} 不存在`);
    if (record.status !== MaintenanceStatus.Scheduled) {
      throw new BadRequestException(`维保记录 ${id} 当前状态为 ${record.status}，仅待开始的记录可以开工`);
    }
    this.assertNoUnfinishedDispatch(record.vehicleId);
    record.status = MaintenanceStatus.InProgress;
    this.vehicles.updateStatus(record.vehicleId, VehicleStatus.Maintenance);
    return record;
  }

  complete(id: number) {
    const record = this.findOne(id);
    if (!record) throw new NotFoundException(`维保记录 ${id} 不存在`);
    if (record.status === MaintenanceStatus.Completed) {
      throw new BadRequestException(`维保记录 ${id} 已完结`);
    }
    record.status = MaintenanceStatus.Completed;
    this.vehicles.updateMaintenancePlan(record.vehicleId, record.nextDate, record.nextMileage);
    const stillActive = this.rows.some((item) => item.vehicleId === record.vehicleId && item.status !== MaintenanceStatus.Completed);
    const vehicle = this.vehicles.findOne(record.vehicleId);
    if (!stillActive && vehicle && vehicle.status === VehicleStatus.Maintenance) {
      this.vehicles.updateStatus(record.vehicleId, VehicleStatus.Available);
    }
    return record;
  }
}
