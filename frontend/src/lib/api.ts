import axios from 'axios'
import type {
  Asset,
  AssetCreate,
  AssetUpdate,
  AssignRequest,
  ReturnRequest,
  AuditListResponse,
  AnalyticsOverview,
  ValueOverTime,
  StatusOverTime,
  DepartmentAllocation,
  AgeDistribution,
  RepairFrequency,
  WarrantyExpiring,
  Employee,
  Department,
  Branch,
  PaginatedResponse,
  LoginResponse,
} from '../types'

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach Authorization Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// === Auth ===
export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/api/auth/login', { email, password })
    return data
  },
  refresh: async (): Promise<LoginResponse> => {
    const { data } = await api.post('/api/auth/refresh')
    return data
  },
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout')
  },
  me: async () => {
    const { data } = await api.get('/api/auth/me')
    return data
  },
  register: async (full_name: string, email: string, password: string): Promise<LoginResponse> => {
    const { data } = await api.post('/api/auth/register', { full_name, email, password })
    return data
  },
}

// === Assets ===
export interface AssetParams {
  page?: number
  size?: number
  search?: string
  status?: string
  category?: string
  branch_id?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const assetsApi = {
  getAssets: async (params?: AssetParams): Promise<PaginatedResponse<Asset>> => {
    const { data } = await api.get('/api/assets', { params })
    return data
  },
  getAsset: async (id: string): Promise<Asset> => {
    const { data } = await api.get(`/api/assets/${id}`)
    return data
  },
  createAsset: async (assetData: AssetCreate): Promise<Asset> => {
    const { data } = await api.post('/api/assets', assetData)
    return data
  },
  updateAsset: async (id: string, assetData: AssetUpdate): Promise<Asset> => {
    const { data } = await api.put(`/api/assets/${id}`, assetData)
    return data
  },
  deleteAsset: async (id: string): Promise<void> => {
    await api.delete(`/api/assets/${id}`)
  },
  changeAssetStatus: async (id: string, new_status: string, reason?: string): Promise<Asset> => {
    const { data } = await api.patch(`/api/assets/${id}/status`, { new_status, reason })
    return data
  },
  getAssetQR: async (id: string): Promise<string> => {
    const { data } = await api.get(`/api/assets/${id}/qr`)
    return data
  },
  getAssetHistory: async (id: string): Promise<any[]> => {
    const { data } = await api.get(`/api/assets/${id}/history`)
    return data
  },
}

// === Assignments ===
export const assignmentsApi = {
  assignAsset: async (assetId: string, assignData: AssignRequest): Promise<any> => {
    const { data } = await api.post(`/api/assets/${assetId}/assign`, assignData)
    return data
  },
  returnAsset: async (assetId: string, returnData: ReturnRequest): Promise<any> => {
    const { data } = await api.post(`/api/assets/${assetId}/return`, returnData)
    return data
  },
  getAssignments: async (assetId: string): Promise<any[]> => {
    const { data } = await api.get(`/api/assets/${assetId}/assignments`)
    return data
  },
}

// === Audit ===
export interface AuditParams {
  page?: number
  size?: number
  entity_type?: string
  action?: string
  date_from?: string
  date_to?: string
}

export const auditApi = {
  getAuditLogs: async (params?: AuditParams): Promise<AuditListResponse> => {
    const { data } = await api.get('/api/audit', { params })
    return data
  },
  exportAuditCSV: async (): Promise<Blob> => {
    const { data } = await api.get('/api/audit/export', { responseType: 'blob' })
    return data
  },
}

// === Analytics ===
export const analyticsApi = {
  getOverview: async (params?: { branch_id?: string }): Promise<AnalyticsOverview> => {
    const { data } = await api.get('/api/analytics/overview', { params })
    return data
  },
  getValueOverTime: async (): Promise<ValueOverTime[]> => {
    const { data } = await api.get('/api/analytics/value-over-time')
    return data
  },
  getStatusOverTime: async (): Promise<StatusOverTime[]> => {
    const { data } = await api.get('/api/analytics/status-over-time')
    return data
  },
  getDepartmentAllocation: async (params?: { branch_id?: string }): Promise<DepartmentAllocation[]> => {
    const { data } = await api.get('/api/analytics/department-allocation', { params })
    return data
  },
  getAgeDistribution: async (): Promise<AgeDistribution[]> => {
    const { data } = await api.get('/api/analytics/age-distribution')
    return data
  },
  getRepairFrequency: async (): Promise<RepairFrequency[]> => {
    const { data } = await api.get('/api/analytics/repair-frequency')
    return data
  },
  getWarrantyExpiring: async (): Promise<WarrantyExpiring[]> => {
    const { data } = await api.get('/api/analytics/warranty-expiring')
    return data
  },
}

// === Reference Data ===
export const referenceApi = {
  getEmployees: async (): Promise<Employee[]> => {
    const { data } = await api.get('/api/employees')
    return data
  },
  getDepartments: async (): Promise<Department[]> => {
    const { data } = await api.get('/api/departments')
    return data
  },
  getBranches: async (): Promise<Branch[]> => {
    const { data } = await api.get('/api/branches')
    return data
  },
  createEmployee: async (employeeData: Partial<Employee>): Promise<Employee> => {
    const { data } = await api.post('/api/employees', employeeData)
    return data
  },
  createDepartment: async (deptData: Partial<Department>): Promise<Department> => {
    const { data } = await api.post('/api/departments', deptData)
    return data
  },
  createBranch: async (branchData: Partial<Branch>): Promise<Branch> => {
    const { data } = await api.post('/api/branches', branchData)
    return data
  },
}

// === AI ===
export const aiApi = {
  recommendCategory: async (params: {
    name: string
    brand?: string
    model?: string
    asset_type?: string
    description?: string
  }): Promise<{ category: string; confidence: number; reason: string }> => {
    const { data } = await api.post('/api/ai/recommend-category', null, { params })
    return data
  },
  getInsights: async (): Promise<{
    summary: string
    highlights: string[]
    risks: string[]
    recommendations: string[]
    data_snapshot?: any
    error?: string
  }> => {
    const { data } = await api.get('/api/ai/insights')
    return data
  },
  getPredictions: async (): Promise<{
    predicted_purchases: Array<{
      category: string
      quantity: number
      reason: string
      urgency: string
      estimated_budget: number
    }>
    maintenance_forecast: Array<{
      description: string
      timeline: string
      affected_count: number
    }>
    staffing_impact: string
    budget_outlook: string
    based_on?: any
    error?: string
  }> => {
    const { data } = await api.get('/api/ai/predictions')
    return data
  },
}

export default api
