'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Trophy,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import api from '../lib/api';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminName, setAdminName] = useState('Administrator');

  useEffect(() => {
    if (pathname !== '/login') {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        router.push('/login');
      } else {
        try {
          // Decode simple token payload or extract storage info
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.name) setAdminName(payload.name);
          }
        } catch (e) {
          // Silent ignore
        }
      }
    }
  }, [pathname, router]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignored
    }
    localStorage.removeItem('admin_token');
    router.push('/login');
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Tournaments', href: '/tournaments', icon: Trophy },
    { name: 'User Directory', href: '/users', icon: Users },
    { name: 'UPI Deposits', href: '/deposits', icon: ArrowDownCircle },
    { name: 'Withdrawals', href: '/withdrawals', icon: ArrowUpCircle },
  ];

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden text-slate-100">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-slate-900/60 backdrop-blur-md border-r border-slate-800">
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20">
              92
            </span>
            <span className="font-extrabold tracking-wider bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
              92LR ADMIN
            </span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-indigo-600/25 border-l-4 border-indigo-500 text-white font-medium shadow-md shadow-indigo-600/5'
                    : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400">
              {adminName[0].toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-slate-200 truncate">{adminName}</p>
              <p className="text-xs text-slate-500 font-medium">Platform Manager</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-rose-950/20 hover:border-rose-900/40 hover:text-rose-400 text-slate-400 text-sm font-medium transition-all duration-300"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content frame */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="md:hidden h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white">
              92
            </span>
            <span className="font-extrabold tracking-wider text-white">
              92LR ADMIN
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-10 flex">
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <aside className="relative flex flex-col w-64 bg-slate-900 border-r border-slate-800 h-full p-6">
              <div className="flex items-center gap-2 mb-8">
                <span className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-white">
                  92
                </span>
                <span className="font-extrabold tracking-wider text-white">
                  92LR ADMIN
                </span>
              </div>
              <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 ${
                        isActive
                          ? 'bg-indigo-600/30 text-white font-medium border-l-4 border-indigo-500'
                          : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-auto border-t border-slate-850 pt-4">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-slate-800 hover:bg-rose-950/20 text-rose-400 text-sm font-semibold transition-all duration-300"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Route Content View */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6 md:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
