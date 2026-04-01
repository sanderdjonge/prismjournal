#!/bin/sh
# Digest cron entrypoint — runs inside an alpine container.
# 1. Installs curl
# 2. Writes env vars to /etc/digest.env (crond doesn't inherit environment)
# 3. Schedules hourly POST to /api/cron/digest
# Output goes to stdout so `docker logs` works.

set -e

apk add --no-cache curl > /dev/null 2>&1

# Write env file so the cron job can source it
cat > /etc/digest.env << EOF
CRON_SECRET=${CRON_SECRET}
APP_URL=${APP_URL}
EOF
chmod 600 /etc/digest.env

# Write the cron script
cat > /usr/local/bin/send-digest.sh << 'SCRIPT'
#!/bin/sh
. /etc/digest.env
curl -s -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/digest" \
  >> /proc/1/fd/1 2>&1
SCRIPT
chmod +x /usr/local/bin/send-digest.sh

# Schedule: top of every hour
cat > /etc/crontabs/root << EOF
0 * * * * /usr/local/bin/send-digest.sh
EOF

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Digest cron starting (app=${APP_URL})"

exec crond -f -l 6
