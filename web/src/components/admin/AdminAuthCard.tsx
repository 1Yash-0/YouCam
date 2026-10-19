'use client'

import React, { useState } from 'react'
import { PillButton } from '@/components/PillButton'

interface AdminAuthCardProps {
  onAuthenticate: (token: string) => Promise<boolean>
}

export function AdminAuthCard({ onAuthenticate }: AdminAuthCardProps) {
  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanToken = tokenInput.trim()
    if (!cleanToken) {
      setErrorMessage('Please enter an admin token.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const ok = await onAuthenticate(cleanToken)
      if (!ok) {
        setErrorMessage('Invalid admin token. Please check your credentials.')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify the admin token.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto my-12 p-8 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] shadow-sm">
      <div className="mb-6 text-center">
        <span className="ui-label text-[var(--gold)] block mb-1">Restricted Access</span>
        <h2 className="text-2xl font-light tracking-tight text-[var(--ink)]">
          Atelier <span className="font-serif-italic">Admin</span>
        </h2>
        <p className="text-xs text-[var(--ink-2)] mt-2 leading-relaxed">
          Enter your Studio Admin Token (<code className="bg-black/5 dark:bg-white/5 px-1 py-0.5 rounded">x-admin-token</code>) to manage jewellery catalogue and monitor API credit telemetry.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="admin-token-input" className="ui-label text-[10px] text-[var(--ink-2)] block mb-1">
            Studio Admin Token
          </label>
          <div className="relative">
            <input
              id="admin-token-input"
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Enter x-admin-token…"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-black/40 border border-[var(--line)] rounded-[var(--radius-sm)] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)] focus-visible:outline-offset-[3px] transition-colors"
              autoComplete="off"
              required
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] ui-label text-[var(--ink-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
            >
              {showToken ? 'HIDE' : 'SHOW'}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs rounded-[var(--radius-sm)]"
          >
            {errorMessage}
          </div>
        )}

        <div className="pt-2">
          <PillButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="w-full text-center justify-center cursor-pointer"
          >
            {isSubmitting ? 'VERIFYING CREDENTIALS…' : 'UNLOCK ATELIER CONTROLS'}
          </PillButton>
        </div>
      </form>
    </div>
  )
}
