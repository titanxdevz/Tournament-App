'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Search, Ban, CheckCircle, Wallet, Key, Trash2, X, Plus, Minus } from 'lucide-react';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [adjustingUser, setAdjustingUser] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'winningBalance' | 'depositBalance' | 'bonusBalance' | 'refundBalance'>('depositBalance');
  const [adjustAction, setAdjustAction] = useState<'ADD' | 'REMOVE'>('ADD');

  const [passwordUser, setPasswordUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Fetch users list query
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: async () => {
      const { data } = await api.get('/auth/admin/users');
      return data.users || [];
    },
  });

  // Toggle user status mutation (Ban/Unban)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ACTIVE' | 'BANNED' }) => {
      const { data } = await api.patch(`/auth/admin/users/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
    },
  });

  // Adjust coins mutation
  const adjustCoinsMutation = useMutation({
    mutationFn: async (payload: { id: string; amount: number; type: string; action: string }) => {
      const { data } = await api.post(`/auth/admin/users/${payload.id}/adjust`, {
        amount: payload.amount,
        type: payload.type,
        action: payload.action,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      setAdjustingUser(null);
      setAdjustAmount('');
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (payload: { id: string; password: string }) => {
      const { data } = await api.patch(`/auth/admin/users/${payload.id}/password`, {
        password: payload.password,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      setPasswordUser(null);
      setNewPassword('');
      alert('User password has been successfully updated.');
    },
  });

  // Delete user account mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/auth/admin/users/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
      alert('User account and all linked records permanently deleted.');
    },
  });

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'BANNED' : 'ACTIVE';
    const confirmMsg =
      currentStatus === 'ACTIVE'
        ? 'Are you sure you want to ban this user? They will not be able to log in or register for tournaments.'
        : 'Are you sure you want to reactivate this user?';

    if (confirm(confirmMsg)) {
      toggleStatusMutation.mutate({ id, status: nextStatus });
    }
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(adjustAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    adjustCoinsMutation.mutate({
      id: adjustingUser.id,
      amount: amountNum,
      type: adjustType,
      action: adjustAction,
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    resetPasswordMutation.mutate({
      id: passwordUser.id,
      password: newPassword,
    });
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (
      confirm(
        `🚨 WARNING: Are you sure you want to PERMANENTLY DELETE ${name}'s account?\n\nThis will cascade delete all registrations, tickets, results, and transactions. This action CANNOT be undone.`
      )
    ) {
      deleteUserMutation.mutate(id);
    }
  };

  const filteredUsers = users?.filter((u: any) => {
    const val = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(val) ||
      u.phone?.toLowerCase().includes(val) ||
      u.email?.toLowerCase().includes(val)
    );
  }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-white">User Directory</h1>
        <div className="h-64 flex items-center justify-center bg-slate-900/20 border border-slate-800 rounded-3xl animate-pulse">
          <span className="text-slate-400 text-sm">Loading users list...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">User Directory</h1>
          <p className="text-slate-400 text-sm mt-1">Review player account balances, referral bonuses, and manage active status</p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, phone, email..."
            className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition duration-300 text-sm"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/60 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                <th className="py-4 px-6">Player Details</th>
                <th className="py-4 px-6">Referral Code</th>
                <th className="py-4 px-6">Wallet Balances</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredUsers.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-800/10 transition duration-150">
                  <td className="py-4 px-6">
                    <p className="font-bold text-slate-205 text-md">{item.name}</p>
                    <p className="text-xs text-slate-450 mt-0.5">{item.phone}</p>
                    {item.email && <p className="text-xs text-slate-500 font-mono">{item.email}</p>}
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-350">{item.referralCode}</td>
                  <td className="py-4 px-6">
                    {item.wallet ? (
                      <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-slate-955/80 border border-slate-850 max-w-[220px]">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-bold">Deposit:</span>
                          <span className="font-extrabold text-emerald-450">₹{item.wallet.depositBalance}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-bold">Winnings:</span>
                          <span className="font-extrabold text-amber-450">₹{item.wallet.winningBalance}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-bold">Promo Bonus:</span>
                          <span className="font-extrabold text-rose-455">₹{item.wallet.bonusBalance}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-slate-850/60 pt-1.5">
                          <span className="text-slate-500 font-bold">Refunds:</span>
                          <span className="font-extrabold text-indigo-400">₹{item.wallet.refundBalance}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 font-mono text-xs">No Wallet</span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        item.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex justify-end gap-2">
                      {/* Coins Adjust */}
                      <button
                        onClick={() => setAdjustingUser(item)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-450 hover:text-emerald-400 rounded-xl border border-slate-700 transition"
                        title="Adjust Coins Balance"
                      >
                        <Wallet size={14} />
                      </button>

                      {/* Password Reset */}
                      <button
                        onClick={() => setPasswordUser(item)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-450 hover:text-amber-400 rounded-xl border border-slate-700 transition"
                        title="Reset User Password"
                      >
                        <Key size={14} />
                      </button>

                      {/* Status Block Toggle */}
                      <button
                        onClick={() => handleToggleStatus(item.id, item.status)}
                        className={`p-2 rounded-xl border transition ${
                          item.status === 'ACTIVE'
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-455 border-rose-500/20'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-450 border-emerald-500/20'
                        }`}
                        title={item.status === 'ACTIVE' ? 'Ban User' : 'Activate User'}
                      >
                        {item.status === 'ACTIVE' ? <Ban size={14} /> : <CheckCircle size={14} />}
                      </button>

                      {/* Delete Account */}
                      <button
                        onClick={() => handleDeleteUser(item.id, item.name)}
                        className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-550 hover:text-rose-455 rounded-xl border border-rose-900/20 transition"
                        title="Permanently Delete Account"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 font-medium">
                    No matching users found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Coins Modal */}
      {adjustingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setAdjustingUser(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Adjust User Coins</h3>
              <button onClick={() => setAdjustingUser(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-bold uppercase">Target Player</p>
                <p className="text-sm font-bold text-slate-300">{adjustingUser.name} ({adjustingUser.phone})</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setAdjustAction('ADD')}
                  className={`py-3 rounded-2xl border font-bold flex items-center justify-center gap-2 transition ${
                    adjustAction === 'ADD'
                      ? 'bg-emerald-500/20 text-emerald-450 border-emerald-500/30'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-800/30'
                  }`}
                >
                  <Plus size={16} />
                  <span>Add Coins</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustAction('REMOVE')}
                  className={`py-3 rounded-2xl border font-bold flex items-center justify-center gap-2 transition ${
                    adjustAction === 'REMOVE'
                      ? 'bg-rose-500/20 text-rose-455 border-rose-500/30'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-800/30'
                  }`}
                >
                  <Minus size={16} />
                  <span>Remove Coins</span>
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-450">Wallet Category</label>
                <select
                  value={adjustType}
                  onChange={(e: any) => setAdjustType(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="depositBalance">Deposited Cash</option>
                  <option value="winningBalance">Winning Cash</option>
                  <option value="bonusBalance">Promo Bonus</option>
                  <option value="refundBalance">Refund Balance</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-455">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="pt-4 border-t border-slate-850 flex gap-4">
                <button
                  type="submit"
                  disabled={adjustCoinsMutation.isPending}
                  className="flex-grow py-3.5 bg-indigo-650 hover:bg-indigo-500 text-white font-bold rounded-2xl transition shadow-lg shadow-indigo-650/20"
                >
                  {adjustCoinsMutation.isPending ? 'Processing...' : 'Apply Adjustment'}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustingUser(null)}
                  className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setPasswordUser(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Reset User Password</h3>
              <button onClick={() => setPasswordUser(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-bold uppercase">Target Player</p>
                <p className="text-sm font-bold text-slate-300">{passwordUser.name} ({passwordUser.phone})</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-450">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="pt-4 border-t border-slate-850 flex gap-4">
                <button
                  type="submit"
                  disabled={resetPasswordMutation.isPending}
                  className="flex-grow py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-2xl transition shadow-lg shadow-amber-600/20"
                >
                  {resetPasswordMutation.isPending ? 'Updating...' : 'Change Password'}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordUser(null)}
                  className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
