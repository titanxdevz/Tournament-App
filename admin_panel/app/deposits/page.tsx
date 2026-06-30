'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Check, X, ShieldAlert, Image as ImageIcon } from 'lucide-react';

export default function DepositsPage() {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Fetch deposits query
  const { data: deposits, isLoading } = useQuery({
    queryKey: ['admin-deposits'],
    queryFn: async () => {
      const { data } = await api.get('/wallet/admin/deposits');
      return data.deposits || [];
    },
  });

  // Verify deposit mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: 'APPROVED' | 'REJECTED'; reason?: string }) => {
      const { data } = await api.post(`/wallet/admin/deposits/${id}/verify`, {
        status,
        rejectionReason: reason,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits'] });
      setSelectedRequest(null);
      setRejectionReason('');
      setShowRejectForm(false);
    },
  });

  const handleApprove = (id: string) => {
    if (confirm('Are you sure you want to approve this deposit? Balance will be credited immediately.')) {
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
        <h1 className="text-3xl font-extrabold text-white">Manual Deposits</h1>
        <div className="h-64 flex items-center justify-center bg-slate-900/20 border border-slate-800 rounded-3xl animate-pulse">
          <span className="text-slate-400 text-sm">Loading transactions list...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Manual UPI Deposits</h1>
          <p className="text-slate-400 text-sm mt-1">Review user screenshot uploads and credit account wallets</p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-900/60 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="py-4 px-6">User / Phone</th>
                <th className="py-4 px-6">Amount</th>
                <th className="py-4 px-6">UTR Code</th>
                <th className="py-4 px-6">Merchant UPI</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {deposits.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-800/10 transition duration-150">
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-200">{item.user?.name || 'N/A'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.user?.email}</p>
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-200">₹{item.amount}</td>
                  <td className="py-4 px-6 font-mono text-slate-350">{item.utr || 'No UTR'}</td>
                  <td className="py-4 px-6 text-slate-400">{item.upiId}</td>
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
                      <ImageIcon size={14} />
                      <span>Review</span>
                    </button>
                  </td>
                </tr>
              ))}
              {deposits.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500 font-medium">
                    No manual deposits submitted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Drawer Sidebar */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setSelectedRequest(null)} />
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-8 overflow-y-auto flex flex-col gap-6 shadow-2xl z-10">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Review UPI Payment</h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-850">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Amount</p>
                <p className="text-lg font-black text-emerald-450 mt-1">₹{selectedRequest.amount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">UTR Code</p>
                <p className="text-sm font-semibold text-slate-200 mt-1 font-mono">{selectedRequest.utr}</p>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-850">
                <p className="text-xs text-slate-500 font-bold uppercase">Sender Profile</p>
                <p className="text-sm font-bold text-slate-300 mt-1">
                  {selectedRequest.user?.name} ({selectedRequest.user?.email})
                </p>
              </div>
            </div>

            {/* Proof Image */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Screenshot</label>
              <div className="relative border border-slate-800 rounded-3xl overflow-hidden aspect-[9/16] max-h-80 bg-slate-950 flex items-center justify-center">
                <img
                  src={selectedRequest.screenshotUrl.startsWith('http') ? selectedRequest.screenshotUrl : `${process.env.NEXT_PUBLIC_ASSET_URL || 'http://localhost:5000'}${selectedRequest.screenshotUrl}`}
                  alt="Proof Screenshot"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback visual mock if screenshot fails to load
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-500 pointer-events-none opacity-20">
                  <ImageIcon size={48} />
                  <span className="text-xs mt-2">No image file found on server disk</span>
                </div>
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
                      <span>Approve Deposit</span>
                    </button>
                    <button
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1 py-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-455 font-bold rounded-2xl border border-rose-600/20 flex items-center justify-center gap-2 transition duration-300"
                    >
                      <X size={18} />
                      <span>Reject</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRejectSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Reason for Rejection
                      </label>
                      <textarea
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g. UTR is invalid, Screenshot belongs to a different transaction"
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
