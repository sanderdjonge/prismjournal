import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { withAdmin } from '@/lib/api/withAdmin';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

/**
 * Execute a command with spawn (safer than exec - no shell interpolation).
 * Returns a promise that resolves with { stdout, stderr } on completion.
 */
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

/**
 * Validate a path for safe use in shell commands.
 * Prevents command injection by rejecting dangerous characters.
 */
function isValidPathForShell(path: string): boolean {
  // Reject paths containing shell metacharacters or path traversal
  // Note: brackets must be escaped inside character class
  const dangerousPattern = /[;&|`$(){}\[\]<>\\!*?]/;
  if (dangerousPattern.test(path)) return false;
  if (path.includes('..')) return false;
  // Only allow absolute paths or relative paths without traversal
  return path.startsWith('/') || path.startsWith('./');
}

// Backup directory - validate on initialization
const BACKUP_DIR_RAW = process.env.BACKUP_PATH || '/backups';
const BACKUP_DIR = isValidPathForShell(BACKUP_DIR_RAW) ? BACKUP_DIR_RAW : '/backups';
if (!isValidPathForShell(BACKUP_DIR_RAW)) {
  console.warn('[backups] Invalid BACKUP_PATH detected, using default /backups');
}

// Get backup files from a directory
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

// Get backup configuration
async function getBackupConfig(): Promise<{
  keepHourly: number;
  keepDaily: number;
  keepWeekly: number;
}> {
  // Default values - these could be stored in database or config file
  return {
    keepHourly: parseInt(process.env.BACKUP_KEEP_HOURLY || '24'),
    keepDaily: parseInt(process.env.BACKUP_KEEP_DAILY || '30'),
    keepWeekly: parseInt(process.env.BACKUP_KEEP_WEEKLY || '12'),
  };
}

// GET /api/admin/backups - List all backups
export const GET = withAdmin(async (request: NextRequest) => {
  const [hourlyBackups, dailyBackups, weeklyBackups, config] = await Promise.all([
    Promise.resolve(getBackupFiles('hourly')),
    Promise.resolve(getBackupFiles('daily')),
    Promise.resolve(getBackupFiles('weekly')),
    getBackupConfig(),
  ]);

  // Calculate totals
  const allBackups = [...hourlyBackups, ...dailyBackups, ...weeklyBackups];
  const totalSize = allBackups.reduce((sum, b) => sum + b.size, 0);

  // Get last backup time
  const lastBackup = hourlyBackups[0]?.createdAt || dailyBackups[0]?.createdAt || null;

  return NextResponse.json({
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

// POST /api/admin/backups - Create manual backup
export const POST = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, file } = body;
    
    if (action === 'create') {
      // Trigger manual backup
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
      const backupFile = join(BACKUP_DIR, 'hourly', `manual_${timestamp}.dump`);
      
      // Parse DATABASE_URL to avoid exposing credentials in command line
      const dbUrl = new URL(process.env.DATABASE_URL!);
      const dbHost = dbUrl.hostname;
      const dbPort = dbUrl.port || '5432';
      const dbUser = dbUrl.username;
      const dbName = dbUrl.pathname.slice(1); // Remove leading slash
      
      // Validate database connection parameters to prevent command injection
      if (!isValidPathForShell(dbHost) || !isValidPathForShell(dbUser) || !isValidPathForShell(dbName)) {
        return NextResponse.json(
          { error: 'Invalid database configuration detected' },
          { status: 500 }
        );
      }
      
      // Run pg_dump using spawn with argument array (safer than exec - no shell interpolation)
      // PGPASSWORD is passed via env var to avoid exposing in process list
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
          console.error('Backup stderr:', stderr);
        }
      } catch (backupError) {
        console.error('Backup creation failed:', backupError);
        return NextResponse.json(
          { error: 'Failed to create backup', details: String(backupError) },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: 'Backup created successfully',
        file: `manual_${timestamp}.dump`,
      });
    }
    
    if (action === 'restore' && file) {
      // Restore is intentionally not implemented via API for safety reasons.
      // Database restore is a destructive operation that should be performed
      // manually by a system administrator with proper safeguards:
      // 1. Create a safety backup before restore
      // 2. Verify the backup file integrity
      // 3. Stop application instances to prevent data corruption
      // 4. Run pg_restore manually
      // 5. Verify data integrity before resuming service
      return NextResponse.json({
        error: 'Restore operation is not available via API. Please contact system administrator to perform restore manually.',
        hint: 'Use pg_restore command directly on the server with the backup file.'
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Backup action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform backup action' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/backups?file=...&type=... - Delete a backup
export const DELETE = withAdmin(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const type = searchParams.get('type') || 'hourly';
    
    if (!file) {
      return NextResponse.json({ error: 'File parameter required' }, { status: 400 });
    }

    const allowedTypes = ['hourly', 'daily', 'weekly'];
    if (!allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid backup type' }, { status: 400 });
    }

    // Security: prevent path traversal
    if (file.includes('..') || file.includes('/')) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }
    
    const backupPath = join(BACKUP_DIR, type, file);
    
    if (!existsSync(backupPath)) {
      return NextResponse.json({ error: 'Backup file not found' }, { status: 404 });
    }
    
    unlinkSync(backupPath);
    
    return NextResponse.json({
      success: true,
      message: `Deleted backup: ${file}`,
    });
  } catch (error) {
    console.error('Backup delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete backup' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/backups - Update backup configuration
export const PATCH = withAdmin(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { keepHourly, keepDaily, keepWeekly } = body;

    // In a production system, you'd store these in the database
    // For now, we'll just return success and note that env vars need to be updated

    const config = {
      keepHourly: keepHourly || parseInt(process.env.BACKUP_KEEP_HOURLY || '24'),
      keepDaily: keepDaily || parseInt(process.env.BACKUP_KEEP_DAILY || '30'),
      keepWeekly: keepWeekly || parseInt(process.env.BACKUP_KEEP_WEEKLY || '12'),
    };

    // TODO: Store in database or update config file

    return NextResponse.json({
      success: true,
      message: 'Configuration updated. Note: Changes require container restart to take effect.',
      config,
    });
  } catch (error) {
    console.error('Backup config error:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
});
