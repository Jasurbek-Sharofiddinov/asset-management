import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { Button } from '../components/ui/Button'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error, clearError } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      // Error handled in store
    }
  }

  return (
    <div className="min-h-screen bg-vault-black flex items-center justify-center p-4">
      {/* Subtle radial glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-vault-amber/[0.03] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-vault-amber/10 border border-vault-amber/20 mb-4">
            <Shield className="h-8 w-8 text-vault-amber" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-vault-text">
            Asset<span className="text-vault-amber">Vault</span>
          </h1>
          <p className="text-sm text-vault-muted-text mt-1">
            Bank Office Asset Management
          </p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="bg-vault-surface border border-vault-border rounded-2xl p-8 shadow-[0_0_0_1px_rgba(245,158,11,0.08),0_4px_24px_rgba(0,0,0,0.6)]"
        >
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-vault-text mb-1">
            Welcome back
          </h2>
          <p className="text-sm text-vault-muted-text mb-6">
            Sign in to access the vault
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-3 rounded-lg bg-vault-red/10 border border-vault-red/20"
            >
              <p className="text-sm text-vault-red">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-vault-text mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@assetvault.com"
                required
                className="w-full px-3 py-2.5 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-vault-text mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-3 py-2.5 pr-10 bg-vault-black border border-vault-border rounded-lg text-vault-text text-sm placeholder:text-vault-muted-text/50 focus:outline-none focus:ring-2 focus:ring-vault-amber/40 focus:border-vault-amber/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-vault-muted-text hover:text-vault-text transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full py-2.5"
              size="lg"
            >
              Sign In
            </Button>
          </form>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center text-xs text-vault-muted-text mt-6"
        >
          Secured by AssetVault Banking Solutions
        </motion.p>
      </motion.div>
    </div>
  )
}
