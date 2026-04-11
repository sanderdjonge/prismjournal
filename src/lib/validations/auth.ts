import { z } from 'zod';

/**
 * Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password too long')
  .refine((pwd) => /[A-Z]/.test(pwd), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((pwd) => /[a-z]/.test(pwd), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((pwd) => /[0-9]/.test(pwd), {
    message: 'Password must contain at least one number',
  });

/**
 * Schema for user registration (POST /api/auth/register)
 */
export const registerSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email too long'),
  password: passwordSchema,
  name: z.string().max(100, 'Name too long').optional(),
  invite: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Schema for login credentials
 */
export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
