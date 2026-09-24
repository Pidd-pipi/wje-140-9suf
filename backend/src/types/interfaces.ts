export type Role = 'Admin' | 'FleetManager' | 'Dispatcher' | 'Driver' | 'Mechanic';
export interface AuthUser { id: number; role: Role; name: string; }
export interface ApiResult<T> { data: T; message: string; }

export type PrecheckScene = 'create' | 'reassign' | 'start';
export interface PrecheckItem { code: string; passed: boolean; message: string; }
export interface PrecheckResult {
  scene: PrecheckScene;
  passed: boolean;
  reasons: string[];
  checkedAt: string;
  items: PrecheckItem[];
}
