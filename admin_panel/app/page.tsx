'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Users,
  Trophy,
  ArrowDownRight,
  ArrowUpLeft,
  Activity,
  AlertCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

export default function DashboardHome() {
  // Query to fetch deposits review count
  const { data: depositsData, isLoading: loadingDeposits } = useQuery({
    queryKey: ['admin-deposits'],
    queryFn: async () => {
      const { data } = await api.get('/wallet/admin/deposits');
      return data.deposits || [];
    },
  });

  // Query to fetch withdrawals review count
  const { data: withdrawalsData, isLoading: loadingWithdrawals } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: async () => {
      const { data } = await api.get('/wallet/admin/withdrawals');
      return data.withdrawals || [];
    },
  });

  // Query to fetch tournaments count
  const { data: tournamentsData } = useQuery({
    queryKey: ['admin-tournaments'],
    queryFn: async () => {
      const { data } = await api.get('/tournaments');
      return data.tournaments || [];
    },
  });

  const pendingDeposits = depositsData?.filter((d: any) => d.status === 'PENDING') || [];
  const pendingWithdrawals = withdrawalsData?.filter((w: any) => w.status === 'PENDING') || [];
  const activeTournaments = tournamentsData?.filter((t: any) => t.status === 'UPCOMING' || t.status === 'LIVE') || [];

  // Process dynamic 7-day revenue chart data based on real deposits
  const getProcessedChartData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return {
        dateStr: d.toDateString(),
        dayName: days[d.getDay()],
        rawDate: d,
        Revenue: 0,
        DepositsCount: 0,
      };
    }).reverse();

    if (depositsData) {
      depositsData.forEach((dep: any) => {
        const depDate = new Date(dep.createdAt);
        const match = last7Days.find(
          (day) => day.rawDate.toDateString() === depDate.toDateString()
        );
        if (match) {
          if (dep.status === 'APPROVED') {
            match.Revenue += Number(dep.amount);
          }
          match.DepositsCount += 1;
        }
      });
    }

    return last7Days.map((d) => ({
      name: d.dayName,
      Revenue: d.Revenue,
      Deposits: d.DepositsCount,
    }));
  };

  const revenueData = getProcessedChartData();

  const cards = [
    {
      title: 'Pending Deposits',
      value: pendingDeposits.length,
      icon: ArrowDownRight,
      color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
      description: 'UPI screenshot verification requests',
    },
    {
      title: 'Pending Withdraws',
      value: pendingWithdrawals.length,
      icon: ArrowUpLeft,
      color: 'from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-400',
      description: 'Payout requests pending approval',
    },
    {
      title: 'Upcoming Matches',
      value: activeTournaments.length,
      icon: Trophy,
      color: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400',
      description: 'Tournaments in upcoming registration',
    },
    {
      title: 'Total Matches',
      value: tournamentsData?.length || 0,
      icon: Activity,
      color: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
      description: 'System registered tournaments',
    },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Dashboard Overview</h1>
          <p className="text-slate-400 text-sm mt-1">
            Realtime operations monitoring, wallet transactions verification, and live match control
          </p>
        </div>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={`bg-gradient-to-br ${card.color} border rounded-3xl p-6 transition-all duration-300 hover:scale-[1.02] shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold tracking-wider uppercase opacity-80">
                  {card.title}
                </span>
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                  <Icon size={20} />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-4xl font-extrabold tracking-tight">{card.value}</span>
                <p className="text-xs mt-2 opacity-60 font-medium">{card.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Revenue & Growth</h2>
              <p className="text-slate-400 text-xs mt-1">Platform deposit volumes over the last 7 days</p>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '16px',
                  }}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick action warnings / Alerts sidebar */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col h-full">
          <h2 className="text-xl font-bold text-white mb-6">Action Items</h2>
          
          <div className="flex-1 space-y-4 overflow-y-auto">
            {pendingDeposits.length > 0 ? (
              <div className="flex items-start gap-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <AlertCircle size={20} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-300">Pending UPI Deposits</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    You have {pendingDeposits.length} deposit requests waiting for verification.
                  </p>
                  <a href="/deposits" className="text-xs font-bold text-emerald-400 hover:underline mt-2.5 inline-block">
                    Review Transactions &rarr;
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4 p-4 bg-slate-800/25 border border-slate-800 rounded-2xl">
                <AlertCircle size={20} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-400">Deposits Cleared</h4>
                  <p className="text-xs text-slate-400 mt-1">No manual deposits pending review.</p>
                </div>
              </div>
            )}

            {pendingWithdrawals.length > 0 ? (
              <div className="flex items-start gap-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <AlertCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-rose-300">Pending Withdrawals</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    You have {pendingWithdrawals.length} withdrawal payout requests pending.
                  </p>
                  <a href="/withdrawals" className="text-xs font-bold text-rose-400 hover:underline mt-2.5 inline-block">
                    Approve Payouts &rarr;
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4 p-4 bg-slate-800/25 border border-slate-800 rounded-2xl">
                <AlertCircle size={20} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-400">Withdrawals Cleared</h4>
                  <p className="text-xs text-slate-400 mt-1">No withdrawals pending verification.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
