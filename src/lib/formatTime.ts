export function formatDistanceToNow(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const now = Date.now();
    const diff = now - d.getTime();
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
}

export function formatShortDate(date: Date | string, timezone?: string, locale?: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString(locale ?? 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(timezone ? { timeZone: timezone } : {}),
    })
}

export function formatShortTime(date: Date | string, timezone?: string, locale?: string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString(locale ?? 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        ...(timezone ? { timeZone: timezone } : {}),
    })
}

export function formatDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}
