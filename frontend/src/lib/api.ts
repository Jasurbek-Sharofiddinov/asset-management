import axios, { CanceledError } from 'axios'
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
  User,
  UserRole,
} from '../types'

const api = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
})

const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USER_KEY = 'user'

// Shared by every 401 so parallel queries trigger a single refresh.
let refreshPromise: Promise<string | null> | null = null
// Latched once the session is unrecoverable, so queued requests fail fast
// instead of each one re-attempting a refresh and re-triggering a redirect.
let sessionEnded = false

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

let onSessionEnded: (() => void) | null = null

export function setSessionEndedHandler(handler: () => void) {
  onSessionEnded = handler
}

function endSession() {
  clearStoredAuth()
  if (sessionEnded) return
  sessionEnded = true
  onSessionEnded?.()
  if (window.location.pathname !== '/login') {
    window.location.replace('/login')
  }
}

// A token the backend can never accept is worth dropping before the first
// render fans out queries. Structure only — the backend verifies signatures.
function isStructurallyValidJwt(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

const storedToken = localStorage.getItem(TOKEN_KEY)
if (storedToken !== null && !isStructurallyValidJwt(storedToken)) {
  clearStoredAuth()
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken || !isStructurallyValidJwt(refreshToken)) {
    return null
  }
  try {
    const { data } = await axios.post<LoginResponse>('/api/auth/refresh', {
      refresh_token: refreshToken,
    })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

// Request interceptor: attach Authorization Bearer token
api.interceptors.request.use(
  (config) => {
    if (sessionEnded) {
      return Promise.reject(new CanceledError('Session ended'))
    }
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: one refresh attempt per 401, then end the session
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const url = String(original?.url || '')
    // A 401 from these endpoints means the credentials themselves are bad;
    // refreshing cannot help and would recurse.
    const isAuthEndpoint =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/refresh') ||
      url.includes('/api/auth/logout')

    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isAuthEndpoint ||
      sessionEnded
    ) {
      return Promise.reject(error)
    }

    original._retry = true
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }
    const newToken = await refreshPromise
    if (!newToken) {
      endSession()
      return Promise.reject(error)
    }
    original.headers = original.headers || {}
    original.headers.Authorization = `Bearer ${newToken}`
    return api(original)
  }
)

// === Auth ===
export const authApi = {
  login: async (
    email: string,
    password: string,
    organization_slug?: string,
  ): Promise<LoginResponse> => {
    const { data } = await api.post('/api/auth/login', {
      email,
      password,
      ...(organization_slug ? { organization_slug } : {}),
    })
    return data
  },
  refresh: async (refresh_token: string): Promise<LoginResponse> => {
    const { data } = await api.post('/api/auth/refresh', { refresh_token })
    return data
  },
  logout: async (refresh_token?: string | null): Promise<void> => {
    await api.post('/api/auth/logout', { refresh_token: refresh_token || null })
  },
  me: async () => {
    const { data } = await api.get('/api/auth/me')
    return data
  },
  getTenant: async (): Promise<{ slug: string; name: string }> => {
    const { data } = await api.get('/api/auth/tenant')
    return data
  },
  lookupWorkspaces: async (
    email: string,
  ): Promise<{ items: { slug: string; name: string }[] }> => {
    const { data } = await api.post('/api/auth/workspaces', { email })
    return data
  },
  listUsers: async (): Promise<User[]> => {
    const { data } = await api.get('/api/auth/users')
    return data
  },
  createUser: async (payload: {
    full_name: string
    email: string
    password: string
    role: UserRole
  }) => {
    const { data } = await api.post('/api/auth/users', payload)
    return data
  },
  updateUser: async (
    id: string,
    payload: { full_name?: string; role?: UserRole; is_active?: boolean },
  ): Promise<User> => {
    const { data } = await api.patch(`/api/auth/users/${id}`, payload)
    return data
  },
  resetUserPassword: async (id: string, password: string): Promise<User> => {
    const { data } = await api.post(`/api/auth/users/${id}/reset-password`, {
      password,
    })
    return data
  },
  changePassword: async (current_password: string, new_password: string) => {
    const { data } = await api.post('/api/auth/change-password', {
      current_password,
      new_password,
    })
    return data
  },
  signup: async (payload: {
    organization_name: string
    contact_email: string
    admin_full_name: string
    password: string
    contact_phone?: string
    website?: string
    country?: string
    institution_type?: string
    use_case?: string
  }): Promise<{ detail: string }> => {
    const { data } = await api.post('/api/auth/signup', payload)
    return data
  },
}

// === Assets ===
export interface AssetParams {
  page?: number
  size?: number
  search?: string
  status?: string | string[]
  category?: string | string[]
  branch_id?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const assetsApi = {
  getAssets: async (params?: AssetParams): Promise<PaginatedResponse<Asset>> => {
    const { data } = await api.get('/api/assets', {
      params,
      paramsSerializer: { indexes: null },
    })
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
  getAssetQR: async (id: string): Promise<Blob> => {
    const { data } = await api.get(`/api/assets/${id}/qr`, { responseType: 'blob' })
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
  getInsights: async (locale: string = 'en'): Promise<{
    summary: string
    highlights: string[]
    risks: string[]
    recommendations: string[]
    data_snapshot?: any
    error?: string
  }> => {
    const { data } = await api.get('/api/ai/insights', { params: { locale } })
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
