#!/bin/sh
# Digest cron entrypoint — runs inside an alpine container.
# 1. Installs curl
# 2. Writes env vars to /etc/digest.env (crond doesn't inherit environment)
# 3. Schedules hourly POST to /api/cron/digest
# 4. Schedules daily POST to /api/cron/economic-events (00:05 UTC)
# Output goes to stdout so `docker logs` works.

set -e

apk add --no-cache curl > /dev/null 2>&1

# Write env file so the cron job can source it
cat > /etc/digest.env << EOF
CRON_SECRET=${CRON_SECRET}
APP_URL=${APP_URL}
EOF
chmod 600 /etc/digest.env

# Write the digest cron script
cat > /usr/local/bin/send-digest.sh << 'SCRIPT'
#!/bin/sh
. /etc/digest.env
curl -s -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/digest" \
  >> /proc/1/fd/1 2>&1
SCRIPT
chmod +x /usr/local/bin/send-digest.sh

# Write the economic events cron script
cat > /usr/local/bin/sync-economic-events.sh << 'SCRIPT'
#!/bin/sh
. /etc/digest.env
curl -s -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/economic-events" \
  >> /proc/1/fd/1 2>&1
SCRIPT
chmod +x /usr/local/bin/sync-economic-events.sh

# Schedule: digest top of every hour, economic events at 00:05 UTC daily
cat > /etc/crontabs/root << EOF
0 * * * * /usr/local/bin/send-digest.sh
5 0 * * * /usr/local/bin/sync-economic-events.sh
EOF

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Cron starting (app=${APP_URL})"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Schedules: hourly digest, daily economic events at 00:05 UTC"

exec crond -f -l 6
