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
} from 'lucide-react'
import { referenceApi } from '../lib/api'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { useToast } from '../components/ui/Toast'
import { useAuthStore } from '../stores/authStore'

type TabId = 'users' | 'reference' | 'system'

const departmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

const branchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().optional(),
})

const employeeSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required'),
  department_id: z.string().optional(),
  branch_id: z.string().optional(),
  position: z.string().optional(),
})

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabId>('reference')
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [showEmployeeForm, setShowEmployeeForm] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()

  const isAdmin = user?.role === 'ADMIN'

  const tabs: { id: TabId; label: string; icon: typeof Users; adminOnly?: boolean }[] = [
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
    { id: 'reference', label: 'Reference Data', icon: Building2 },
    { id: 'system', label: 'System', icon: Settings, adminOnly: true },
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
  const deptForm = useForm({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: '' },
  })

  const createDeptMutation = useMutation({
    mutationFn: (data: z.infer<typeof departmentSchema>) =>
      referenceApi.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] })
      toast.success('Department created successfully')
      setShowDeptForm(false)
      deptForm.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create department')
    },
  })

  // Branch form
  const branchForm = useForm({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: '', location: '' },
  })

  const createBranchMutation = useMutation({
    mutationFn: (data: z.infer<typeof branchSchema>) =>
      referenceApi.createBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch created successfully')
      setShowBranchForm(false)
      branchForm.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create branch')
    },
  })

  // Employee form
  const employeeForm = useForm({
    resolver: zodResolver(employeeSchema),
    defaultValues: { full_name: '', email: '', position: '' },
  })

  const createEmployeeMutation = useMutation({
    mutationFn: (data: z.infer<typeof employeeSchema>) =>
      referenceApi.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Employee created successfully')
      setShowEmployeeForm(false)
      employeeForm.reset()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create employee')
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
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <p className="text-sm text-vault-muted-text mb-4">
              User management is handled through the admin API. Below is a read-only view of registered users.
            </p>
            <div className="text-center py-12 text-vault-muted-text">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                User management features are available through the API admin endpoints.
              </p>
            </div>
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
                  Departments
                </div>
              </CardTitle>
              <Button size="sm" onClick={() => setShowDeptForm(true)}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            {departments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-vault-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-vault-muted/30 border-b border-vault-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Assets
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
                No departments yet
              </div>
            )}
          </Card>

          {/* Branches */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-vault-muted-text" />
                  Branches
                </div>
              </CardTitle>
              <Button size="sm" onClick={() => setShowBranchForm(true)}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            {branches.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-vault-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-vault-muted/30 border-b border-vault-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Assets
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
                No branches yet
              </div>
            )}
          </Card>

          {/* Employees */}
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-vault-muted-text" />
                  Employees
                </div>
              </CardTitle>
              <Button size="sm" onClick={() => setShowEmployeeForm(true)}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            {employees.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-vault-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-vault-muted/30 border-b border-vault-border">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-vault-muted-text uppercase tracking-wider">
                        Department
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
                No employees yet
              </div>
            )}
          </Card>
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && isAdmin && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">Application</p>
                <p className="text-sm text-vault-text font-medium mt-1">AssetVault v1.0.0</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">API Status</p>
                <p className="text-sm text-vault-green font-medium mt-1">Connected</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">Total Departments</p>
                <p className="text-sm text-vault-text font-medium mt-1 font-mono">{departments.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">Total Branches</p>
                <p className="text-sm text-vault-text font-medium mt-1 font-mono">{branches.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">Total Employees</p>
                <p className="text-sm text-vault-text font-medium mt-1 font-mono">{employees.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">Environment</p>
                <p className="text-sm text-vault-text font-medium mt-1">Production</p>
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
        title="Add Department"
        size="sm"
      >
        <form
          onSubmit={deptForm.handleSubmit((data) => createDeptMutation.mutate(data))}
          className="space-y-4"
        >
          <Input
            label="Department Name"
            placeholder="e.g., Information Technology"
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
              Cancel
            </Button>
            <Button type="submit" isLoading={createDeptMutation.isPending}>
              Create Department
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
        title="Add Branch"
        size="sm"
      >
        <form
          onSubmit={branchForm.handleSubmit((data) => createBranchMutation.mutate(data))}
          className="space-y-4"
        >
          <Input
            label="Branch Name"
            placeholder="e.g., Main Office"
            error={branchForm.formState.errors.name?.message}
            {...branchForm.register('name')}
          />
          <Input
            label="Location"
            placeholder="e.g., 123 Main St"
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
              Cancel
            </Button>
            <Button type="submit" isLoading={createBranchMutation.isPending}>
              Create Branch
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
        title="Add Employee"
        size="sm"
      >
        <form
          onSubmit={employeeForm.handleSubmit((data) => createEmployeeMutation.mutate(data))}
          className="space-y-4"
        >
          <Input
            label="Full Name"
            placeholder="e.g., John Doe"
            error={employeeForm.formState.errors.full_name?.message}
            {...employeeForm.register('full_name')}
          />
          <Input
            label="Email"
            placeholder="e.g., john@example.com"
            error={employeeForm.formState.errors.email?.message}
            {...employeeForm.register('email')}
          />
          <Input
            label="Position"
            placeholder="e.g., Senior Developer"
            {...employeeForm.register('position')}
          />
          <Select
            label="Department"
            placeholder="Select department (optional)"
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
            {...employeeForm.register('department_id')}
          />
          <Select
            label="Branch"
            placeholder="Select branch (optional)"
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
              Cancel
            </Button>
            <Button type="submit" isLoading={createEmployeeMutation.isPending}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
