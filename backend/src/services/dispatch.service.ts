import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DispatchStatus, DriverStatus, VehicleStatus } from '../types/enums';
import { PrecheckResult } from '../types/interfaces';
import { calculateProfit } from '../utils/costCalculator';
import { generateOrderNo } from '../utils/orderNumber';
import { DriverService } from './driver.service';
import { EligibilityService } from './eligibility.service';
import { VehicleService } from './vehicle.service';

const ACTIVE_STATUSES: string[] = [DispatchStatus.Assigned, DispatchStatus.InProgress];

@Injectable()
export class DispatchService {
  private rows: any[] = [{ id: 1, orderNo: 'DSP-20260612-0001', vehicleId: 1, driverId: 1, origin: '上海青浦仓', destination: '杭州萧山仓', planDepartAt: '2026-06-12 09:00', planArriveAt: '2026-06-12 13:30', cargo: '冷链食品', weight: 8200, volume: 42, freight: 7200, estimatedFuelCost: 1500, estimatedTollCost: 420, status: 'Assigned', profit: 4180, precheckResult: 'Passed', precheckReasons: [], precheckAt: '2026-06-11T18:00:00.000Z', conflictReason: null }];

  constructor(
    private readonly vehicleService: VehicleService,
    private readonly driverService: DriverService,
    private readonly eligibilityService: EligibilityService
  ) {}

  findAll() { return this.rows; }

  findOne(id: number) {
    const row = this.rows.find((item: any) => item.id === id);
    if (!row) throw new NotFoundException(`调度单 ${id} 不存在`);
    return row;
  }

  findUnfinishedByVehicle(vehicleId: number) {
    return this.rows.filter((item: any) => item.vehicleId === vehicleId && ACTIVE_STATUSES.includes(item.status));
  }

  create(payload: any) {
    const vehicleId = Number(payload.vehicleId);
    const driverId = Number(payload.driverId);
    const vehicle = this.vehicleService.findOne(vehicleId);
    const driver = this.driverService.findOne(driverId);
    const precheck = this.eligibilityService.check(vehicle, driver);
    const conflicts = this.findConflicts(vehicleId, driverId);
    this.assertAssignable(precheck, conflicts);
    const row = {
      ...payload,
      id: this.rows.length + 1,
      orderNo: generateOrderNo('DSP', this.rows.length + 1),
      vehicleId,
      driverId,
      status: DispatchStatus.Assigned,
      profit: calculateProfit(Number(payload.freight) || 0, Number(payload.estimatedFuelCost) || 0, Number(payload.estimatedTollCost) || 0, Number(payload.laborCost) || 0),
      precheckResult: 'Passed',
      precheckReasons: [],
      precheckAt: precheck.checkedAt,
      conflictReason: null
    };
    this.rows.push(row);
    return row;
  }

  reassign(id: number, payload: any) {
    const row = this.findOne(id);
    if (![DispatchStatus.Draft, DispatchStatus.Assigned].includes(row.status)) {
      throw new BadRequestException(`调度单状态为 ${row.status}，不允许改派`);
    }
    const vehicleId = payload.vehicleId != null ? Number(payload.vehicleId) : row.vehicleId;
    const driverId = payload.driverId != null ? Number(payload.driverId) : row.driverId;
    const vehicle = this.vehicleService.findOne(vehicleId);
    const driver = this.driverService.findOne(driverId);
    const precheck = this.eligibilityService.check(vehicle, driver);
    const conflicts = this.findConflicts(vehicleId, driverId, id);
    if (conflicts.length > 0 || !precheck.passed) {
      row.precheckResult = 'Failed';
      row.precheckReasons = precheck.reasons;
      row.precheckAt = precheck.checkedAt;
      row.conflictReason = conflicts.length > 0 ? conflicts.join('；') : null;
      this.assertAssignable(precheck, conflicts);
    }
    row.vehicleId = vehicleId;
    row.driverId = driverId;
    row.precheckResult = 'Passed';
    row.precheckReasons = [];
    row.precheckAt = precheck.checkedAt;
    row.conflictReason = null;
    return row;
  }

  start(id: number) {
    const row = this.findOne(id);
    if (row.status !== DispatchStatus.Assigned) {
      throw new BadRequestException(`调度单状态为 ${row.status}，不能开始运输`);
    }
    const vehicle = this.vehicleService.findOne(row.vehicleId);
    const driver = this.driverService.findOne(row.driverId);
    const precheck = this.eligibilityService.check(vehicle, driver);
    if (!precheck.passed) {
      row.precheckResult = 'Failed';
      row.precheckReasons = precheck.reasons;
      row.precheckAt = precheck.checkedAt;
      throw new BadRequestException({ statusCode: 400, message: '开始运输前资格预检未通过', reasons: precheck.reasons });
    }
    row.status = DispatchStatus.InProgress;
    row.actualDepartAt = new Date().toISOString();
    row.precheckResult = 'Passed';
    row.precheckReasons = [];
    row.precheckAt = precheck.checkedAt;
    this.vehicleService.updateStatus(row.vehicleId, VehicleStatus.OnTrip);
    this.driverService.updateStatus(row.driverId, DriverStatus.OnTrip);
    return row;
  }

  complete(id: number) {
    const row = this.findOne(id);
    if (row.status !== DispatchStatus.InProgress) {
      throw new BadRequestException(`调度单状态为 ${row.status}，不能完成`);
    }
    row.status = DispatchStatus.Completed;
    row.actualArriveAt = new Date().toISOString();
    this.vehicleService.updateStatus(row.vehicleId, VehicleStatus.Available);
    this.driverService.updateStatus(row.driverId, DriverStatus.Available);
    return row;
  }

  cancel(id: number) {
    const row = this.findOne(id);
    if ([DispatchStatus.Completed, DispatchStatus.Cancelled].includes(row.status)) {
      throw new BadRequestException(`调度单状态为 ${row.status}，不能取消`);
    }
    if (row.status === DispatchStatus.InProgress) {
      this.vehicleService.updateStatus(row.vehicleId, VehicleStatus.Available);
      this.driverService.updateStatus(row.driverId, DriverStatus.Available);
    }
    row.status = DispatchStatus.Cancelled;
    return row;
  }

  private findConflicts(vehicleId: number, driverId: number, excludeId?: number): string[] {
    const reasons: string[] = [];
    for (const row of this.rows) {
      if (row.id === excludeId || !ACTIVE_STATUSES.includes(row.status)) continue;
      if (row.vehicleId === vehicleId) reasons.push(`车辆已存在未完成调度单 ${row.orderNo}(${row.status})`);
      if (row.driverId === driverId) reasons.push(`司机已存在未完成调度单 ${row.orderNo}(${row.status})`);
    }
    return reasons;
  }

  private assertAssignable(precheck: PrecheckResult, conflicts: string[]) {
    if (conflicts.length > 0) {
      throw new ConflictException({ statusCode: 409, message: '调度冲突，未生成调度单', reasons: [...precheck.reasons, ...conflicts] });
    }
    if (!precheck.passed) {
      throw new BadRequestException({ statusCode: 400, message: '资格预检未通过，未生成调度单', reasons: precheck.reasons });
    }
  }
}
