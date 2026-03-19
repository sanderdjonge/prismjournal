import { NextResponse } from 'next/server';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  tradeCreateSchema,
  tradeUpdateSchema,
  registerSchema,
  loginSchema,
  createAccountSchema,
  updateAccountSchema,
  settingsUpdateSchema,
  notificationSettingsSchema,
  syncPayloadSchema,
} from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const schemas = {
    Trade: {
      create: zodToJsonSchema(tradeCreateSchema, { name: 'TradeCreate' }),
      update: zodToJsonSchema(tradeUpdateSchema, { name: 'TradeUpdate' }),
    },
    Auth: {
      register: zodToJsonSchema(registerSchema, { name: 'Register' }),
      login: zodToJsonSchema(loginSchema, { name: 'Login' }),
    },
    Account: {
      create: zodToJsonSchema(createAccountSchema, { name: 'AccountCreate' }),
      update: zodToJsonSchema(updateAccountSchema, { name: 'AccountUpdate' }),
    },
    Settings: {
      update: zodToJsonSchema(settingsUpdateSchema, { name: 'SettingsUpdate' }),
      notifications: zodToJsonSchema(notificationSettingsSchema, { name: 'NotificationSettings' }),
    },
    Sync: {
      payload: zodToJsonSchema(syncPayloadSchema, { name: 'SyncPayload' }),
    },
  };

  return NextResponse.json({
    openapi: '3.0.0',
    info: { title: 'PrismJournal API', version: '1.0.0' },
    schemas,
  });
}
