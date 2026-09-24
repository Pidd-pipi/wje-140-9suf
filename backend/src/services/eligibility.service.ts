import { Injectable } from '@nestjs/common';
import { DriverStatus, VehicleStatus } from '../types/enums';
import { PrecheckItem, PrecheckResult, PrecheckScene } from '../types/interfaces';
import { DriverService } from './driver.service';
import { VehicleService } from './vehicle.service';

const DRIVER_STATUS_LABEL: Record<string, string> = {
  [DriverStatus.OnTrip]: '正在运输途中',
  [DriverStatus.Leave]: '请假中',
  [DriverStatus.Suspended]: '已停职',
};

@Injectable()
export class EligibilityService {
  constructor(
    private readonly vehicles: VehicleService,
    private readonly drivers: DriverService,
  ) {}

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  checkVehicle(vehicleId: number): PrecheckItem[] {
    const vehicle = this.vehicles.findOne(vehicleId);
    if (!vehicle) {
      return [{ code: 'VEHICLE_NOT_FOUND', passed: false, message: `车辆 ${vehicleId} 不存在` }];
    }
    const today = this.today();
    const items: PrecheckItem[] = [];

    if (vehicle.status === VehicleStatus.Maintenance) {
      items.push({ code: 'VEHICLE_IN_MAINTENANCE', passed: false, message: `车辆 ${vehicle.plateNo} 正在维保中` });
    } else if (vehicle.status === VehicleStatus.OnTrip) {
      items.push({ code: 'VEHICLE_STATUS_UNAVAILABLE', passed: false, message: `车辆 ${vehicle.plateNo} 正在运输途中` });
    } else if (vehicle.status === VehicleStatus.Retired) {
      items.push({ code: 'VEHICLE_STATUS_UNAVAILABLE', passed: false, message: `车辆 ${vehicle.plateNo} 已报废` });
    } else {
      items.push({ code: 'VEHICLE_STATUS', passed: true, message: `车辆 ${vehicle.plateNo} 状态可用` });
    }

    if (!vehicle.insuranceExpireDate) {
      items.push({ code: 'VEHICLE_INSURANCE_EXPIRED', passed: false, message: `车辆 ${vehicle.plateNo} 未登记保险到期日` });
    } else if (vehicle.insuranceExpireDate < today) {
      items.push({ code: 'VEHICLE_INSURANCE_EXPIRED', passed: false, message: `车辆 ${vehicle.plateNo} 保险已于 ${vehicle.insuranceExpireDate} 过期` });
    } else {
      items.push({ code: 'VEHICLE_INSURANCE', passed: true, message: `车辆保险有效期至 ${vehicle.insuranceExpireDate}` });
    }

    if (!vehicle.inspectionExpireDate) {
      items.push({ code: 'VEHICLE_INSPECTION_EXPIRED', passed: false, message: `车辆 ${vehicle.plateNo} 未登记年检到期日` });
    } else if (vehicle.inspectionExpireDate < today) {
      items.push({ code: 'VEHICLE_INSPECTION_EXPIRED', passed: false, message: `车辆 ${vehicle.plateNo} 年检已于 ${vehicle.inspectionExpireDate} 过期` });
    } else {
      items.push({ code: 'VEHICLE_INSPECTION', passed: true, message: `车辆年检有效期至 ${vehicle.inspectionExpireDate}` });
    }

    if (vehicle.nextMaintenanceDate && vehicle.nextMaintenanceDate < today) {
      items.push({ code: 'VEHICLE_MAINTENANCE_DUE', passed: false, message: `车辆 ${vehicle.plateNo} 保养已到期（下次保养日期 ${vehicle.nextMaintenanceDate}）` });
    } else if (vehicle.nextMaintenanceMileage && vehicle.mileage >= vehicle.nextMaintenanceMileage) {
      items.push({ code: 'VEHICLE_MAINTENANCE_DUE', passed: false, message: `车辆 ${vehicle.plateNo} 保养已到期（当前里程 ${vehicle.mileage}，保养里程 ${vehicle.nextMaintenanceMileage}）` });
    } else {
      items.push({ code: 'VEHICLE_MAINTENANCE_DUE', passed: true, message: '车辆保养未到期' });
    }

    return items;
  }

  checkDriver(driverId: number): PrecheckItem[] {
    const driver = this.drivers.findOne(driverId);
    if (!driver) {
      return [{ code: 'DRIVER_NOT_FOUND', passed: false, message: `司机 ${driverId} 不存在` }];
    }
    const today = this.today();
    const items: PrecheckItem[] = [];

    if (driver.status !== DriverStatus.Available) {
      const label = DRIVER_STATUS_LABEL[driver.status] ?? driver.status;
      items.push({ code: 'DRIVER_STATUS_UNAVAILABLE', passed: false, message: `司机 ${driver.name} 状态不适用（${label}）` });
    } else {
      items.push({ code: 'DRIVER_STATUS', passed: true, message: `司机 ${driver.name} 状态可用` });
    }

    if (!driver.licenseExpireDate) {
      items.push({ code: 'DRIVER_LICENSE_EXPIRED', passed: false, message: `司机 ${driver.name} 未登记驾照到期日` });
    } else if (driver.licenseExpireDate < today) {
      items.push({ code: 'DRIVER_LICENSE_EXPIRED', passed: false, message: `司机 ${driver.name} 驾照已于 ${driver.licenseExpireDate} 过期` });
    } else {
      items.push({ code: 'DRIVER_LICENSE', passed: true, message: `司机驾照有效期至 ${driver.licenseExpireDate}` });
    }

    return items;
  }

  precheck(vehicleId: number, driverId: number, scene: PrecheckScene): PrecheckResult {
    const items = [...this.checkVehicle(vehicleId), ...this.checkDriver(driverId)];
    const reasons = items.filter((item) => !item.passed).map((item) => item.message);
    return { scene, passed: reasons.length === 0, reasons, checkedAt: new Date().toISOString(), items };
  }
}
