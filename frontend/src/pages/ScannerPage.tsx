import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, RotateCcw, ExternalLink, Package } from 'lucide-react'
import { assetsApi } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { formatCurrency } from '../lib/utils'
import type { Asset } from '../types'

export default function ScannerPage() {
  const navigate = useNavigate()
  const [isScanning, setIsScanning] = useState(false)
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
        // Extract asset ID from URL or use as-is
        let assetId: number | null = null
        const urlMatch = decodedText.match(/\/assets\/(\d+)/)
        if (urlMatch) {
          assetId = parseInt(urlMatch[1])
        } else if (/^\d+$/.test(decodedText.trim())) {
          assetId = parseInt(decodedText.trim())
        }

        if (assetId) {
          const asset = await assetsApi.getAsset(assetId)
          setScannedAsset(asset)
        } else {
          setError('Invalid QR code. Expected an asset URL or ID.')
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Asset not found. The QR code may be outdated.')
        } else {
          setError('Failed to fetch asset details.')
        }
      } finally {
        setIsLoading(false)
      }
    },
    [stopScanner]
  )

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
      setError(
        'Camera access denied or unavailable. Please allow camera permissions and try again.'
      )
      setIsScanning(false)
    }
  }, [handleScanResult])

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Scanner Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="overflow-hidden">
          <div className="text-center mb-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-vault-text">
              Scan Asset QR Code
            </h2>
            <p className="text-sm text-vault-muted-text mt-1">
              Point your camera at an asset QR code to view its details
            </p>
          </div>

          {/* Camera Viewport */}
          <div className="relative rounded-xl overflow-hidden bg-vault-black border border-vault-border">
            {isScanning ? (
              <div
                id="qr-reader"
                ref={readerRef}
                className="w-full min-h-[300px]"
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[300px] p-8">
                {isLoading ? (
                  <LoadingSpinner size="lg" label="Looking up asset..." />
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-vault-amber/10 flex items-center justify-center mb-4">
                      <Camera className="h-10 w-10 text-vault-amber" />
                    </div>
                    <p className="text-sm text-vault-muted-text mb-4">
                      {scannedAsset
                        ? 'Asset found! View details below.'
                        : 'Press the button below to start scanning'}
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
                Stop Scanning
              </Button>
            ) : (
              <Button onClick={startScanner}>
                <Camera className="h-4 w-4" />
                {scannedAsset ? 'Scan Again' : 'Start Scanner'}
              </Button>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-vault-red/10 border border-vault-red/20"
          >
            <p className="text-sm text-vault-red">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={startScanner}
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanned Asset Card */}
      <AnimatePresence>
        {scannedAsset && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <Card hover onClick={() => navigate(`/assets/${scannedAsset.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-vault-amber/10 flex items-center justify-center">
                    <Package className="h-6 w-6 text-vault-amber" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-vault-text">
                      {scannedAsset.name}
                    </h3>
                    <p className="font-[family-name:var(--font-mono)] text-[13px] text-vault-muted-text">
                      {scannedAsset.serial_number}
                    </p>
                  </div>
                </div>
                <StatusBadge status={scannedAsset.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-2 rounded-lg bg-vault-black/50 border border-vault-border/30">
                  <p className="text-xs text-vault-muted-text">Category</p>
                  <p className="text-sm text-vault-text">{scannedAsset.category}</p>
                </div>
                <div className="p-2 rounded-lg bg-vault-black/50 border border-vault-border/30">
                  <p className="text-xs text-vault-muted-text">Type</p>
                  <p className="text-sm text-vault-text">{scannedAsset.asset_type}</p>
                </div>
                {scannedAsset.brand && (
                  <div className="p-2 rounded-lg bg-vault-black/50 border border-vault-border/30">
                    <p className="text-xs text-vault-muted-text">Brand</p>
                    <p className="text-sm text-vault-text">
                      {scannedAsset.brand} {scannedAsset.model || ''}
                    </p>
                  </div>
                )}
                {scannedAsset.purchase_price && (
                  <div className="p-2 rounded-lg bg-vault-black/50 border border-vault-border/30">
                    <p className="text-xs text-vault-muted-text">Value</p>
                    <p className="text-sm text-vault-text">
                      {formatCurrency(scannedAsset.purchase_price)}
                    </p>
                  </div>
                )}
                {scannedAsset.current_employee_name && (
                  <div className="col-span-2 p-2 rounded-lg bg-vault-green/5 border border-vault-green/20">
                    <p className="text-xs text-vault-muted-text">Assigned To</p>
                    <p className="text-sm text-vault-green font-medium">
                      {scannedAsset.current_employee_name}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-vault-border/50">
                <ExternalLink className="h-4 w-4 text-vault-amber" />
                <span className="text-sm text-vault-amber font-medium">View Full Details</span>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
