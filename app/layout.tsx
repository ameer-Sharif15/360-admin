'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../lib/auth-context';
import { API_BASE_URL, apiRequest } from '../lib/api';
import { io } from 'socket.io-client';
import './globals.css';
import {
  LayoutDashboard,
  Users,
  IdCard,
  ShoppingBag,
  CalendarCheck,
  Package,
  ShoppingCart,
  ClipboardList,
  Wrench,
  BedDouble,
  Compass,
  LogOut,
  Menu,
  X,
  MessageSquare,
  Dumbbell,
} from 'lucide-react';

const navLinks = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Staffs', href: '/staffs', icon: IdCard },
  { name: 'Gym', href: '/gym', icon: Dumbbell },
  { name: 'Communication', href: '/communication', icon: MessageSquare },
  { name: 'Sellers', href: '/sellers', icon: ShoppingBag },
  { name: 'Attendance', href: '/attendance', icon: CalendarCheck },
  { name: 'Orders', href: '/orders', icon: Package },
  { name: 'Minimart', href: '/minimart', icon: ShoppingCart },
  { name: 'Inventory', href: '/inventory', icon: ClipboardList },
  { name: 'Services', href: '/services', icon: Wrench },
  { name: 'Rooms', href: '/rooms', icon: BedDouble },
  { name: 'Activities', href: '/activities', icon: Compass },
];

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCommCount, setUnreadCommCount] = useState(0);

  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, loading, pathname, router]);

  // Fallback watchdog: If loading ever takes longer than 5 seconds, auto-redirect to /login
  useEffect(() => {
    if (pathname === '/login') return;
    const timer = setTimeout(() => {
      if (loading) {
        router.push('/login');
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading, pathname, router]);

  // Real-time unread messages count sync for Communication tab
  useEffect(() => {
    if (!user) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_jwt') : null;
    if (!token) return;

    const fetchUnreadCount = async () => {
      const currentToken = typeof window !== 'undefined' ? localStorage.getItem('admin_jwt') : null;
      if (!currentToken) return;

      try {
        const contacts = await apiRequest('/api/chats/it-contacts');
        if (Array.isArray(contacts)) {
          const total = contacts.reduce((sum: number, c: any) => sum + (Number(c.unreadCount) || 0), 0);
          setUnreadCommCount(total);
          return;
        }
      } catch (_) {}

      try {
        const res = await apiRequest('/api/chats/unread-count');
        if (res && typeof res.unreadCount === 'number') {
          setUnreadCommCount(res.unreadCount);
        }
      } catch (_) {}
    };

    fetchUnreadCount();

    // Listen to custom event dispatched by communication page
    const handleCustomUnread = (e: any) => {
      if (typeof e.detail === 'number') {
        setUnreadCommCount(e.detail);
      } else {
        fetchUnreadCount();
      }
    };
    window.addEventListener('it_unread_count_updated', handleCustomUnread);

    // Socket.io for live updates
    let socket: any = null;
    try {
      socket = io(API_BASE_URL, {
        auth: { token },
        extraHeaders: { Authorization: `Bearer ${token}` },
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 3,
        timeout: 5000,
      });

      socket.on('connect_error', () => {
        // silent failover, avoid console noise when socket transport is not ready
      });

      socket.on('connect', () => {
        socket.emit('join_channel', 'admin_channel');
        socket.emit('join_channel', 'support_channel');
        const uid = (user as any)._id || (user as any).id;
        if (uid) socket.emit('join_user', uid);
      });

      const handleIncoming = () => {
        fetchUnreadCount();
      };

      socket.on('new_message', handleIncoming);
      socket.on('message_received', handleIncoming);
      socket.on('chat_updated', handleIncoming);
      socket.on('it_announcement', handleIncoming);
    } catch (_) {}

    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      window.removeEventListener('it_unread_count_updated', handleCustomUnread);
      clearInterval(interval);
      if (socket) socket.disconnect();
    };
  }, [user]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Show login page without layout
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Show loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#0F172A',
          color: '#fff',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid rgba(255,255,255,0.1)',
              borderTop: '4px solid #FF7F50',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: '#94A3B8', fontWeight: 600 }}>Loading 360 Admin...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const activeLink = navLinks.find((l) => l.href === pathname);
  const ActiveIcon = activeLink?.icon;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* ── Mobile Header Bar (Screen < 1024px) ── */}
      <header className="admin-mobile-header">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          className="admin-hamburger-btn"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/logo.png"
            alt="360 Logo"
            style={{ width: 28, height: 28, objectFit: 'contain' }}
            onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
          />
          <span style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.3px' }}>
            360 <span style={{ color: '#FF7F50' }}>Admin</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {unreadCommCount > 0 && (
            <Link
              href="/communication"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#EF4444',
                color: '#fff',
                padding: '4px 9px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.45)',
              }}
              title={`${unreadCommCount} unread communication message${unreadCommCount === 1 ? '' : 's'}`}
            >
              <MessageSquare size={12} />
              <span>{unreadCommCount > 99 ? '99+' : unreadCommCount}</span>
            </Link>
          )}
          <span className="admin-active-badge">
            {ActiveIcon && <ActiveIcon size={13} style={{ marginRight: 4 }} />}
            {activeLink?.name || 'Admin'}
          </span>
        </div>
      </header>

      {/* ── Backdrop Overlay (Mobile) ── */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="admin-sidebar-backdrop"
        />
      )}

      {/* ── Sidebar (Desktop fixed & Mobile drawer) ── */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid #1F2937', background: 'linear-gradient(180deg,#111827 0%,#0B0F17 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', padding: 2, flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              <img
                src="/logo.png"
                alt="360 Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e: any) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: '-0.3px',
                  lineHeight: 1.2,
                }}
              >
                360 LIVE <span style={{ color: '#FF7F50' }}>ADMIN</span>
              </h1>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: 10.5,
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  fontWeight: 600,
                }}
              >
                Global Control Center
              </p>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', letterSpacing: 1, textTransform: 'uppercase', padding: '0 12px 10px' }}>
            Main Menu
          </div>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 14px',
                  textDecoration: 'none',
                  color: isActive ? '#fff' : '#94A3B8',
                  background: isActive ? '#FF7F50' : 'transparent',
                  fontSize: 14,
                  fontWeight: isActive ? 700 : 500,
                  borderRadius: 10,
                  marginBottom: 4,
                  transition: 'all 0.18s ease',
                  boxShadow: isActive ? '0 4px 14px rgba(255,127,80,0.35)' : 'none',
                }}
              >
                <Icon size={18} color={isActive ? '#fff' : '#94A3B8'} />
                <span style={{ flex: 1 }}>{link.name}</span>
                {link.href === '/communication' && unreadCommCount > 0 && (
                  <span
                    style={{
                      background: isActive ? '#FFFFFF' : '#EF4444',
                      color: isActive ? '#EF4444' : '#FFFFFF',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 999,
                      minWidth: 20,
                      textAlign: 'center',
                      lineHeight: '16px',
                      boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    {unreadCommCount > 99 ? '99+' : unreadCommCount}
                  </span>
                )}
                {isActive && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout in Sidebar */}
        <div
          style={{
            padding: '16px 18px',
            borderTop: '1px solid #1F2937',
            background: '#0B0F17',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#1A365D', color: '#FF7F50',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, flexShrink: 0,
            }}>
              {(user.displayName || user.name || user.email || 'A').charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.displayName || user.name || 'Admin User'}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '9px 14px',
              background: '#1E293B',
              color: '#F87171',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#DC2626';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#1E293B';
              e.currentTarget.style.color = '#F87171';
            }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Workspace Content ── */}
      <main className="admin-main-content">
        <header className="admin-desktop-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {ActiveIcon && <ActiveIcon size={24} color="#FF7F50" />}
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--navy-dark)', letterSpacing: '-0.5px' }}>
                {activeLink?.name || 'Dashboard'}
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13.5 }}>
              360 Degree Global Estate Ltd. · {activeLink?.name} Control Center
            </p>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy-dark)' }}>
                {user.displayName || user.name || 'System Admin'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
            </div>
            <button
              onClick={logout}
              style={{
                padding: '9px 18px',
                background: '#DC2626',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 2px 8px rgba(220,38,38,0.25)',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#B91C1C')}
              onMouseOut={(e) => (e.currentTarget.style.background = '#DC2626')}
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </header>

        <div className="admin-page-container">
          {children}
        </div>
      </main>

      <style jsx global>{`
        /* Responsive Layout Rules */
        .admin-sidebar {
          width: 260px;
          background: #111827;
          color: #fff;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 150;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .admin-main-content {
          margin-left: 260px;
          padding: 32px 36px;
          min-height: 100vh;
          transition: margin-left 0.25s ease;
        }

        .admin-desktop-header {
          margin-bottom: 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 20px;
          border-bottom: 1.5px solid var(--border);
        }

        .admin-mobile-header {
          display: none;
        }

        .admin-sidebar-backdrop {
          display: none;
        }

        @media (max-width: 1023px) {
          .admin-sidebar {
            width: 280px;
            transform: translateX(-100%);
            box-shadow: 0 0 40px rgba(0,0,0,0.5);
          }

          .admin-sidebar.open {
            transform: translateX(0);
          }

          .admin-sidebar-backdrop {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(4px);
            z-index: 140;
          }

          .admin-mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #111827;
            padding: 12px 16px;
            position: sticky;
            top: 0;
            z-index: 120;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }

          .admin-hamburger-btn {
            background: #1F2937;
            border: 1px solid #374151;
            color: #fff;
            width: 38px;
            height: 38px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            cursor: pointer;
          }

          .admin-active-badge {
            background: rgba(255, 127, 80, 0.15);
            color: #FF7F50;
            border: 1px solid rgba(255, 127, 80, 0.3);
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
          }

          .admin-main-content {
            margin-left: 0 !important;
            padding: 16px !important;
          }

          .admin-desktop-header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>360 Live Admin Panel</title>
      </head>
      <body>
        <AuthProvider>
          <ProtectedLayout>{children}</ProtectedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
