import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, RotateCcw, ExternalLink, Package, Keyboard } from 'lucide-react'
import { assetsApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { formatCurrency } from '../lib/utils'
import { useLanguageStore } from '../stores/languageStore'
import type { Asset } from '../types'

export default function ScannerPage() {
  const navigate = useNavigate()
  const { t } = useLanguageStore()
  const [isScanning, setIsScanning] = useState(false)
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serialInput, setSerialInput] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const readerRef = useRef<HTMLDivElement | null>(null)

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
    } catch {
      // Ignore stop errors
    }
    setIsScanning(false)
  }, [])

  const handleScanResult = useCallback(
    async (decodedText: string) => {
      await stopScanner()
      setIsLoading(true)
      setError(null)

      try {
        let assetId: string | null = null
        const trimmed = decodedText.trim()

        try {
          const parsed = JSON.parse(trimmed)
          if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string') {
            assetId = parsed.id
          }
        } catch {
          // Not JSON — fall through to URL / raw id parsing
        }

        if (!assetId) {
          const urlMatch = trimmed.match(/\/assets\/([^/\s"?]+)/)
          if (urlMatch) {
            assetId = urlMatch[1]
          } else if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
            assetId = trimmed
          }
        }

        if (assetId) {
          const asset = await assetsApi.getAsset(assetId)
          setScannedAsset(asset)
        } else {
          setError(t('scanner.invalidQr'))
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError(t('scanner.notFound'))
        } else {
          setError(t('scanner.fetchFailed'))
        }
      } finally {
        setIsLoading(false)
      }
    },
    [stopScanner, t]
  )

  const lookupBySerial = async (e: FormEvent) => {
    e.preventDefault()
    const serial = serialInput.trim()
    if (!serial) {
      setError(t('scanner.serialRequired'))
      return
    }
    await stopScanner()
    setIsLoading(true)
    setError(null)
    setScannedAsset(null)
    try {
      const result = await assetsApi.getAssets({ search: serial, size: 25 })
      const needle = serial.toLowerCase()
      const exact = result.items.find(
        (asset) => asset.serial_number.toLowerCase() === needle,
      )
      const asset = exact ?? (result.items.length === 1 ? result.items[0] : null)
      if (!asset) {
        setError(t('scanner.serialNotFound'))
        return
      }
      setScannedAsset(asset)
    } catch {
      setError(t('scanner.fetchFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const startScanner = useCallback(async () => {
    setScannedAsset(null)
    setError(null)
    setIsScanning(true)

    // Wait for DOM element
    await new Promise((resolve) => setTimeout(resolve, 100))

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader')
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        handleScanResult,
        () => {} // ignore errors during scanning
      )
    } catch (err: any) {
      setError(t('scanner.cameraDenied'))
      setIsScanning(false)
    }
  }, [handleScanResult, t])

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Scanner Area */}
      <Card className="overflow-hidden">
        <div className="text-center mb-4">
          <h2 className="text-lg font-semibold text-vault-text">
            {t('scanner.title')}
          </h2>
          <p className="text-sm text-vault-muted-text mt-1">
            {t('scanner.subtitle')}
          </p>
        </div>

        {/* Camera Viewport */}
        <div className="relative rounded-xl overflow-hidden bg-black border-2 border-white">
          {isScanning ? (
            <div
              id="qr-reader"
              ref={readerRef}
              className="w-full min-h-[300px]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
              {isLoading ? (
                <LoadingSpinner size="lg" label={t('scanner.lookingUp')} />
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-vault-surface border border-vault-border flex items-center justify-center mb-4">
                    <Camera className="h-8 w-8 text-vault-muted-text" />
                  </div>
                  <p className="text-sm text-vault-muted-text">
                    {scannedAsset
                      ? t('scanner.found')
                      : t('scanner.pressStart')}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center mt-4">
          {isScanning ? (
            <Button variant="secondary" onClick={stopScanner}>
              {t('scanner.stop')}
            </Button>
          ) : (
            <Button onClick={startScanner}>
              <Camera className="h-4 w-4" />
              {scannedAsset ? t('scanner.scanAgain') : t('scanner.start')}
            </Button>
          )}
        </div>

        <form onSubmit={lookupBySerial} className="mt-5 pt-5 border-t border-vault-border">
          <p className="text-[12px] font-medium text-vault-muted-text text-center mb-3">
            {t('scanner.orEnterSerial')}
          </p>
          <label htmlFor="scanner-serial" className="sr-only">
            {t('scanner.serialLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="scanner-serial"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              placeholder={t('scanner.serialPlaceholder')}
              autoComplete="off"
              className="flex-1 min-w-0 px-3 py-2 bg-vault-input border border-vault-border rounded-lg text-[13px] font-mono text-vault-text placeholder:text-vault-disabled focus:outline-none focus:border-vault-border-focus"
            />
            <Button type="submit" variant="secondary" disabled={isLoading}>
              <Keyboard className="h-4 w-4" />
              {t('scanner.lookup')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-danger-soft border border-vault-border">
          <p className="text-sm text-danger">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={startScanner}
          >
            <RotateCcw className="h-4 w-4" />
            {t('scanner.tryAgain')}
          </Button>
        </div>
      )}

      {/* Scanned Asset Card */}
      {scannedAsset && (
        <Card hover onClick={() => navigate(`/assets/${scannedAsset.id}`)}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-vault-muted border border-vault-border flex items-center justify-center">
                <Package className="h-6 w-6 text-vault-muted-text" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-vault-text">
                  {scannedAsset.name}
                </h3>
                <p className="font-mono text-[13px] text-vault-muted-text">
                  {scannedAsset.serial_number}
                </p>
              </div>
            </div>
            <StatusBadge status={scannedAsset.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="p-2.5 rounded-lg bg-vault-muted border border-vault-border">
              <p className="text-xs text-vault-muted-text">{t('scanner.category')}</p>
              <p className="text-sm text-vault-text mt-0.5">{scannedAsset.category}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-vault-muted border border-vault-border">
              <p className="text-xs text-vault-muted-text">{t('scanner.type')}</p>
              <p className="text-sm text-vault-text mt-0.5">{scannedAsset.asset_type}</p>
            </div>
            {scannedAsset.brand && (
              <div className="p-2.5 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('scanner.brand')}</p>
                <p className="text-sm text-vault-text mt-0.5">
                  {scannedAsset.brand} {scannedAsset.model || ''}
                </p>
              </div>
            )}
            {scannedAsset.purchase_price && (
              <div className="p-2.5 rounded-lg bg-vault-muted border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('scanner.value')}</p>
                <p className="font-mono text-sm text-vault-text mt-0.5">
                  {formatCurrency(Number(scannedAsset.purchase_price))}
                </p>
              </div>
            )}
            {scannedAsset.current_employee_name && (
              <div className="col-span-2 p-2.5 rounded-lg bg-ok-soft border border-vault-border">
                <p className="text-xs text-vault-muted-text">{t('scanner.assignedTo')}</p>
                <p className="text-sm text-ok font-medium mt-0.5">
                  {scannedAsset.current_employee_name}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-vault-border">
            <ExternalLink className="h-4 w-4 text-vault-amber" />
            <span className="text-sm text-vault-amber font-medium">{t('scanner.viewDetails')}</span>
          </div>
        </Card>
      )}
    </div>
  )
}
