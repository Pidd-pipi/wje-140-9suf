/* 冒烟测试：直接实例化服务类，验证资格预检 / 冲突 / 维保联动 */
const { VehicleService } = require('../dist/services/vehicle.service');
const { DriverService } = require('../dist/services/driver.service');
const { EligibilityService } = require('../dist/services/eligibility.service');
const { DispatchService } = require('../dist/services/dispatch.service');
const { MaintenanceService } = require('../dist/services/maintenance.service');

const vehicleService = new VehicleService();
const driverService = new DriverService();
const eligibility = new EligibilityService();
const dispatch = new DispatchService(vehicleService, driverService, eligibility);
const maintenance = new MaintenanceService(vehicleService, dispatch);

let passed = 0, failed = 0;
function check(name, fn, expectStatus) {
  try {
    const result = fn();
    if (expectStatus) {
      failed++; console.log(`FAIL ${name}: 应抛出 ${expectStatus} 但成功了`);
    } else {
      passed++; console.log(`PASS ${name}`);
    }
    return result;
  } catch (e) {
    const status = e.status || (e.getStatus && e.getStatus());
    if (expectStatus && status === expectStatus) {
      passed++; console.log(`PASS ${name} -> ${status}: ${JSON.stringify(e.response && e.response.reasons || e.message)}`);
    } else {
      failed++; console.log(`FAIL ${name}: 意外异常 ${status} ${e.message}`);
    }
    return null;
  }
}

// 1. 种子单 DSP-20260612-0001 占用车辆1/司机1 -> 同车同司机建单应 409 冲突且不生成新单
const before = dispatch.findAll().length;
check('同车同司机重复建单(冲突)', () => dispatch.create({ vehicleId: 1, driverId: 1, origin: 'A', destination: 'B', freight: 1000 }), 409);
check('冲突后未生成新调度单', () => { if (dispatch.findAll().length !== before) throw new Error('单数变化了'); });

// 2. 车辆2+司机2 正常建单
const order = check('正常建单(车辆2+司机2)', () => dispatch.create({ vehicleId: 2, driverId: 2, origin: '上海', destination: '北京', freight: 9000, estimatedFuelCost: 2000, estimatedTollCost: 600, laborCost: 1100, cargo: '普货', weight: 10000, volume: 50 }));
if (order) console.log(`   单号=${order.orderNo} 状态=${order.status} 利润=${order.profit} 预检=${order.precheckResult}`);

// 3. 维保中车辆不可接单：车辆2进入维保(需先取消其调度? 车辆2有 Assigned 单 -> 进维保应 409)
check('有未完成调度的车辆进入维保(拒绝)', () => maintenance.create({ vehicleId: 2, maintenanceType: 'Repair', item: '变速箱检修', status: 'InProgress' }), 409);

// 4. 取消车辆2的调度后可进维保
check('取消调度单', () => dispatch.cancel(order.id));
const m1 = check('取消后车辆2进入维保', () => maintenance.create({ vehicleId: 2, maintenanceType: 'Repair', item: '变速箱检修', status: 'InProgress' }));
if (vehicleService.findOne(2).status !== 'Maintenance') { failed++; console.log('FAIL 车辆2状态应为 Maintenance'); } else { passed++; console.log('PASS 车辆2状态=Maintenance'); }

// 5. 维保中车辆建单应 400 且带原因
check('维保中车辆建单(预检拒绝)', () => dispatch.create({ vehicleId: 2, driverId: 2, origin: 'A', destination: 'B', freight: 100 }), 400);

// 6. 保险过期车辆不可接单
vehicleService.create({ plateNo: '沪C-0001', vehicleType: 'LightTruck', brandModel: '测试车', purchaseDate: '2020-01-01', insuranceExpireDate: '2026-01-01', inspectionExpireDate: '2027-01-01', status: 'Available', mileage: 1, tankCapacity: 100, dailyFixedCost: 100 });
check('保险过期车辆建单(预检拒绝)', () => dispatch.create({ vehicleId: 3, driverId: 2, origin: 'A', destination: 'B', freight: 100 }), 400);

// 7. 驾照过期司机不可接单
vehicleService.create({ plateNo: '沪D-0002', vehicleType: 'LightTruck', brandModel: '测试车2', purchaseDate: '2021-01-01', insuranceExpireDate: '2027-06-01', inspectionExpireDate: '2027-06-01', status: 'Available', mileage: 1, tankCapacity: 100, dailyFixedCost: 100 });
driverService.create({ name: '测试司机', phone: '139', identityNo: 'x', licenseType: 'C1', licenseExpireDate: '2025-12-31', hireDate: '2020-01-01', status: 'Available', monthlySalary: 8000 });
check('驾照过期司机建单(预检拒绝)', () => dispatch.create({ vehicleId: 4, driverId: 3, origin: 'A', destination: 'B', freight: 100 }), 400);

// 8. 休假司机不可接单
driverService.create({ name: '休假司机', phone: '137', identityNo: 'y', licenseType: 'B2', licenseExpireDate: '2028-01-01', hireDate: '2020-01-01', status: 'Leave', monthlySalary: 8000 });
check('休假司机建单(预检拒绝)', () => dispatch.create({ vehicleId: 4, driverId: 4, origin: 'A', destination: 'B', freight: 100 }), 400);

// 9. 维保结束车辆恢复可用
check('结束维保', () => maintenance.complete(m1.id));
if (vehicleService.findOne(2).status !== 'Available') { failed++; console.log('FAIL 车辆2状态应恢复 Available'); } else { passed++; console.log('PASS 车辆2状态恢复=Available'); }

// 10. 改派：把种子单改派到车辆2(可用) 成功；再改派到维保/不存在车辆失败
check('改派到可用车辆2', () => dispatch.reassign(1, { vehicleId: 2 }));
check('改派到保险过期车辆3(拒绝)', () => dispatch.reassign(1, { vehicleId: 3 }), 400);
const detail = dispatch.findOne(1);
console.log(`   改派失败后详情: vehicleId=${detail.vehicleId} 预检=${detail.precheckResult} 原因=${JSON.stringify(detail.precheckReasons)}`);

// 11. 开始运输：种子单(现车辆2/司机1) 开始 -> InProgress，资源变 OnTrip
check('开始运输', () => dispatch.start(1));
if (vehicleService.findOne(2).status !== 'OnTrip' || driverService.findOne(1).status !== 'OnTrip') { failed++; console.log('FAIL 资源状态应为 OnTrip'); } else { passed++; console.log('PASS 车辆2/司机1 状态=OnTrip'); }

// 12. 运输中车辆进维保应 409
check('运输中车辆进入维保(拒绝)', () => maintenance.create({ vehicleId: 2, maintenanceType: 'Routine', item: '保养', status: 'InProgress' }), 409);

// 13. 完成运输，资源释放
check('完成运输', () => dispatch.complete(1));
if (vehicleService.findOne(2).status !== 'Available' || driverService.findOne(1).status !== 'Available') { failed++; console.log('FAIL 资源状态应恢复 Available'); } else { passed++; console.log('PASS 资源状态恢复=Available'); }

// 14. 详情包含预检结论字段
const d = dispatch.findOne(1);
if (d.precheckResult && d.precheckAt !== undefined && 'conflictReason' in d) { passed++; console.log(`PASS 详情含预检结论: ${d.precheckResult} @ ${d.precheckAt}`); } else { failed++; console.log('FAIL 详情缺少预检字段'); }

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);
