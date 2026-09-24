import { Injectable } from '@nestjs/common';
import { DriverStatus, VehicleStatus } from '../types/enums';
import { PrecheckResult } from '../types/interfaces';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function isExpired(dateStr?: string) { return !!dateStr && dateStr.slice(0, 10) < todayStr(); }

@Injectable()
export class EligibilityService {
  checkVehicle(vehicle: any): string[] {
    if (!vehicle) return ['车辆不存在'];
    const reasons: string[] = [];
    if (vehicle.status === VehicleStatus.Maintenance) reasons.push(`车辆 ${vehicle.plateNo} 正在维保中`);
    else if (vehicle.status === VehicleStatus.OnTrip) reasons.push(`车辆 ${vehicle.plateNo} 正在运输途中`);
    else if (vehicle.status === VehicleStatus.Retired) reasons.push(`车辆 ${vehicle.plateNo} 已退役`);
    else if (vehicle.status !== VehicleStatus.Available) reasons.push(`车辆 ${vehicle.plateNo} 状态不可用(${vehicle.status})`);
    if (isExpired(vehicle.insuranceExpireDate)) reasons.push(`车辆 ${vehicle.plateNo} 保险已于 ${vehicle.insuranceExpireDate} 过期`);
    if (isExpired(vehicle.inspectionExpireDate)) reasons.push(`车辆 ${vehicle.plateNo} 年检已于 ${vehicle.inspectionExpireDate} 过期`);
    return reasons;
  }

  checkDriver(driver: any): string[] {
    if (!driver) return ['司机不存在'];
    const reasons: string[] = [];
    if (driver.status !== DriverStatus.Available) reasons.push(`司机 ${driver.name} 状态不适用(${driver.status})，不可接单`);
    if (isExpired(driver.licenseExpireDate)) reasons.push(`司机 ${driver.name} 驾照已于 ${driver.licenseExpireDate} 过期`);
    return reasons;
  }

  check(vehicle: any, driver: any): PrecheckResult {
    const reasons = [...this.checkVehicle(vehicle), ...this.checkDriver(driver)];
    return { passed: reasons.length === 0, reasons, checkedAt: new Date().toISOString() };
  }
}
