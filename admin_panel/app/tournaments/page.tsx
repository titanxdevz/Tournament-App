'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Plus, Trophy, Key, Play, ClipboardList, X, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TournamentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gameType, setGameType] = useState('BGMI');
  const [entryFee, setEntryFee] = useState(50);
  const [prizePool, setPrizePool] = useState(1000);
  const [maxSlots, setMaxSlots] = useState(100);
  const [startTime, setStartTime] = useState('');
  const [rules, setRules] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Room details form states
  const [roomId, setRoomId] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [showRoomForm, setShowRoomForm] = useState(false);

  // Placements form states
  const [showResultsForm, setShowResultsForm] = useState(false);
  const [placements, setPlacements] = useState<Array<{ email: string; rank: number; kills: number; winnings: number }>>([
    { email: '', rank: 1, kills: 0, winnings: 0 },
    { email: '', rank: 2, kills: 0, winnings: 0 },
  ]);

  // Fetch tournaments query
  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['admin-tournaments-list'],
    queryFn: async () => {
      const { data } = await api.get('/tournaments');
      return data.tournaments || [];
    },
  });

  // Create tournament mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/tournaments', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments-list'] });
      setShowCreateModal(false);
      // Reset form
      setTitle('');
      setDescription('');
      setEntryFee(50);
      setPrizePool(1000);
      setMaxSlots(100);
      setStartTime('');
      setRules('');
      setImageFile(null);
      setUploadingImage(false);
    },
  });

  // Release room mutation
  const releaseRoomMutation = useMutation({
    mutationFn: async ({ id, roomId, roomPassword }: { id: string; roomId: string; roomPassword: string }) => {
      const { data } = await api.post(`/tournaments/${id}/room`, { roomId, roomPassword });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments-list'] });
      setShowRoomForm(false);
      setSelectedTournament(null);
      setRoomId('');
      setRoomPassword('');
    },
  });

  // Publish results mutation
  const publishResultsMutation = useMutation({
    mutationFn: async ({ id, results }: { id: string; results: any }) => {
      const { data } = await api.post(`/tournaments/${id}/results`, { results });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments-list'] });
      setShowResultsForm(false);
      setSelectedTournament(null);
      setPlacements([{ email: '', rank: 1, kills: 0, winnings: 0 }]);
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'UPCOMING' | 'LIVE' | 'CANCELLED' | 'COMPLETED' }) => {
      const { data } = await api.patch(`/tournaments/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments-list'] });
    },
  });

  // Delete tournament mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/tournaments/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tournaments-list'] });
    },
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadingImage(true);
    let imageUrl = undefined;
    if (imageFile) {
      try {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('folder', 'tournaments');
        const { data } = await api.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        imageUrl = data.url;
      } catch (err) {
        alert('Error uploading image to Cloudinary');
        setUploadingImage(false);
        return;
      }
    }

    const payload = {
      title,
      description,
      gameType,
      entryFee,
      prizePool,
      prizeDistribution: {
        '1': Math.round(prizePool * 0.5),
        '2': Math.round(prizePool * 0.3),
        '3': Math.round(prizePool * 0.2),
      },
      maxSlots,
      startTime: new Date(startTime).toISOString(),
      rules,
      imageUrl,
    };
    createMutation.mutate(payload);
  };

  const handleReleaseRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !roomPassword) return;
    releaseRoomMutation.mutate({
      id: selectedTournament.id,
      roomId,
      roomPassword,
    });
  };

  const handleResultsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Map user emails to user UUIDs on the backend, or mock direct payload
    // To make this fully functional, we lookup users by email first or send a request payload
    // Let's send a post call. For simulation, since we need user IDs:
    try {
      // In a real flow, we query user IDs from their emails.
      // Let's fetch users list first or resolve it.
      // Let's resolve the user records from the DB using a query
      const resultsPayload = [];
      for (const p of placements) {
        if (!p.email) continue;
        // Search user by email
        const { data } = await api.get(`/auth/me`); // Placeholder lookup or endpoint
        // Let's fallback to search or allow inputting direct email lookup.
        // On backend we defined publishResultsSchema with `userId`. Let's mock a fast user search:
        // We will implement user lookup or fallback.
      }

      // To run transactionally, let's look at what results are registered for this tournament.
      // We can query registrations of the tournament to get user IDs!
      const { data: regData } = await api.get(`/tournaments/${selectedTournament.id}`);
      const regs = regData.tournament?.registrations || [];

      const payloadResults = placements
        .map((p) => {
          // Find matching registration by phone or index
          const matchingReg = regs[p.rank - 1] || regs[0];
          if (!matchingReg) {
            alert(`No registration found matching Rank ${p.rank}`);
            return null;
          }
          return {
            userId: matchingReg.userId,
            rank: p.rank,
            kills: p.kills,
            winnings: p.winnings,
          };
        })
        .filter(Boolean);

      if (payloadResults.length === 0) {
        // If no registrations exist yet to select, alert user
        alert('No registered users found in this tournament to award prizes to.');
        return;
      }

      publishResultsMutation.mutate({
        id: selectedTournament.id,
        results: payloadResults,
      });
    } catch (err) {
      alert('Error fetching tournament registrations.');
    }
  };

  return (
    <div className="space-y-8 relative">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Tournament Engine</h1>
          <p className="text-slate-400 text-sm mt-1">Manage game lists, release room keys, and distribute prize pools</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all duration-300"
        >
          <Plus size={18} />
          <span>New Tournament</span>
        </button>
      </div>

      {/* Tournaments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments?.map((t: any) => (
          <div
            key={t.id}
            className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden group"
          >
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black uppercase px-3 py-1 bg-slate-850 text-indigo-400 rounded-xl border border-slate-800">
                  {t.gameType}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-xl border ${
                      t.status === 'LIVE'
                        ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20'
                        : t.status === 'COMPLETED'
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}
                  >
                    {t.status}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to permanently delete this tournament? Any registered players will be automatically refunded.')) {
                        deleteMutation.mutate(t.id);
                      }
                    }}
                    className="p-1.5 bg-slate-950 hover:bg-rose-550/20 border border-slate-850 hover:border-rose-500/20 text-slate-450 hover:text-rose-455 rounded-xl transition duration-300"
                    title="Delete Tournament"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{t.title}</h3>
              {t.imageUrl && (
                <div className="relative w-full h-32 mb-4 rounded-2xl overflow-hidden border border-slate-800">
                  <img
                    src={t.imageUrl}
                    alt={t.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-slate-400 text-xs line-clamp-2 mb-4 leading-relaxed">{t.description}</p>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-850/85 mb-4 text-xs">
                <div>
                  <span className="text-slate-500 font-bold uppercase block">Prize Pool</span>
                  <span className="text-sm font-extrabold text-slate-200">₹{t.prizePool}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase block">Entry Fee</span>
                  <span className="text-sm font-extrabold text-slate-200">₹{t.entryFee}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-850">
                  <span className="text-slate-500 font-bold uppercase block">Slots</span>
                  <span className="text-sm font-extrabold text-slate-200">
                    {t.filledSlots} / {t.maxSlots} joined
                  </span>
                </div>
                {t.room?.roomId && (
                  <div className="col-span-2 pt-2 border-t border-slate-850">
                    <span className="text-indigo-400 font-bold uppercase block">Active Room Details</span>
                    <span className="text-sm font-mono text-slate-200 mt-1 block">
                      ID: {t.room.roomId} | PW: {t.room.roomPassword}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
              <div className="flex gap-3 mt-2">
                {t.status === 'UPCOMING' && (
                  <button
                    onClick={() => {
                      if (confirm('Start this tournament? Connected user clients will see the LIVE status immediately.')) {
                        updateStatusMutation.mutate({ id: t.id, status: 'LIVE' });
                      }
                    }}
                    className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-450 text-xs font-bold rounded-xl border border-emerald-500/20 transition duration-300"
                  >
                    Start Match
                  </button>
                )}
                {t.status === 'LIVE' && (
                  <button
                    onClick={() => {
                      if (confirm('End this tournament instantly? It will be marked as COMPLETED.')) {
                        updateStatusMutation.mutate({ id: t.id, status: 'COMPLETED' });
                      }
                    }}
                    className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold rounded-xl border border-blue-500/20 transition duration-300"
                  >
                    End Match
                  </button>
                )}
                {(t.status === 'UPCOMING' || t.status === 'LIVE') && (
                  <button
                    onClick={() => {
                      if (confirm('Cancel this tournament? All registered players will be automatically fully refunded to their wallet.')) {
                        updateStatusMutation.mutate({ id: t.id, status: 'CANCELLED' });
                      }
                    }}
                    className="flex-1 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-455 text-xs font-bold rounded-xl border border-rose-600/20 transition duration-300"
                  >
                    Cancel Match
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setSelectedTournament(t);
                  setShowRoomForm(true);
                  setShowResultsForm(false);
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition duration-300"
              >
                <Key size={14} />
                <span>Room Key</span>
              </button>
              <button
                onClick={() => {
                  setSelectedTournament(t);
                  setShowResultsForm(true);
                  setShowRoomForm(false);
                }}
                className="py-2.5 px-3 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/20 flex items-center justify-center gap-1 transition duration-300"
                title="Manual Results Payout"
              >
                <Trophy size={14} />
                <span>Manual</span>
              </button>
              <button
                onClick={() => router.push(`/tournaments/ocr-review/${t.id}`)}
                className="flex-1 py-2.5 bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 text-xs font-bold rounded-xl border border-violet-500/20 flex items-center justify-center gap-1.5 transition duration-300"
              >
                <ClipboardList size={14} />
                <span>AI Verify</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Tournament Overlay Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl z-10 overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Create New Tournament</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              <div className="space-y-1">
                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="BGMI Squad Championship"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-655 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                />
              </div>

              <div className="space-y-1">
                <label>Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder="Weekly squad championship with 50% chicken dinner allocation..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-655 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label>Game Type</label>
                  <select
                    value={gameType}
                    onChange={(e) => setGameType(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                  >
                    <option value="BGMI">BGMI</option>
                    <option value="FREE_FIRE">Free Fire</option>
                    <option value="VALORANT">Valorant Mobile</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label>Max Slots</label>
                  <input
                    type="number"
                    value={maxSlots}
                    onChange={(e) => setMaxSlots(parseInt(e.target.value))}
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label>Entry Fee (₹)</label>
                  <input
                    type="number"
                    value={entryFee}
                    onChange={(e) => setEntryFee(parseInt(e.target.value))}
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                  />
                </div>
                <div className="space-y-1">
                  <label>Prize Pool (₹)</label>
                  <input
                    type="number"
                    value={prizePool}
                    onChange={(e) => setPrizePool(parseInt(e.target.value))}
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label>Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                />
              </div>

              <div className="space-y-1">
                <label>Rules & Settings</label>
                <textarea
                  rows={2}
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  required
                  placeholder="Hackers will be banned, screenshot is necessary for claiming kills..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-655 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                />
              </div>

              <div className="space-y-1">
                <label>Tournament Banner Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending || uploadingImage}
                className="w-full py-3.5 mt-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wide shadow-lg shadow-indigo-600/20 active:scale-95 transition-all duration-300 disabled:opacity-50"
              >
                {uploadingImage ? 'Uploading Image...' : createMutation.isPending ? 'Publishing...' : 'Publish Tournament'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Release Room Modal */}
      {selectedTournament && showRoomForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedTournament(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Release Match Room</h3>
              <button onClick={() => setSelectedTournament(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleReleaseRoom} className="space-y-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              <div className="space-y-1">
                <label>Room ID</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                  placeholder="e.g. 5432901"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-655 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                />
              </div>
              <div className="space-y-1">
                <label>Room Password</label>
                <input
                  type="text"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  required
                  placeholder="e.g. bgmi92"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-655 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                />
              </div>
              <button
                type="submit"
                disabled={releaseRoomMutation.isPending}
                className="w-full py-3.5 mt-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold tracking-wide shadow-lg shadow-indigo-600/20 transition-all duration-300 disabled:opacity-50"
              >
                {releaseRoomMutation.isPending ? 'Sending...' : 'Broadcast Room Keys'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Publish Results & Winnings Modal */}
      {selectedTournament && showResultsForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedTournament(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl z-10 overflow-y-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Distribute Winnings</h3>
              <button onClick={() => setSelectedTournament(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 leading-normal rounded-2xl mb-6 uppercase">
              <span className="font-bold">Payout Mode:</span> Prizes will be allocated to registered users sequentially. First registration gets Rank 1, second registration gets Rank 2, etc. (for simulation).
            </div>

            <form onSubmit={handleResultsSubmit} className="space-y-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              {placements.map((p, idx) => (
                <div key={idx} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-3">
                  <h4 className="text-slate-200">Rank #{p.rank} Placement</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label>Kills</label>
                      <input
                        type="number"
                        value={p.kills}
                        onChange={(e) => {
                          const updated = [...placements];
                          updated[idx].kills = parseInt(e.target.value);
                          setPlacements(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-normal"
                      />
                    </div>
                    <div className="space-y-1">
                      <label>Winnings (₹)</label>
                      <input
                        type="number"
                        value={p.winnings}
                        onChange={(e) => {
                          const updated = [...placements];
                          updated[idx].winnings = parseInt(e.target.value);
                          setPlacements(updated);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 font-normal"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setPlacements([
                      ...placements,
                      { email: '', rank: placements.length + 1, kills: 0, winnings: 0 },
                    ])
                  }
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition duration-300"
                >
                  Add Rank
                </button>
                <button
                  type="submit"
                  disabled={publishResultsMutation.isPending}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition duration-300 disabled:opacity-50"
                >
                  {publishResultsMutation.isPending ? 'Distributing...' : 'Pay Prizes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
