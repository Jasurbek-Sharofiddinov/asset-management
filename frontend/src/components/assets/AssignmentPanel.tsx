import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, Building2, ArrowLeftRight } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { assignmentsApi, referenceApi } from '../../lib/api'
import type { Asset } from '../../types'

const assignSchema = z.object({
  employee_id: z.union([z.coerce.number(), z.literal('').transform(() => undefined)]).optional(),
  department_id: z.union([z.coerce.number(), z.literal('').transform(() => undefined)]).optional(),
  branch_id: z.union([z.coerce.number(), z.literal('').transform(() => undefined)]).optional(),
  notes: z.string().optional(),
})

type AssignFormData = z.infer<typeof assignSchema>

interface AssignmentPanelProps {
  isOpen: boolean
  onClose: () => void
  asset: Asset
}

export function AssignmentPanel({ isOpen, onClose, asset }: AssignmentPanelProps) {
  const [mode, setMode] = useState<'employee' | 'department'>('employee')
  const [showConfirm, setShowConfirm] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: referenceApi.getEmployees,
    enabled: isOpen,
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: referenceApi.getDepartments,
    enabled: isOpen,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: referenceApi.getBranches,
    enabled: isOpen,
  })

  const {
    register,
    handleSubmit,
    watch,
    reset,
  } = useForm<AssignFormData>({
    resolver: zodResolver(assignSchema) as any,
  })

  const formValues = watch()

  const assignMutation = useMutation({
    mutationFn: (data: AssignFormData) => assignmentsApi.assignAsset(asset.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', asset.id] })
      queryClient.invalidateQueries({ queryKey: ['assignments', asset.id] })
      toast.success('Asset assigned successfully')
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to assign asset')
    },
  })

  const returnMutation = useMutation({
    mutationFn: () => assignmentsApi.returnAsset(asset.id, { notes: formValues.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', asset.id] })
      queryClient.invalidateQueries({ queryKey: ['assignments', asset.id] })
      toast.success('Asset returned successfully')
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to return asset')
    },
  })

  const handleClose = () => {
    reset()
    setShowConfirm(false)
    onClose()
  }

  const onSubmit = (data: AssignFormData) => {
    if (showConfirm) {
      assignMutation.mutate(data)
    } else {
      setShowConfirm(true)
    }
  }

  const selectedEmployee = employees.find(
    (e) => e.id === Number(formValues.employee_id)
  )
  const selectedDepartment = departments.find(
    (d) => d.id === Number(formValues.department_id)
  )
  const selectedBranch = branches.find(
    (b) => b.id === Number(formValues.branch_id)
  )

  const isAssigned = asset.status === 'ASSIGNED'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAssigned ? 'Manage Assignment' : 'Assign Asset'}
      size="md"
    >
      <div className="space-y-6">
        {/* Asset Info */}
        <div className="p-4 rounded-lg bg-vault-black/50 border border-vault-border/50">
          <p className="text-sm font-medium text-vault-text">{asset.name}</p>
          <p className="text-xs font-[family-name:var(--font-mono)] text-vault-muted-text mt-1">
            {asset.serial_number}
          </p>
        </div>

        {isAssigned && (
          <div className="p-4 rounded-lg bg-vault-green/5 border border-vault-green/20">
            <p className="text-sm text-vault-green font-medium mb-1">Currently Assigned</p>
            <p className="text-sm text-vault-text">
              {asset.current_employee_name || asset.current_department_name || 'N/A'}
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              onClick={() => returnMutation.mutate()}
              isLoading={returnMutation.isPending}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Return Asset
            </Button>
          </div>
        )}

        {!isAssigned && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-vault-black rounded-lg border border-vault-border">
              <button
                type="button"
                onClick={() => setMode('employee')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === 'employee'
                    ? 'bg-vault-amber/10 text-vault-amber'
                    : 'text-vault-muted-text hover:text-vault-text'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                Employee
              </button>
              <button
                type="button"
                onClick={() => setMode('department')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === 'department'
                    ? 'bg-vault-amber/10 text-vault-amber'
                    : 'text-vault-muted-text hover:text-vault-text'
                }`}
              >
                <Building2 className="h-4 w-4" />
                Department
              </button>
            </div>

            {mode === 'employee' && (
              <Select
                label="Employee"
                placeholder="Select employee..."
                options={employees
                  .filter((e) => e.is_active)
                  .map((e) => ({
                    value: String(e.id),
                    label: `${e.full_name} (${e.employee_code})`,
                  }))}
                {...register('employee_id')}
              />
            )}

            {mode === 'department' && (
              <Select
                label="Department"
                placeholder="Select department..."
                options={departments.map((d) => ({
                  value: String(d.id),
                  label: d.name,
                }))}
                {...register('department_id')}
              />
            )}

            <Select
              label="Branch"
              placeholder="Select branch..."
              options={branches.map((b) => ({
                value: String(b.id),
                label: b.name,
              }))}
              {...register('branch_id')}
            />

            <div>
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                Notes
              </label>
              <textarea
                placeholder="Assignment notes..."
                rows={3}
                className="w-full px-3 py-2 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all resize-none"
                {...register('notes')}
              />
            </div>

            {/* Confirmation */}
            {showConfirm && (
              <div className="p-4 rounded-lg bg-vault-amber/5 border border-vault-amber/20">
                <p className="text-sm font-medium text-vault-amber mb-2">
                  Confirm Assignment
                </p>
                <div className="space-y-1 text-sm text-vault-text">
                  <p>
                    <span className="text-vault-muted-text">Asset:</span> {asset.name}
                  </p>
                  {selectedEmployee && (
                    <p>
                      <span className="text-vault-muted-text">Employee:</span>{' '}
                      {selectedEmployee.full_name}
                    </p>
                  )}
                  {selectedDepartment && (
                    <p>
                      <span className="text-vault-muted-text">Department:</span>{' '}
                      {selectedDepartment.name}
                    </p>
                  )}
                  {selectedBranch && (
                    <p>
                      <span className="text-vault-muted-text">Branch:</span>{' '}
                      {selectedBranch.name}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              {showConfirm && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowConfirm(false)}
                >
                  Back
                </Button>
              )}
              <Button type="submit" isLoading={assignMutation.isPending}>
                {showConfirm ? 'Confirm Assignment' : 'Assign'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
