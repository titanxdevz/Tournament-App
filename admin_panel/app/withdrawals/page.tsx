'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Check, X, CreditCard } from 'lucide-react';

export default function WithdrawalsPage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Fetch withdrawals query
  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ['admin-withdrawals'],
    queryFn: async () => {
      const { data } = await api.get('/wallet/admin/withdrawals');
      return data.withdrawals || [];
    },
  });

  // Verify withdrawal mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) => {
      const { data } = await api.post(`/wallet/admin/withdrawals/${id}/verify`, {
        status,
        rejectionReason: reason,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      setSelectedRequest(null);
      setRejectionReason('');
      setShowRejectForm(false);
    },
  });

  const handleApprove = (id: string) => {
    if (confirm('Are you sure you want to approve this withdrawal? Ensure funds are sent to the UPI address listed.')) {
      verifyMutation.mutate({ id, status: 'APPROVED' });
    }
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    verifyMutation.mutate({
      id: selectedRequest.id,
      status: 'REJECTED',
      reason: rejectionReason,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-white">Withdrawals Review</h1>
        <div className="h-64 flex items-center justify-center bg-slate-900/20 border border-slate-800 rounded-3xl animate-pulse">
          <span className="text-slate-400 text-sm">Loading transactions list...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Withdrawal Reviews</h1>
        <p className="text-slate-400 text-sm mt-1">Approve player winning balance payout transfers</p>
      </div>

      {/* Table */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/60 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="py-4 px-6">User Details</th>
                <th className="py-4 px-6">Amount Requested</th>
                <th className="py-4 px-6">Recipient UPI</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {withdrawals.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-800/10 transition duration-150">
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-200">{item.user?.name || 'N/A'}</p>
                    <p className="text-xs text-slate-405 mt-0.5">{item.user?.email}</p>
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-200">₹{item.amount}</td>
                  <td className="py-4 px-6 font-mono text-slate-350">{item.upiId}</td>
                  <td className="py-4 px-6">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        item.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                          : item.status === 'REJECTED'
                          ? 'bg-rose-500/10 text-rose-455 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-450 border border-amber-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-500'
                            : item.status === 'REJECTED'
                            ? 'bg-rose-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => {
                        setSelectedRequest(item);
                        setShowRejectForm(false);
                        setRejectionReason('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition duration-300"
                    >
                      <CreditCard size={14} />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              ))}
              {withdrawals.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500 font-medium">
                    No withdrawal requests submitted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Side Drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setSelectedRequest(null)} />
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-8 overflow-y-auto flex flex-col gap-6 shadow-2xl z-10">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Verify Payout Request</h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Payout Amount</p>
                  <p className="text-2xl font-black text-rose-455 mt-1">₹{selectedRequest.amount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase">Recipient Target UPI</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-md font-bold text-slate-200 select-all font-mono bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
                      {selectedRequest.upiId}
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedRequest.upiId);
                        alert('UPI Address copied to clipboard!');
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-850">
                  <p className="text-xs text-slate-500 font-bold uppercase">User Account</p>
                  <p className="text-sm font-semibold text-slate-300 mt-1">
                    {selectedRequest.user?.name} ({selectedRequest.user?.email})
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-550/20 text-xs text-amber-300 leading-relaxed">
                <p className="font-bold">⚠️ Transfer Verification Instruction:</p>
                <p className="mt-1">
                  1. Open your UPI business app and scan/input the recipient UPI address.
                  2. Transfer exactly **₹{selectedRequest.amount}** to the target user.
                  3. Once the transfer is complete, click **Approve** below to mark the transaction as cleared.
                </p>
              </div>
            </div>

            {/* Actions */}
            {selectedRequest.status === 'PENDING' && (
              <div className="space-y-4 pt-4 border-t border-slate-800">
                {!showRejectForm ? (
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleApprove(selectedRequest.id)}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition duration-300"
                    >
                      <Check size={18} />
                      <span>Mark Paid / Approve</span>
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1 py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-455 font-bold rounded-2xl border border-rose-600/20 flex items-center justify-center gap-2 transition duration-300"
                    >
                      <X size={18} />
                      <span>Reject Request</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRejectSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Reason for Payout Rejection
                      </label>
                      <textarea
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g. Account name mismatch, Suspicious wallet activity logged"
                        required
                        className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-850 text-slate-100 placeholder-slate-655 focus:outline-none focus:border-rose-500/80 transition duration-300"
                      />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition duration-300"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRejectForm(false)}
                        className="py-3 px-6 bg-slate-800 text-slate-300 font-bold rounded-2xl transition duration-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
