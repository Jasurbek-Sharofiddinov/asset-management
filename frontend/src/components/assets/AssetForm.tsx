import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronLeft, Lightbulb } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { assetsApi, aiApi } from '../../lib/api'
import { useLanguageStore } from '../../stores/languageStore'
import type { Asset } from '../../types'
import type { TranslationKey } from '../../i18n/translations'

const makeAssetSchema = (t: (key: TranslationKey) => string) =>
  z.object({
    name: z.string().min(1, t('form.nameRequired')).max(200),
    asset_type: z.string().min(1, t('form.typeRequired')),
    serial_number: z.string().min(1, t('form.serialRequired')),
    category: z.enum(['IT', 'OFFICE', 'SECURITY', 'NETWORKING', 'PRINTING', 'SERVER', 'MOBILE', 'FURNITURE', 'OTHER']),
    brand: z.string().optional(),
    model: z.string().optional(),
    description: z.string().optional(),
    purchase_date: z.string().optional(),
    purchase_price: z.union([z.coerce.number().min(0), z.literal('').transform(() => undefined)]).optional(),
    warranty_expiry: z.string().optional(),
  })

// Raw field values (inputs are strings) differ from the parsed output because
// purchase_price is coerced/transformed.
type AssetFormValues = z.input<ReturnType<typeof makeAssetSchema>>
type AssetFormData = z.output<ReturnType<typeof makeAssetSchema>>

interface AssetFormProps {
  isOpen: boolean
  onClose: () => void
  asset?: Asset | null
}

const categoryOptions = [
  { value: 'IT', label: 'IT' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'NETWORKING', label: 'Networking' },
  { value: 'PRINTING', label: 'Printing' },
  { value: 'SERVER', label: 'Server' },
  { value: 'MOBILE', label: 'Mobile' },
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'OTHER', label: 'Other' },
]

export function AssetForm({ isOpen, onClose, asset }: AssetFormProps) {
  const [step, setStep] = useState(1)
  const queryClient = useQueryClient()
  const toast = useToast()
  const { t } = useLanguageStore()
  const assetSchema = makeAssetSchema(t)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssetFormValues, unknown, AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: asset
      ? {
          name: asset.name,
          asset_type: asset.asset_type,
          serial_number: asset.serial_number,
          category: asset.category,
          brand: asset.brand || '',
          model: asset.model || '',
          description: asset.description || '',
          purchase_date: asset.purchase_date || '',
          purchase_price: asset.purchase_price,
          warranty_expiry: asset.warranty_expiry || '',
        }
      : {
          category: 'IT',
        },
  })

  /* ── AI Category Suggestion ── */
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; confidence: number; reason: string } | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const watchName = watch('name')
  const watchBrand = watch('brand')
  const watchModel = watch('model')

  const fetchAiSuggestion = useCallback(async (name: string, brand?: string, model?: string) => {
    try {
      const result = await aiApi.recommendCategory({ name, brand, model })
      setAiSuggestion(result)
    } catch {
      // Silently ignore AI failures
    }
  }, [])

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (!watchName || watchName.length < 3) {
      setAiSuggestion(null)
      return
    }
    debounceTimer.current = setTimeout(() => {
      fetchAiSuggestion(watchName, watchBrand, watchModel)
    }, 500)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [watchName, watchBrand, watchModel, fetchAiSuggestion])

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return
    const upper = aiSuggestion.category.toUpperCase()
    const validCats = categoryOptions.map(c => c.value)
    if (validCats.includes(upper)) {
      setValue('category', upper as AssetFormValues['category'], { shouldValidate: true })
    }
    setAiSuggestion(null)
  }

  const createMutation = useMutation({
    mutationFn: (data: AssetFormData) => assetsApi.createAsset(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success(t('form.created'))
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('form.createFailed'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: AssetFormData) => assetsApi.updateAsset(asset!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', asset?.id] })
      toast.success(t('form.updated'))
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || t('form.updateFailed'))
    },
  })

  const handleClose = () => {
    reset()
    setStep(1)
    setAiSuggestion(null)
    onClose()
  }

  const onSubmit = (data: AssetFormData) => {
    if (asset) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={asset ? t('form.editAsset') : t('form.addAsset')}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Step Indicators */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              step === 1
                ? 'bg-vault-amber/10 text-vault-amber border border-vault-amber/30'
                : 'text-vault-muted-text bg-vault-muted/30 border border-vault-border'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
              1
            </span>
            Basic Info
          </button>
          <div className="h-px flex-1 bg-vault-border" />
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              step === 2
                ? 'bg-vault-amber/10 text-vault-amber border border-vault-amber/30'
                : 'text-vault-muted-text bg-vault-muted/30 border border-vault-border'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
              2
            </span>
            Details
          </button>
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <Input
              label={t('form.assetName')}
              placeholder="e.g., Dell Monitor 27inch"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label={t('form.assetType')}
              placeholder="e.g., Monitor, Laptop, Desk"
              error={errors.asset_type?.message}
              {...register('asset_type')}
            />
            <Input
              label={t('form.serialNumber')}
              placeholder="e.g., SN-2024-001"
              error={errors.serial_number?.message}
              className="font-mono text-[13px]"
              {...register('serial_number')}
            />
            <Select
              label={t('form.category')}
              options={categoryOptions}
              error={errors.category?.message}
              {...register('category')}
            />
            {aiSuggestion && (
              <button
                type="button"
                onClick={applyAiSuggestion}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-vault-muted border border-vault-border hover:bg-vault-muted/70 transition-colors text-left -mt-2"
              >
                <Lightbulb className="h-3.5 w-3.5 text-vault-amber flex-shrink-0" />
                <span className="flex-1 text-[12px] text-vault-muted-text">
                  Suggested: <span className="text-vault-text font-semibold">{aiSuggestion.category}</span>
                  <span className="font-mono text-vault-muted-text"> ({Math.round(aiSuggestion.confidence * 100)}% confidence)</span>
                  <span className="text-vault-muted-text/60"> — Click to apply</span>
                </span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('form.brand')}
                placeholder="e.g., Dell"
                {...register('brand')}
              />
              <Input
                label={t('form.model')}
                placeholder="e.g., U2723QE"
                {...register('model')}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => setStep(2)}>
                {t('form.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <Input
              label={t('form.purchaseDate')}
              type="date"
              {...register('purchase_date')}
            />
            <Input
              label={t('form.purchasePrice')}
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.purchase_price?.message}
              {...register('purchase_price')}
            />
            <Input
              label={t('form.warrantyExpiry')}
              type="date"
              {...register('warranty_expiry')}
            />
            <div>
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                {t('form.description')}
              </label>
              <textarea
                placeholder={t('form.descriptionPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 bg-vault-surface border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/20 focus:border-vault-border-focus transition-all resize-none"
                {...register('description')}
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4" />
                {t('common.back')}
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {asset ? t('form.updateAsset') : t('form.createAsset')}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
