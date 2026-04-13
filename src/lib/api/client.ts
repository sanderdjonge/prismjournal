import { ZodSchema } from 'zod'

export class ApiError extends Error {
  statusCode: number
  responseBody: Record<string, unknown>

  constructor(message: string, statusCode: number, responseBody: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.responseBody = responseBody
  }
}

export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
  schema?: ZodSchema<T>,
): Promise<T> {
  const res = await fetch(url, init)

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ message: 'Unknown error' }))
    throw new ApiError(
      (errorBody as Record<string, unknown>).error as string || (errorBody as Record<string, unknown>).message as string || `API error: ${res.status}`,
      res.status,
      errorBody as Record<string, unknown>,
    )
  }

  const json = await res.json()

  if (schema) {
    return schema.parse(json)
  }

  return json as T
}

export function apiPost<T>(
  url: string,
  body: unknown,
  schema?: ZodSchema<T>,
): Promise<T> {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, schema)
}

export function apiPatch<T>(
  url: string,
  body: unknown,
  schema?: ZodSchema<T>,
): Promise<T> {
  return apiFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, schema)
}

export function apiDelete<T = void>(
  url: string,
  schema?: ZodSchema<T>,
): Promise<T> {
  return apiFetch(url, { method: 'DELETE' }, schema)
}
