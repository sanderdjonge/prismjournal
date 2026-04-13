'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiPost, apiPatch, apiDelete } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'

export type ChallengeRule = {
  type: 'MAX_DAILY_LOSS' | 'MAX_TRADES_PER_DAY' | 'MIN_RR' | 'TIME_WINDOW' | 'MAX_DRAWDOWN' | 'WIN_RATE_TARGET'
  value: number | string
  operator?: 'LT' | 'LTE' | 'GT' | 'GTE' | 'EQ'
}

export type TradingChallenge = {
  id: string
  name: string
  description: string | null
  scope: 'GLOBAL' | 'PER_ACCOUNT'
  accountId: string | null
  rules: ChallengeRule[]
  startDate: string
  endDate: string | null
  isActive: boolean
  daysPassed: number
  daysFailed: number
  totalDays: number
  evaluationCount: number
  createdAt: string
}

export type ChallengeEvaluation = {
  id: string
  challengeId: string
  date: string
  passed: boolean
  failureReasons: string[] | null
  tradeIds: string[]
}

export type ChallengeWithEvaluations = TradingChallenge & {
  evaluations: ChallengeEvaluation[]
  stats: {
    totalDays: number
    passedDays: number
    failedDays: number
    successRate: number
  }
}

export function useChallenges(activeOnly = false) {
  return useQuery({
    queryKey: queryKeys.challenges.list(activeOnly),
    queryFn: () =>
      apiFetch<TradingChallenge[]>(`/api/challenges${activeOnly ? '?active=true' : ''}`),
  })
}

export function useChallenge(id: string | null) {
  return useQuery({
    queryKey: queryKeys.challenges.detail(id ?? ''),
    queryFn: () => {
      if (!id) return null
      return apiFetch<ChallengeWithEvaluations>(`/api/challenges/${id}`)
    },
    enabled: !!id,
  })
}

type CreateChallengeData = {
  name: string
  description?: string
  scope?: 'GLOBAL' | 'PER_ACCOUNT'
  accountId?: string
  rules: ChallengeRule[]
  startDate: string
  endDate?: string
}

export function useCreateChallenge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChallengeData) => apiPost('/api/challenges', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.challenges.all }),
  })
}

type UpdateChallengeData = {
  name?: string
  description?: string
  rules?: ChallengeRule[]
  isActive?: boolean
  endDate?: string | null
}

export function useUpdateChallenge(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateChallengeData) => apiPatch(`/api/challenges/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.challenges.all })
      qc.invalidateQueries({ queryKey: queryKeys.challenges.detail(id) })
    },
  })
}

export function useDeleteChallenge(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiDelete(`/api/challenges/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.challenges.all }),
  })
}

export function useBackfillChallenge(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<{ success: boolean; daysEvaluated: number }>(`/api/challenges/${id}/backfill`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.challenges.all })
      qc.invalidateQueries({ queryKey: queryKeys.challenges.detail(id) })
    },
  })
}
