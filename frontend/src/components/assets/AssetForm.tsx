import { useState, useEffect, useRef, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { assetsApi, aiApi } from '../../lib/api'
import type { Asset } from '../../types'

const assetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  asset_type: z.string().min(1, 'Type is required'),
  serial_number: z.string().min(1, 'Serial number is required'),
  category: z.enum(['FURNITURE', 'ELECTRONICS', 'VEHICLE', 'EQUIPMENT', 'SOFTWARE', 'OTHER']),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_price: z.union([z.coerce.number().min(0), z.literal('').transform(() => undefined)]).optional(),
  warranty_expiry: z.string().optional(),
})

type AssetFormData = z.infer<typeof assetSchema>

interface AssetFormProps {
  isOpen: boolean
  onClose: () => void
  asset?: Asset | null
}

const categoryOptions = [
  { value: 'FURNITURE', label: 'Furniture' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'VEHICLE', label: 'Vehicle' },
  { value: 'EQUIPMENT', label: 'Equipment' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'OTHER', label: 'Other' },
]

export function AssetForm({ isOpen, onClose, asset }: AssetFormProps) {
  const [step, setStep] = useState(1)
  const queryClient = useQueryClient()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema) as any,
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
          category: 'ELECTRONICS',
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
      setValue('category', upper as AssetFormData['category'], { shouldValidate: true })
    }
    setAiSuggestion(null)
  }

  const createMutation = useMutation({
    mutationFn: (data: AssetFormData) => assetsApi.createAsset(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success('Asset created successfully')
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to create asset')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: AssetFormData) => assetsApi.updateAsset(asset!.id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', asset?.id] })
      toast.success('Asset updated successfully')
      handleClose()
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update asset')
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
      title={asset ? 'Edit Asset' : 'Add New Asset'}
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
              label="Asset Name"
              placeholder="e.g., Dell Monitor 27inch"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Asset Type"
              placeholder="e.g., Monitor, Laptop, Desk"
              error={errors.asset_type?.message}
              {...register('asset_type')}
            />
            <Input
              label="Serial Number"
              placeholder="e.g., SN-2024-001"
              error={errors.serial_number?.message}
              className="font-[family-name:var(--font-mono)] text-[13px]"
              {...register('serial_number')}
            />
            <Select
              label="Category"
              options={categoryOptions}
              error={errors.category?.message}
              {...register('category')}
            />
            {aiSuggestion && (
              <button
                type="button"
                onClick={applyAiSuggestion}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-vault-amber/8 border border-vault-amber/20 hover:bg-vault-amber/15 transition-colors text-left group -mt-2"
              >
                <Sparkles className="h-3.5 w-3.5 text-vault-amber flex-shrink-0" />
                <span className="flex-1 text-[12px] text-vault-muted-text">
                  AI suggests: <span className="text-vault-amber font-semibold">{aiSuggestion.category}</span>
                  <span className="text-vault-muted-text" style={{ fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}> ({Math.round(aiSuggestion.confidence * 100)}% confidence)</span>
                  <span className="text-vault-muted-text/60"> — Click to apply</span>
                </span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Brand"
                placeholder="e.g., Dell"
                {...register('brand')}
              />
              <Input
                label="Model"
                placeholder="e.g., U2723QE"
                {...register('model')}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => setStep(2)}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <Input
              label="Purchase Date"
              type="date"
              {...register('purchase_date')}
            />
            <Input
              label="Purchase Price"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.purchase_price?.message}
              {...register('purchase_price')}
            />
            <Input
              label="Warranty Expiry"
              type="date"
              {...register('warranty_expiry')}
            />
            <div>
              <label className="block text-sm font-medium text-vault-text mb-1.5">
                Description
              </label>
              <textarea
                placeholder="Optional description..."
                rows={3}
                className="w-full px-3 py-2 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all resize-none"
                {...register('description')}
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {asset ? 'Update Asset' : 'Create Asset'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
