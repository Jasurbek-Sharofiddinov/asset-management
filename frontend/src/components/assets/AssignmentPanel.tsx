import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, Building2, ArrowLeftRight } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { assignmentsApi, referenceApi } from '../../lib/api'
import { createAssignSchema, type AssignFormData } from '../../lib/assignSchema'
import { useLanguageStore } from '../../stores/languageStore'
import type { Asset } from '../../types'

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
  const { t, locale } = useLanguageStore()

  const assignSchema = useMemo(
    () => createAssignSchema(t('validation.branchRequired')),
    [t, locale],
  )

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
    setValue,
    formState: { errors },
  } = useForm<AssignFormData>({
    resolver: async (values, context, options) =>
      zodResolver(assignSchema)(values, context, options),
  })

  const formValues = watch()
  const employeeId = formValues.employee_id

  useEffect(() => {
    if (!employeeId) return
    const emp = employees.find((e) => String(e.id) === String(employeeId))
    if (emp?.branch_id) {
      setValue('branch_id', emp.branch_id)
    }
  }, [employeeId, employees, setValue])

  const assignMutation = useMutation({
    mutationFn: (data: AssignFormData) => assignmentsApi.assignAsset(asset.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', asset.id] })
      queryClient.invalidateQueries({ queryKey: ['assignments', asset.id] })
      toast.success(t('assign.success'))
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('assign.failed'))
    },
  })

  const returnMutation = useMutation({
    mutationFn: () => assignmentsApi.returnAsset(asset.id, { return_reason: formValues.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', asset.id] })
      queryClient.invalidateQueries({ queryKey: ['assignments', asset.id] })
      toast.success(t('assign.returnSuccess'))
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('assign.returnFailed'))
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
    (e) => e.id === formValues.employee_id
  )
  const selectedDepartment = departments.find(
    (d) => d.id === formValues.department_id
  )
  const selectedBranch = branches.find(
    (b) => b.id === formValues.branch_id
  )

  const isAssigned = asset.status === 'ASSIGNED'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isAssigned ? t('assign.manageTitle') : t('assign.title')}
      size="md"
    >
      <div className="space-y-6">
        <div className="p-4 rounded-lg bg-vault-black/50 border border-vault-border/50">
          <p className="text-sm font-medium text-vault-text">{asset.name}</p>
          <p className="text-xs font-[family-name:var(--font-mono)] text-vault-muted-text mt-1">
            {asset.serial_number}
          </p>
        </div>

        {isAssigned && (
          <div className="p-4 rounded-lg bg-vault-green/5 border border-vault-green/20">
            <p className="text-sm text-vault-green font-medium mb-1">{t('assign.currentlyAssigned')}</p>
            <p className="text-sm text-vault-text">
              {asset.current_employee_name || asset.current_department_name || t('common.noData')}
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              onClick={() => returnMutation.mutate()}
              isLoading={returnMutation.isPending}
            >
              <ArrowLeftRight className="h-4 w-4" />
              {t('assign.returnAsset')}
            </Button>
          </div>
        )}

        {!isAssigned && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                {t('assign.employee')}
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
                {t('assign.department')}
              </button>
            </div>

            {mode === 'employee' && (
              <Select
                label={t('assign.employee')}
                placeholder={t('assign.selectEmployee')}
                options={employees
                  .map((e) => ({
                    value: String(e.id),
                    label: `${e.full_name} (${e.email})`,
                  }))}
                {...register('employee_id')}
              />
            )}

            {mode === 'department' && (
              <Select
                label={t('assign.department')}
                placeholder={t('assign.selectDepartment')}
                options={departments.map((d) => ({
                  value: String(d.id),
                  label: d.name,
                }))}
                {...register('department_id')}
              />
            )}

            <Select
              label={t('assign.branch')}
              placeholder={t('assign.selectBranch')}
              error={errors.branch_id?.message}
              options={branches.map((b) => ({
                value: String(b.id),
                label: b.name,
              }))}
              {...register('branch_id')}
            />

            <div>
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                {t('assign.notes')}
              </label>
              <textarea
                placeholder={t('assign.notesPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all resize-none"
                {...register('notes')}
              />
            </div>

            {showConfirm && (
              <div className="p-4 rounded-lg bg-vault-amber/5 border border-vault-amber/20">
                <p className="text-sm font-medium text-vault-amber mb-2">
                  {t('assign.confirmTitle')}
                </p>
                <div className="space-y-1 text-sm text-vault-text">
                  <p>
                    <span className="text-vault-muted-text">{t('detail.name')}:</span> {asset.name}
                  </p>
                  {selectedEmployee && (
                    <p>
                      <span className="text-vault-muted-text">{t('assign.employee')}:</span>{' '}
                      {selectedEmployee.full_name}
                    </p>
                  )}
                  {selectedDepartment && (
                    <p>
                      <span className="text-vault-muted-text">{t('assign.department')}:</span>{' '}
                      {selectedDepartment.name}
                    </p>
                  )}
                  {selectedBranch && (
                    <p>
                      <span className="text-vault-muted-text">{t('assign.branch')}:</span>{' '}
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
                  {t('common.back')}
                </Button>
              )}
              <Button type="submit" isLoading={assignMutation.isPending}>
                {showConfirm ? t('assign.confirmTitle') : t('detail.assign')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
