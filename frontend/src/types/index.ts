// Enums
export type AssetStatus = 'REGISTERED' | 'ASSIGNED' | 'IN_REPAIR' | 'LOST' | 'WRITTEN_OFF'
export type AssetCategory = 'IT' | 'OFFICE' | 'SECURITY' | 'NETWORKING' | 'PRINTING' | 'SERVER' | 'MOBILE' | 'FURNITURE' | 'OTHER'
export type UserRole = 'ADMIN' | 'MANAGER' | 'AUDITOR' | 'VIEWER'
export type AuditAction = string

// Auth
export interface OrganizationBrief {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  trial_ends_at?: string | null
}

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  must_change_password?: boolean
  last_login?: string | null
  created_at?: string
  organization_id?: string
  organization?: OrganizationBrief | null
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  role: UserRole
  user_id: string
  full_name: string
  email: string
  must_change_password: boolean
}

export interface Asset {
  id: string
  name: string
  asset_type: string
  serial_number: string
  category: AssetCategory
  status: AssetStatus
  brand?: string
  model?: string
  description?: string
  purchase_date?: string
  purchase_price?: string | number
  warranty_expiry?: string
  image_url?: string
  qr_code_url?: string
  created_at: string
  updated_at: string
  created_by?: string
  deleted_at?: string
  // Populated from current assignment
  current_assignment?: Assignment
  current_employee_name?: string
  current_department_name?: string
  current_branch_name?: string
}

export interface AssetCreate {
  name: string
  asset_type: string
  serial_number: string
  category: AssetCategory
  brand?: string
  model?: string
  description?: string
  purchase_date?: string
  purchase_price?: number
  warranty_expiry?: string
}

export interface AssetUpdate {
  name?: string
  asset_type?: string
  category?: AssetCategory
  brand?: string
  model?: string
  description?: string
  purchase_date?: string
  purchase_price?: number
  warranty_expiry?: string
}

export interface Assignment {
  id: string
  asset_id: string
  asset_name?: string
  employee_id?: string
  employee_name?: string
  department_id?: string
  department_name?: string
  branch_id?: string
  branch_name?: string
  assigned_by?: string
  assigned_at: string
  returned_at?: string
  return_reason?: string
  is_active: boolean
  notes?: string
}

export interface AssignRequest {
  employee_id?: string
  department_id?: string
  branch_id?: string
  notes?: string
}

export interface ReturnRequest {
  return_reason?: string
}

export interface AuditLog {
  id: number
  entity_type: string
  entity_id: string
  action: string
  actor_id?: string
  actor_name?: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  reason?: string
  ip_address?: string
  occurred_at: string
}

export interface AuditListResponse {
  items: AuditLog[]
  total: number
  page: number
  pages: number
}

export interface Employee {
  id: string
  full_name: string
  email: string
  department_id?: string
  department_name?: string
  branch_id?: string
  branch_name?: string
  position?: string
}

export interface Department {
  id: string
  name: string
  asset_count?: number
}

export interface Branch {
  id: string
  name: string
  location?: string
  asset_count?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pages: number
}

// Analytics types
export interface AnalyticsOverview {
  total_assets: number
  total_value: number
  assigned_count: number
  assigned_percentage: number
  in_repair_count: number
  lost_count: number
  written_off_count: number
  registered_count: number
  status_distribution: Record<string, number>
  category_distribution: Record<string, number>
}

export interface ValueOverTime {
  date: string
  value: number
}

export interface StatusOverTime {
  date: string
  REGISTERED: number
  ASSIGNED: number
  IN_REPAIR: number
  LOST: number
  WRITTEN_OFF: number
}

export interface DepartmentAllocation {
  department: string
  count: number
  value: number
}

export interface AgeDistribution {
  range: string
  count: number
}

export interface RepairFrequency {
  asset_id: string
  asset_name: string
  serial_number: string
  repair_count: number
}

export interface WarrantyExpiring {
  id: string
  name: string
  serial_number: string
  warranty_expiry: string
  days_remaining: number
}
