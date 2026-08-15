import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Users,
  Building2,
  GitBranch,
  UserPlus,
  Plus,
  Settings,
  RefreshCw,
} from 'lucide-react'
import { authApi, referenceApi } from '../lib/api'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { useAuthStore } from '../stores/authStore'
import { useLanguageStore } from '../stores/languageStore'
import { tenantOrigin } from '../lib/config'
import type { TranslationKey } from '../i18n/translations'
import type { User, UserRole } from '../types'

type TabId = 'users' | 'reference' | 'system'
type Translate = (key: TranslationKey) => string

function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const digits = '23456789'
  const pick = (src: string, n: number) =>
    Array.from({ length: n }, () => src[Math.floor(Math.random() * src.length)]).join('')
  return `${pick(upper, 2)}${pick(lower, 4)}${pick(digits, 3)}`
}

const makeTempPasswordSchema = (t: Translate) =>
  z.string().min(4, t('validation.min4Chars'))

const makeCreateUserSchema = (t: Translate) =>
  z
    .object({
      full_name: z.string().min(1, t('validation.nameRequired')),
      email: z.string().email(t('validation.invalidEmail')),
      role: z.enum(['ADMIN', 'MANAGER', 'VIEWER', 'AUDITOR']),
      password: makeTempPasswordSchema(t),
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, {
      message: t('validation.passwordsMismatch'),
      path: ['confirm'],
    })

const makeResetPasswordSchema = (t: Translate) =>
  z
    .object({
      password: makeTempPasswordSchema(t),
      confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, {
      message: t('validation.passwordsMismatch'),
      path: ['confirm'],
    })

const makeDepartmentSchema = (t: Translate) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
  })

const makeBranchSchema = (t: Translate) =>
  z.object({
    name: z.string().min(1, t('validation.nameRequired')),
    location: z.string().optional(),
  })

const makeEmployeeSchema = (t: Translate) =>
  z.object({
    full_name: z.string().min(1, t('validation.nameRequired')),
    email: z.string().min(1, t('validation.emailRequired')),
    department_id: z.string().optional(),
    branch_id: z.string().optional(),
    position: z.string().optional(),
  })

type CreateUserFormData = z.infer<ReturnType<typeof makeCreateUserSchema>>
type ResetPasswordFormData = z.infer<ReturnType<typeof makeResetPasswordSchema>>
type DepartmentFormData = z.infer<ReturnType<typeof makeDepartmentSchema>>
type BranchFormData = z.infer<ReturnType<typeof makeBranchSchema>>
type EmployeeFormData = z.infer<ReturnType<typeof makeEmployeeSchema>>

export default function SettingsPage() {
  const { t } = useLanguageStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const [activeTab, setActiveTab] = useState<TabId>(isAdmin ? 'users' : 'reference')
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const queryClient = useQueryClient()
  const toast = useToast()
  const createUserSchema = makeCreateUserSchema(t)
  const resetPasswordSchema = makeResetPasswordSchema(t)
  const departmentSchema = makeDepartmentSchema(t)
  const branchSchema = makeBranchSchema(t)
  const employeeSchema = makeEmployeeSchema(t)

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'ADMIN', label: t('settings.roleAdmin') },
    { value: 'MANAGER', label: t('settings.roleManager') },
    { value: 'VIEWER', label: t('settings.roleViewer') },
    { value: 'AUDITOR', label: t('settings.roleAuditor') },
  ]

  const tabs: { id: TabId; label: string; icon: typeof Users; adminOnly?: boolean }[] = [
    { id: 'users', label: t('settings.tabUsers'), icon: Users, adminOnly: true },
    { id: 'reference', label: t('settings.tabReference'), icon: Building2 },
    { id: 'system', label: t('settings.tabSystem'), icon: Settings, adminOnly: true },
  ]

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin)

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees'],
    queryFn: referenceApi.getEmployees,
  })

  const { data: departments = [], isLoading: isLoadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: referenceApi.getDepartments,
  })

  const { data: branches = [], isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: referenceApi.getBranches,
  })

  // Department form
  const deptForm = useForm<DepartmentFormData>({
    resolver: (values, ctx, opts) => zodResolver(departmentSchema)(values, ctx, opts),
    defaultValues: { name: '' },
  })

  const createDeptMutation = useMutation({
    mutationFn: (data: z.infer<typeof departmentSchema>) =>
      referenceApi.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success(t('settings.deptCreated'))
      setShowDeptForm(false)
      deptForm.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('settings.deptCreateFailed'))
    },
  })

  // Branch form
  const branchForm = useForm<BranchFormData>({
    resolver: (values, ctx, opts) => zodResolver(branchSchema)(values, ctx, opts),
    defaultValues: { name: '', location: '' },
  })

  const createBranchMutation = useMutation({
    mutationFn: (data: z.infer<typeof branchSchema>) =>
      referenceApi.createBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success(t('settings.branchCreated'))
      setShowBranchForm(false)
      branchForm.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('settings.branchCreateFailed'))
    },
  })

  // Employee form
  const employeeForm = useForm<EmployeeFormData>({
    resolver: (values, ctx, opts) => zodResolver(employeeSchema)(values, ctx, opts),
    defaultValues: { full_name: '', email: '', position: '', department_id: '', branch_id: '' },
  })

  const createEmployeeMutation = useMutation({
    mutationFn: (data: z.infer<typeof employeeSchema>) =>
      referenceApi.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success(t('settings.employeeCreated'))
      setShowEmployeeForm(false)
      employeeForm.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('settings.employeeCreateFailed'))
    },
  })

  const { data: orgUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['org-users'],
    queryFn: authApi.listUsers,
    enabled: isAdmin,
  })

  const createUserForm = useForm<CreateUserFormData>({
    resolver: (values, ctx, opts) => zodResolver(createUserSchema)(values, ctx, opts),
    defaultValues: {
      full_name: '',
      email: '',
      role: 'VIEWER' as UserRole,
      password: generateTempPassword(),
      confirm: '',
    },
  })

  const resetForm = useForm<ResetPasswordFormData>({
    resolver: (values, ctx, opts) => zodResolver(resetPasswordSchema)(values, ctx, opts),
    defaultValues: { password: generateTempPassword(), confirm: '' },
  })

  const createUserMutation = useMutation({
    mutationFn: (data: z.infer<typeof createUserSchema>) =>
      authApi.createUser({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        role: data.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-users'] })
      toast.success(t('settings.userCreated'))
      setShowCreateUser(false)
      createUserForm.reset({
        full_name: '',
        email: '',
        role: 'VIEWER',
        password: generateTempPassword(),
        confirm: '',
      })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('settings.userCreateFailed'))
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: { role?: UserRole; is_active?: boolean }
    }) => authApi.updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-users'] })
      toast.success(t('settings.userUpdated'))
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('settings.userUpdateFailed'))
    },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      authApi.resetUserPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-users'] })
      toast.success(t('settings.passwordReset'))
      setResetTarget(null)
      resetForm.reset({ password: generateTempPassword(), confirm: '' })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('settings.passwordResetFailed'))
    },
  })

  const isLoading = isLoadingEmployees && isLoadingDepts && isLoadingBranches
  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-vault-muted rounded-lg border border-vault-border w-fit">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-vault-text shadow-sm border border-vault-border'
                : 'text-vault-muted-text hover:text-vault-text'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && isAdmin && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.users')}</CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  const generated = generateTempPassword()
                  createUserForm.reset({
                    full_name: '',
                    email: '',
                    role: 'VIEWER',
                    password: generated,
                    confirm: generated,
                  })
                  setShowCreateUser(true)
                }}
              >
                <Plus className="h-4 w-4" />
                {t('settings.addUser')}
              </Button>
            </CardHeader>
            <p className="text-sm text-vault-muted-text mb-4">
              {t('settings.usersHint')}
            </p>
            {isLoadingUsers ? (
              <p className="text-sm text-vault-muted-text py-8 text-center">{t('settings.loading')}</p>
            ) : orgUsers.length === 0 ? (
              <div className="text-center py-12 text-vault-muted-text">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('settings.noUsers')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-vault-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-vault-muted/30 border-b border-vault-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colName')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colEmail')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colRole')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colStatus')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colLastLogin')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colActions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgUsers.map((row) => {
                      const isSelf = row.id === user?.id
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-vault-border/30 hover:bg-vault-muted/10"
                        >
                          <td className="px-4 py-3 text-vault-text font-medium">
                            {row.full_name}
                            {isSelf && (
                              <span className="ml-2 text-[11px] text-muted">{t('settings.you')}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[13px] text-vault-muted-text">
                            {row.email}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={row.role}
                              disabled={isSelf || updateUserMutation.isPending}
                              onChange={(e) =>
                                updateUserMutation.mutate({
                                  id: row.id,
                                  payload: { role: e.target.value as UserRole },
                                })
                              }
                              className="h-8 px-2 rounded-md border border-vault-border bg-white text-[13px] disabled:opacity-50"
                            >
                              {roleOptions.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded ${
                                  row.is_active
                                    ? 'bg-ok-soft text-ok'
                                    : 'bg-danger-soft text-danger'
                                }`}
                              >
                                {row.is_active ? t('settings.active') : t('settings.inactive')}
                              </span>
                              {row.must_change_password && (
                                <span className="text-[11px] px-2 py-0.5 rounded bg-warn-soft text-warn">
                                  {t('settings.mustChange')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-vault-muted-text">
                            {row.last_login
                              ? new Date(row.last_login).toLocaleString()
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {!isSelf && (
                              <>
                                <button
                                  type="button"
                                  disabled={updateUserMutation.isPending}
                                  onClick={() =>
                                    updateUserMutation.mutate({
                                      id: row.id,
                                      payload: { is_active: !row.is_active },
                                    })
                                  }
                                  className="text-[13px] text-body hover:text-ink mr-3"
                                >
                                  {row.is_active ? t('settings.deactivate') : t('settings.activate')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const generated = generateTempPassword()
                                    resetForm.reset({
                                      password: generated,
                                      confirm: generated,
                                    })
                                    setResetTarget(row)
                                  }}
                                  className="text-[13px] text-brand hover:underline"
                                >
                                  {t('settings.resetPassword')}
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Reference Data Tab */}
      {activeTab === 'reference' && (
        <div className="space-y-6">
          {/* Departments */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-vault-muted-text" />
                  {t('settings.departments')}
                </div>
              </CardTitle>
              <Button size="sm" onClick={() => setShowDeptForm(true)}>
                <Plus className="h-4 w-4" />
                {t('settings.add')}
              </Button>
            </CardHeader>
            {departments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-vault-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-vault-muted/30 border-b border-vault-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colName')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colAssets')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept.id} className="border-b border-vault-border/30 hover:bg-vault-muted/10">
                        <td className="px-4 py-3 text-vault-text font-medium">{dept.name}</td>
                        <td className="px-4 py-3 text-right text-vault-text">{dept.asset_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-vault-muted-text text-sm">
                {t('settings.noDepartments')}
              </div>
            )}
          </Card>

          {/* Branches */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-vault-muted-text" />
                  {t('settings.branches')}
                </div>
              </CardTitle>
              <Button size="sm" onClick={() => setShowBranchForm(true)}>
                <Plus className="h-4 w-4" />
                {t('settings.add')}
              </Button>
            </CardHeader>
            {branches.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-vault-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-vault-muted/30 border-b border-vault-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colName')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colLocation')}
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colAssets')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((branch) => (
                      <tr key={branch.id} className="border-b border-vault-border/30 hover:bg-vault-muted/10">
                        <td className="px-4 py-3 text-vault-text font-medium">{branch.name}</td>
                        <td className="px-4 py-3 text-vault-muted-text">{branch.location || '-'}</td>
                        <td className="px-4 py-3 text-right text-vault-text">{branch.asset_count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-vault-muted-text text-sm">
                {t('settings.noBranches')}
              </div>
            )}
          </Card>

          {/* Employees */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-vault-muted-text" />
                  {t('settings.employees')}
                </div>
              </CardTitle>
              <Button size="sm" onClick={() => setShowEmployeeForm(true)}>
                <Plus className="h-4 w-4" />
                {t('settings.add')}
              </Button>
            </CardHeader>
            {employees.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-vault-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-vault-muted/30 border-b border-vault-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colName')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colEmail')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colPosition')}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        {t('settings.colDepartment')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-b border-vault-border/30 hover:bg-vault-muted/10">
                        <td className="px-4 py-3 text-vault-text font-medium">{emp.full_name}</td>
                        <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[13px] text-vault-muted-text">
                          {emp.email}
                        </td>
                        <td className="px-4 py-3 text-vault-muted-text">{emp.position || '-'}</td>
                        <td className="px-4 py-3 text-vault-muted-text">{emp.department_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-vault-muted-text text-sm">
                {t('settings.noEmployees')}
              </div>
            )}
            <p className="mt-4 text-[12.5px] text-vault-muted-text leading-relaxed">
              {t('settings.employeesHint')}
            </p>
          </Card>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && isAdmin && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.systemConfig')}</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border sm:col-span-2">
                <p className="text-xs text-vault-muted-text">Workspace URL</p>
                <p className="text-sm text-vault-text font-medium mt-1 font-mono">
                  {user?.organization?.slug
                    ? tenantOrigin(user.organization.slug)
                    : window.location.origin}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('settings.application')}</p>
                <p className="text-sm text-vault-text font-medium mt-1">AssetVault v1.0.0</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('settings.apiStatus')}</p>
                <p className="text-sm text-vault-green font-medium mt-1">{t('settings.connected')}</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('settings.totalDepartments')}</p>
                <p className="text-sm text-vault-text font-medium mt-1 font-mono">{departments.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('settings.totalBranches')}</p>
                <p className="text-sm text-vault-text font-medium mt-1 font-mono">{branches.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('settings.totalEmployees')}</p>
                <p className="text-sm text-vault-text font-medium mt-1 font-mono">{employees.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('settings.environment')}</p>
                <p className="text-sm text-vault-text font-medium mt-1">{t('settings.production')}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Department Form Modal */}
      <Modal
        isOpen={showDeptForm}
        onClose={() => {
          setShowDeptForm(false)
          deptForm.reset()
        }}
        title={t('settings.addDepartment')}
        size="sm"
      >
        <form
          onSubmit={deptForm.handleSubmit((data) => createDeptMutation.mutate(data))}
          className="space-y-4"
        >
          <Input
            label={t('settings.departmentName')}
            placeholder={t('settings.departmentNamePlaceholder')}
            error={deptForm.formState.errors.name?.message}
            {...deptForm.register('name')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setShowDeptForm(false)
                deptForm.reset()
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createDeptMutation.isPending}>
              {t('settings.createDepartment')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Branch Form Modal */}
      <Modal
        isOpen={showBranchForm}
        onClose={() => {
          setShowBranchForm(false)
          branchForm.reset()
        }}
        title={t('settings.addBranch')}
        size="sm"
      >
        <form
          onSubmit={branchForm.handleSubmit((data) => createBranchMutation.mutate(data))}
          className="space-y-4"
        >
          <Input
            label={t('settings.branchName')}
            placeholder={t('settings.branchNamePlaceholder')}
            error={branchForm.formState.errors.name?.message}
            {...branchForm.register('name')}
          />
          <Input
            label={t('settings.location')}
            placeholder={t('settings.locationPlaceholder')}
            {...branchForm.register('location')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setShowBranchForm(false)
                branchForm.reset()
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createBranchMutation.isPending}>
              {t('settings.createBranch')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Employee Form Modal */}
      <Modal
        isOpen={showEmployeeForm}
        onClose={() => {
          setShowEmployeeForm(false)
          employeeForm.reset()
        }}
        title={t('settings.addEmployee')}
        size="sm"
      >
        <form
          onSubmit={employeeForm.handleSubmit((data) => createEmployeeMutation.mutate(data))}
          className="space-y-4"
        >
          <Input
            label={t('settings.fullName')}
            placeholder={t('settings.fullNamePlaceholder')}
            error={employeeForm.formState.errors.full_name?.message}
            {...employeeForm.register('full_name')}
          />
          <Input
            label={t('settings.email')}
            placeholder={t('settings.emailPlaceholder')}
            error={employeeForm.formState.errors.email?.message}
            {...employeeForm.register('email')}
          />
          <Input
            label={t('settings.position')}
            placeholder={t('settings.positionPlaceholder')}
            {...employeeForm.register('position')}
          />
          <Select
            label={t('settings.colDepartment')}
            placeholder={t('settings.selectDepartment')}
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
            {...employeeForm.register('department_id')}
          />
          <Select
            label={t('assets.branch')}
            placeholder={t('settings.selectBranch')}
            options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
            {...employeeForm.register('branch_id')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setShowEmployeeForm(false)
                employeeForm.reset()
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createEmployeeMutation.isPending}>
              {t('settings.createEmployee')}
            </Button>
          </div>
        </form>
      </Modal>
      {/* Create user */}
      <Modal
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        title={t('settings.addUser')}
        size="sm"
      >
        <form
          onSubmit={createUserForm.handleSubmit((data) => createUserMutation.mutate(data))}
          className="space-y-4"
        >
          <Input
            label={t('settings.fullName')}
            error={createUserForm.formState.errors.full_name?.message}
            {...createUserForm.register('full_name')}
          />
          <Input
            label={t('settings.email')}
            type="email"
            error={createUserForm.formState.errors.email?.message}
            {...createUserForm.register('email')}
          />
          <Select
            label={t('settings.colRole')}
            options={roleOptions}
            {...createUserForm.register('role')}
          />
          <div className="flex items-end gap-2">
            <Input
              label={t('settings.tempPassword')}
              error={createUserForm.formState.errors.password?.message}
              {...createUserForm.register('password')}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mb-0.5 shrink-0"
              onClick={() => {
                const generated = generateTempPassword()
                createUserForm.setValue('password', generated)
                createUserForm.setValue('confirm', generated)
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            label={t('settings.confirmPassword')}
            error={createUserForm.formState.errors.confirm?.message}
            {...createUserForm.register('confirm')}
          />
          <p className="text-xs text-vault-muted-text">
            {t('settings.tempPasswordHint')}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowCreateUser(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={createUserMutation.isPending}>
              {t('settings.createUser')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reset password */}
      <Modal
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={
          resetTarget
            ? `${t('settings.resetPasswordTitle')} — ${resetTarget.full_name}`
            : t('settings.resetPasswordTitle')
        }
        size="sm"
      >
        <form
          onSubmit={resetForm.handleSubmit((data) => {
            if (!resetTarget) return
            resetPasswordMutation.mutate({ id: resetTarget.id, password: data.password })
          })}
          className="space-y-4"
        >
          <div className="flex items-end gap-2">
            <Input
              label={t('settings.tempPassword')}
              error={resetForm.formState.errors.password?.message}
              {...resetForm.register('password')}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const generated = generateTempPassword()
                resetForm.setValue('password', generated)
                resetForm.setValue('confirm', generated)
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            label={t('settings.confirmPassword')}
            error={resetForm.formState.errors.confirm?.message}
            {...resetForm.register('confirm')}
          />
          <p className="text-xs text-vault-muted-text">
            {t('settings.tempPasswordHintReset')}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => setResetTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={resetPasswordMutation.isPending}>
              {t('settings.resetPassword')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
