import { NextRequest } from 'next/server';
import { spawn } from 'child_process';
import { withAdmin } from '@/lib/api/withAdmin';
import { ok, badRequest, notFound, internalError } from '@/lib/api/responses';
import logger from '@/lib/logger';
import { existsSync, readdirSync, statSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

function execCommand(
  command: string,
  args: string[],
  options: { timeout?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env || process.env,
      timeout: options.timeout || 60000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with code ${code}: ${stderr}`);
        (error as any).code = code;
        (error as any).stderr = stderr;
        reject(error);
      }
    });
  });
}

function isValidPathForShell(path: string): boolean {
  const dangerousPattern = /[;&|`$(){}\[\]<>\\!*?]/;
  if (dangerousPattern.test(path)) return false;
  if (path.includes('..')) return false;
  return path.startsWith('/') || path.startsWith('./');
}

function isValidDbIdentifier(identifier: string): boolean {
  return /^[a-zA-Z0-9_.-]+$/.test(identifier);
}

const BACKUP_DIR_RAW = process.env.BACKUP_PATH || '/backups';
const BACKUP_DIR = isValidPathForShell(BACKUP_DIR_RAW) ? BACKUP_DIR_RAW : '/backups';
if (!isValidPathForShell(BACKUP_DIR_RAW)) {
  console.warn('[backups] Invalid BACKUP_PATH detected, using default /backups');
}

function ensureBackupDirectories(): void {
  const subdirs = ['hourly', 'daily', 'weekly'];
  for (const subdir of subdirs) {
    const dirPath = join(BACKUP_DIR, subdir);
    if (!existsSync(dirPath)) {
      try {
        mkdirSync(dirPath, { recursive: true });
        console.log(`[backups] Created backup directory: ${dirPath}`);
      } catch (error) {
        logger.error({ err: error, dirPath }, '[backups] Failed to create backup directory');
      }
    }
  }
}

ensureBackupDirectories();

function getBackupFiles(subdir: string): Array<{ name: string; size: number; createdAt: Date }> {
  const dirPath = join(BACKUP_DIR, subdir);
  if (!existsSync(dirPath)) return [];
  
  try {
    return readdirSync(dirPath)
      .filter(f => f.endsWith('.dump'))
      .map(f => {
        const filePath = join(dirPath, f);
        const stats = statSync(filePath);
        return {
          name: f,
          size: stats.size,
          createdAt: new Date(stats.mtime),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

async function getBackupConfig(): Promise<{
  keepHourly: number;
  keepDaily: number;
  keepWeekly: number;
}> {
  return {
    keepHourly: parseInt(process.env.BACKUP_KEEP_HOURLY || '24'),
    keepDaily: parseInt(process.env.BACKUP_KEEP_DAILY || '30'),
    keepWeekly: parseInt(process.env.BACKUP_KEEP_WEEKLY || '12'),
  };
}

export const GET = withAdmin(async (request: NextRequest) => {
  const [hourlyBackups, dailyBackups, weeklyBackups, config] = await Promise.all([
    Promise.resolve(getBackupFiles('hourly')),
    Promise.resolve(getBackupFiles('daily')),
    Promise.resolve(getBackupFiles('weekly')),
    getBackupConfig(),
  ]);

  const allBackups = [...hourlyBackups, ...dailyBackups, ...weeklyBackups];
  const totalSize = allBackups.reduce((sum, b) => sum + b.size, 0);

  const lastBackup = hourlyBackups[0]?.createdAt || dailyBackups[0]?.createdAt || null;

  return ok({
    status: {
      lastBackup,
      totalBackups: allBackups.length,
      totalSizeMb: Math.round(totalSize / (1024 * 1024) * 10) / 10,
    },
    config,
    backups: {
      hourly: hourlyBackups.map(b => ({
        ...b,
        sizeMb: Math.round(b.size / (1024 * 1024) * 10) / 10,
      })),
      daily: dailyBackups.map(b => ({
        ...b,
        sizeMb: Math.round(b.size / (1024 * 1024) * 10) / 10,
      })),
      weekly: weeklyBackups.map(b => ({
        ...b,
        sizeMb: Math.round(b.size / (1024 * 1024) * 10) / 10,
      })),
    },
  });
});

export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, file } = body;
    
    if (action === 'create') {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
      const backupFile = join(BACKUP_DIR, 'hourly', `manual_${timestamp}.dump`);
      
      const dbUrl = new URL(process.env.DATABASE_URL!);
      const dbHost = dbUrl.hostname;
      const dbPort = dbUrl.port || '5432';
      const dbUser = dbUrl.username;
      const dbName = dbUrl.pathname.slice(1);
      
      if (!isValidDbIdentifier(dbHost) || !isValidDbIdentifier(dbUser) || !isValidDbIdentifier(dbName)) {
        return internalError();
      }
      
      try {
        const { stderr } = await execCommand('pg_dump', [
          `--host=${dbHost}`,
          `--port=${dbPort}`,
          `--user=${dbUser}`,
          `--dbname=${dbName}`,
          '--format=custom',
          '--no-owner',
          '--no-acl',
          `--file=${backupFile}`,
        ], {
          timeout: 60000,
          env: { ...process.env, PGPASSWORD: dbUrl.password }
        });
        
        if (stderr && !stderr.includes('NOTICE')) {
          logger.error({ stderr }, 'Backup stderr');
        }
      } catch (backupError) {
        logger.error({ err: backupError }, 'Backup creation failed');
        return internalError();
      }
      
      return ok({
        success: true,
        message: 'Backup created successfully',
        file: `manual_${timestamp}.dump`,
      });
    }
    
    if (action === 'restore' && file) {
      return badRequest('Restore operation is not available via API. Please contact system administrator to perform restore manually.');
    }
    
    return badRequest('Invalid action');
  } catch (error) {
    logger.error({ err: error }, 'Backup action error');
    return internalError();
  }
});

export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const type = searchParams.get('type') || 'hourly';
    
    if (!file) {
      return badRequest('File parameter required');
    }

    const allowedTypes = ['hourly', 'daily', 'weekly'];
    if (!allowedTypes.includes(type)) {
      return badRequest('Invalid backup type');
    }

    if (file.includes('..') || file.includes('/')) {
      return badRequest('Invalid file name');
    }
    
    const backupPath = join(BACKUP_DIR, type, file);
    
    if (!existsSync(backupPath)) {
      return notFound('Backup file');
    }
    
    unlinkSync(backupPath);
    
    return ok({
      success: true,
      message: `Deleted backup: ${file}`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Backup delete error');
    return internalError();
  }
});

export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { keepHourly, keepDaily, keepWeekly } = body;

    const config = {
      keepHourly: keepHourly || parseInt(process.env.BACKUP_KEEP_HOURLY || '24'),
      keepDaily: keepDaily || parseInt(process.env.BACKUP_KEEP_DAILY || '30'),
      keepWeekly: keepWeekly || parseInt(process.env.BACKUP_KEEP_WEEKLY || '12'),
    };

    return ok({
      success: true,
      message: 'Configuration updated. Note: Changes require container restart to take effect.',
      config,
    });
  } catch (error) {
    logger.error({ err: error }, 'Backup config error');
    return internalError();
  }
});
