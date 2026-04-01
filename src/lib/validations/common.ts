import { NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';

/**
 * Format Zod validation errors into a user-friendly format
 * Compatible with both Zod 3 (error.errors) and Zod 4 (error.issues)
 */
export function formatZodErrors(error: ZodError) {
  // Zod 4 uses 'issues' property, Zod 3 uses 'errors'
  // @ts-expect-error - Handle both Zod 3 and 4 API differences
  const errorList = error.issues || error.errors;
  return errorList.map((err: { path: PropertyKey[]; message: string; code: string }) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Validate request body against a Zod schema
 * Returns either the validated data or a NextResponse with error details
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Validation failed', details: formatZodErrors(error) },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }
}

/**
 * Validate URL search params against a Zod schema
 * Returns either the validated data or a NextResponse with error details
 */
export function validateQueryParams<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const validated = schema.parse(params);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid query parameters', details: formatZodErrors(error) },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 }),
    };
  }
}

/**
 * Validate form data against a Zod schema
 * Returns either the validated data or a NextResponse with error details
 */
export async function validateFormData<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const formData = await request.formData();
    const data: Record<string, string | File | null> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Validation failed', details: formatZodErrors(error) },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json({ error: 'Invalid form data' }, { status: 400 }),
    };
  }
}
