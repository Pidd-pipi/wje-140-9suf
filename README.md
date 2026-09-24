# 车队调度与维护 RESTful API 服务

## Docker 快速启动

```bash
docker compose up -d
```

Swagger 文档：http://localhost:19210/api-docs  
健康检查：http://localhost:19210/api/health

## 项目介绍

面向物流公司内部管理系统的后端 API，覆盖车辆生命周期、司机、调度、油耗、维保和费用核算。

## API 功能列表

- /api/vehicles：车辆管理。
- /api/drivers：司机管理。
- /api/dispatch-orders：调度派单与状态流转（建单、改派、开始运输前执行资格预检）。
- /api/maintenance-records：维保管理（进入维保前校验未完成调度，完结后恢复车辆可用）。
- /api/fuel-records：油耗记录。
- /api/cost-summaries：费用汇总与利润核算。

## 调度资格预检与冲突规则

- 建单（`POST /api/dispatch-orders`）、改派（`PATCH /api/dispatch-orders/:id/reassign`）、开始运输（`PATCH /api/dispatch-orders/:id/start`）均执行资格预检，预检结论写入调度单 `precheck`，冲突原因写入 `conflictReasons`，可在调度详情（`GET /api/dispatch-orders/:id`）查看。
- 预检不通过的车辆：维保中、保险已过期、年检已过期、保养已到期（到期日或到期里程）、车辆状态不适用（在途/报废）。
- 预检不通过的司机：驾照已过期、状态不适用（在途/请假/停职）。
- 同一车辆或司机存在未完成调度单（Draft/Assigned/InProgress）时，新派单请求失败（409）且不生成调度单，只保留先成功的一单；预检失败返回 400 并附原因。
- 车辆进入维保（`POST /api/maintenance-records`、`PATCH /api/maintenance-records/:id/start`）时若存在未完成调度将被拒绝；维保完结（`PATCH /api/maintenance-records/:id/complete`）后车辆恢复 Available。
- 调度单完结/取消后，车辆与司机若无其他未完成调度则恢复 Available。

## 本地开发

```bash
cd backend
npm install
npm run start:dev
```

## 技术栈

| 分类 | 技术 |
| --- | --- |
| 后端 | NestJS + TypeScript |
| ORM | TypeORM |
| 数据库 | MySQL 8.0 |
| 缓存 | Redis 7 |
| 认证 | JWT |
| 文档 | Swagger |

## 目录结构

```
backend/src/
├── routes/
├── controllers/
├── services/
├── models/
├── middlewares/
├── types/
├── utils/
├── config/
└── database/
```

## 枚举定义位置

- VehicleStatus：backend/src/types/enums.ts；backend/src/models/vehicle.entity.ts；backend/src/services/vehicle.service.ts
- DispatchStatus：backend/src/types/enums.ts；backend/src/models/dispatchOrder.entity.ts；backend/src/services/dispatch.service.ts
- MaintenanceType：backend/src/types/enums.ts；backend/src/models/maintenanceRecord.entity.ts；backend/src/services/maintenance.service.ts
- DriverStatus：backend/src/types/enums.ts；backend/src/models/driver.entity.ts；backend/src/services/driver.service.ts
- PaymentMethod：backend/src/types/enums.ts；backend/src/models/fuelRecord.entity.ts；backend/src/services/fuel.service.ts

## License

MIT
