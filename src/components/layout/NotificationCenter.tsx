'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, X, Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDistanceToNow, formatShortDate } from '@/lib/formatTime'
import { useNotifications, useMarkNotificationsRead, useDeleteNotification } from '@/hooks/useNotifications'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

interface NotificationCenterProps {
  className?: string
}

export default function NotificationCenter({ className }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { data: notifsData } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const deleteNotif = useDeleteNotification()

  useEffect(() => {
    if (notifsData) {
      setNotifications(
        (notifsData.notifications || []).map(n => ({
          ...n,
          isRead: n.read,
        }))
      )
      const unread = (notifsData.notifications || []).filter((n: any) => !n.read).length
      setUnreadCount(unread)
    }
  }, [notifsData])

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleMarkAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    markRead.mutate(undefined)
  }

  const handleMarkRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
    markRead.mutate([id])
  }

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    const notification = notifications.find(n => n.id === id)
    if (notification && !notification.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
    deleteNotif.mutate(id)
  }

  const handleClearAll = () => {
    setLoading(true)
    setNotifications([])
    setUnreadCount(0)
    deleteNotif.mutate(undefined)
    setLoading(false)
  }


  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'TRADE_OPEN':
        return '📈';
      case 'TRADE_CLOSE':
        return '📉';
      case 'MDD_ALERT':
        return '⚠️';
      case 'SYNC_ERROR':
        return '❌';
      default:
        return '🔔';
    }
  };

  return (
    <div className={cn('relative', className)} ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-surface-elevated transition-colors"
        title="Notifications"
      >
        <Bell size={20} className="text-text-secondary hover:text-text-primary" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-loss text-text-primary text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 border rounded-xl shadow-2xl z-50 overflow-hidden" style={{ backgroundColor: 'var(--surface-solid)', borderColor: 'var(--border-solid)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-surface-elevated rounded transition-colors"
              >
                <X size={16} className="text-text-muted" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={32} className="mx-auto text-text-muted mb-2" />
                <p className="text-sm text-text-muted">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'px-4 py-3 hover:bg-surface-elevated transition-colors group',
                      !notification.isRead && 'bg-[rgba(139,92,246,0.06)] border-l-2 border-l-primary'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg">{getTypeIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={cn(
                            'text-sm font-semibold truncate',
                            notification.isRead ? 'text-text-secondary' : 'text-text-primary'
                          )}>
                            {notification.title}
                          </h4>
                          {!notification.isRead && (
                            <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 whitespace-pre-wrap break-words">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-text-muted mt-1">
                          {(() => { const diff = Date.now() - new Date(notification.createdAt).getTime(); const days = Math.floor(diff / 86400000); return days >= 7 ? formatShortDate(notification.createdAt) : formatDistanceToNow(notification.createdAt) })()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.isRead && (
                          <button
                            onClick={() => handleMarkRead(notification.id)}
                            className="p-1 hover:bg-surface-hover rounded transition-colors"
                            title="Mark as read"
                          >
                            <Check size={14} className="text-text-secondary" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.id)}
                          className="p-1 hover:bg-surface-hover rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-text-secondary" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-border-color flex items-center justify-between">
              <span className="text-[10px] text-text-muted">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleClearAll}
                disabled={loading}
                className="text-[10px] font-bold uppercase tracking-widest text-text-muted hover:text-danger transition-colors disabled:opacity-50"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
