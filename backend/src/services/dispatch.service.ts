import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DispatchStatus, DriverStatus, VehicleStatus } from '../types/enums';
import { PrecheckResult, PrecheckScene } from '../types/interfaces';
import { calculateProfit } from '../utils/costCalculator';
import { generateOrderNo } from '../utils/orderNumber';
import { DriverService } from './driver.service';
import { EligibilityService } from './eligibility.service';
import { VehicleService } from './vehicle.service';

const UNFINISHED_STATUSES: string[] = [DispatchStatus.Draft, DispatchStatus.Assigned, DispatchStatus.InProgress];
const CONFLICT_CODES = ['VEHICLE_ORDER_CONFLICT', 'DRIVER_ORDER_CONFLICT'];

@Injectable()
export class DispatchService {
  private rows: any[] = [{
    id: 1, orderNo: 'DSP-20260612-0001', vehicleId: 1, driverId: 1, origin: '上海青浦仓', destination: '杭州萧山仓',
    planDepartAt: '2026-06-12 09:00', planArriveAt: '2026-06-12 13:30', cargo: '冷链食品', weight: 8200, volume: 42,
    freight: 7200, estimatedFuelCost: 1500, estimatedTollCost: 420, status: 'Assigned', profit: 4180,
    precheck: {
      scene: 'create', passed: true, reasons: [], checkedAt: '2026-06-12T01:00:00.000Z',
      items: [
        { code: 'VEHICLE_STATUS', passed: true, message: '车辆 沪A-7821 状态可用' },
        { code: 'VEHICLE_INSURANCE', passed: true, message: '车辆保险有效期至 2026-09-30' },
        { code: 'VEHICLE_INSPECTION', passed: true, message: '车辆年检有效期至 2026-11-20' },
        { code: 'VEHICLE_MAINTENANCE_DUE', passed: true, message: '车辆保养未到期' },
        { code: 'DRIVER_STATUS', passed: true, message: '司机 赵强 状态可用' },
        { code: 'DRIVER_LICENSE', passed: true, message: '司机驾照有效期至 2028-05-01' },
      ],
    },
    conflictReasons: [],
  }];
  private sequence = 1;
  private inflight = new Set<string>();

  constructor(
    private readonly eligibility: EligibilityService,
    private readonly vehicles: VehicleService,
    private readonly drivers: DriverService,
  ) {}

  findAll() { return this.rows; }
  findOne(id: number) { return this.rows.find((item: any) => item.id === id); }
  findUnfinishedByVehicle(vehicleId: number) { return this.rows.filter((item) => item.vehicleId === vehicleId && UNFINISHED_STATUSES.includes(item.status)); }
  findUnfinishedByDriver(driverId: number) { return this.rows.filter((item) => item.driverId === driverId && UNFINISHED_STATUSES.includes(item.status)); }

  private acquire(keys: string[]): string | null {
    for (const key of keys) {
      if (this.inflight.has(key)) return key;
    }
    keys.forEach((key) => this.inflight.add(key));
    return null;
  }

  private release(keys: string[]) {
    keys.forEach((key) => this.inflight.delete(key));
  }

  private runPrecheck(vehicleId: number, driverId: number, scene: PrecheckScene, excludeOrderId?: number): PrecheckResult {
    const result = this.eligibility.precheck(vehicleId, driverId, scene);
    const vehicleConflict = this.findUnfinishedByVehicle(vehicleId).find((item) => item.id !== excludeOrderId);
    if (vehicleConflict) {
      result.items.push({ code: 'VEHICLE_ORDER_CONFLICT', passed: false, message: `车辆已存在未完成调度单 ${vehicleConflict.orderNo}（${vehicleConflict.status}）` });
    }
    const driverConflict = this.findUnfinishedByDriver(driverId).find((item) => item.id !== excludeOrderId);
    if (driverConflict) {
      result.items.push({ code: 'DRIVER_ORDER_CONFLICT', passed: false, message: `司机已存在未完成调度单 ${driverConflict.orderNo}（${driverConflict.status}）` });
    }
    result.reasons = result.items.filter((item) => !item.passed).map((item) => item.message);
    result.passed = result.reasons.length === 0;
    return result;
  }

  private rejectFailedPrecheck(precheck: PrecheckResult, message: string): never {
    const conflictOnly = precheck.items
      .filter((item) => !item.passed)
      .every((item) => CONFLICT_CODES.includes(item.code));
    const ExceptionType = conflictOnly ? ConflictException : BadRequestException;
    throw new ExceptionType({ message, reasons: precheck.reasons, precheck });
  }

  create(payload: any) {
    if (!payload.vehicleId || !payload.driverId) {
      throw new BadRequestException({ message: 'vehicleId 和 driverId 必填', reasons: ['缺少车辆或司机参数'] });
    }
    const vehicleId = Number(payload.vehicleId);
    const driverId = Number(payload.driverId);
    const keys = [`vehicle:${vehicleId}`, `driver:${driverId}`];
    const held = this.acquire(keys);
    if (held) {
      throw new ConflictException({ message: '派单冲突，未生成调度单', reasons: [`${held} 存在正在处理中的派单请求`] });
    }
    try {
      const precheck = this.runPrecheck(vehicleId, driverId, 'create');
      if (!precheck.passed) {
        this.rejectFailedPrecheck(precheck, '资格预检未通过，未生成调度单');
      }
      const row = {
        ...payload,
        id: this.rows.length ? Math.max(...this.rows.map((item) => item.id)) + 1 : 1,
        orderNo: generateOrderNo('DSP', ++this.sequence),
        vehicleId,
        driverId,
        status: payload.status ?? DispatchStatus.Assigned,
        profit: calculateProfit(Number(payload.freight ?? 0), Number(payload.estimatedFuelCost ?? 0), Number(payload.estimatedTollCost ?? 0), Number(payload.laborCost ?? 0)),
        precheck,
        conflictReasons: [],
      };
      this.rows.push(row);
      return row;
    } finally {
      this.release(keys);
    }
  }

  reassign(id: number, payload: any) {
    const order = this.findOne(id);
    if (!order) throw new NotFoundException(`调度单 ${id} 不存在`);
    if ([DispatchStatus.Completed, DispatchStatus.Cancelled].includes(order.status)) {
      throw new BadRequestException(`调度单 ${order.orderNo} 已完结，不能改派`);
    }
    const vehicleId = Number(payload.vehicleId ?? order.vehicleId);
    const driverId = Number(payload.driverId ?? order.driverId);
    const keys = [`vehicle:${vehicleId}`, `driver:${driverId}`];
    const held = this.acquire(keys);
    if (held) {
      throw new ConflictException({ message: '改派冲突，保留原派单', reasons: [`${held} 存在正在处理中的派单请求`] });
    }
    try {
      const precheck = this.runPrecheck(vehicleId, driverId, 'reassign', id);
      order.precheck = precheck;
      if (!precheck.passed) {
        order.conflictReasons = precheck.reasons;
        this.rejectFailedPrecheck(precheck, '改派资格预检未通过，保留原派单');
      }
      order.vehicleId = vehicleId;
      order.driverId = driverId;
      order.conflictReasons = [];
      return order;
    } finally {
      this.release(keys);
    }
  }

  start(id: number) {
    const order = this.findOne(id);
    if (!order) throw new NotFoundException(`调度单 ${id} 不存在`);
    if (![DispatchStatus.Draft, DispatchStatus.Assigned].includes(order.status)) {
      throw new BadRequestException(`调度单 ${order.orderNo} 当前状态为 ${order.status}，不能开始运输`);
    }
    const keys = [`vehicle:${order.vehicleId}`, `driver:${order.driverId}`];
    const held = this.acquire(keys);
    if (held) {
      throw new ConflictException({ message: '开始运输冲突', reasons: [`${held} 存在正在处理中的派单请求`] });
    }
    try {
      const precheck = this.runPrecheck(order.vehicleId, order.driverId, 'start', id);
      order.precheck = precheck;
      if (!precheck.passed) {
        order.conflictReasons = precheck.reasons;
        this.rejectFailedPrecheck(precheck, '开始运输资格预检未通过');
      }
      order.status = DispatchStatus.InProgress;
      order.actualDepartAt = new Date().toISOString();
      order.conflictReasons = [];
      this.vehicles.updateStatus(order.vehicleId, VehicleStatus.OnTrip);
      this.drivers.updateStatus(order.driverId, DriverStatus.OnTrip);
      return order;
    } finally {
      this.release(keys);
    }
  }

  complete(id: number) {
    const order = this.findOne(id);
    if (!order) throw new NotFoundException(`调度单 ${id} 不存在`);
    if (order.status !== DispatchStatus.InProgress) {
      throw new BadRequestException(`调度单 ${order.orderNo} 当前状态为 ${order.status}，仅运输中的调度单可以完结`);
    }
    order.status = DispatchStatus.Completed;
    order.actualArriveAt = new Date().toISOString();
    this.releaseResources(order);
    return order;
  }

  cancel(id: number) {
    const order = this.findOne(id);
    if (!order) throw new NotFoundException(`调度单 ${id} 不存在`);
    if ([DispatchStatus.Completed, DispatchStatus.Cancelled].includes(order.status)) {
      throw new BadRequestException(`调度单 ${order.orderNo} 已完结`);
    }
    if (order.status === DispatchStatus.InProgress) {
      throw new BadRequestException(`调度单 ${order.orderNo} 正在运输中，请先完结`);
    }
    order.status = DispatchStatus.Cancelled;
    this.releaseResources(order);
    return order;
  }

  private releaseResources(order: any) {
    const vehicle = this.vehicles.findOne(order.vehicleId);
    if (vehicle && vehicle.status === VehicleStatus.OnTrip && this.findUnfinishedByVehicle(order.vehicleId).length === 0) {
      this.vehicles.updateStatus(order.vehicleId, VehicleStatus.Available);
    }
    const driver = this.drivers.findOne(order.driverId);
    if (driver && driver.status === DriverStatus.OnTrip && this.findUnfinishedByDriver(order.driverId).length === 0) {
      this.drivers.updateStatus(order.driverId, DriverStatus.Available);
    }
  }
}
