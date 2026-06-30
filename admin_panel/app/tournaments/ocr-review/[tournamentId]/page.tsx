'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../lib/api';
import io from 'socket.io-client';
import { 
  ArrowLeft, 
  Upload, 
  Loader2, 
  ZoomIn, 
  ZoomOut, 
  Check, 
  Search, 
  Plus, 
  X, 
  Trophy, 
  AlertTriangle,
  MoveUp,
  MoveDown,
  Info
} from 'lucide-react';

export default function OcrReviewPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tournamentId = params.tournamentId as string;

  // Zoom/Pan states for screenshot viewer
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Upload/Progress states
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ status: string; progress: number; message: string } | null>(null);

  // Search states for resolving unmatched users
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEditIndex, setActiveEditIndex] = useState<number | null>(null);

  // Local draft players state for editing
  const [editedPlayers, setEditedPlayers] = useState<any[]>([]);

  // Fetch registrations query
  const { data: registrationsData } = useQuery({
    queryKey: ['registrations', tournamentId],
    queryFn: async () => {
      const { data } = await api.get(`/tournaments/${tournamentId}`);
      return data.tournament?.registrations || [];
    }
  });

  // Fetch latest draft results query
  const { data: draftData, isLoading: isLoadingDraft } = useQuery({
    queryKey: ['ocr-draft', tournamentId],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/ocr/draft/${tournamentId}`);
        return data.draft || null;
      } catch (e) {
        return null;
      }
    }
  });

  // Keep local edited state in sync with query data
  useEffect(() => {
    if (draftData?.parsedPlayers) {
      setEditedPlayers(draftData.parsedPlayers);
    }
  }, [draftData]);

  // WebSocket for progress updates
  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const socketUrl = API_BASE.replace('/api', '');
    const socket = io(socketUrl, { transports: ['websocket'] });

    socket.on(`ocr:progress:${tournamentId}`, (data) => {
      setOcrProgress(data);
      if (data.status === 'SUCCESS' || data.status === 'FAILED') {
        queryClient.invalidateQueries({ queryKey: ['ocr-draft', tournamentId] });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [tournamentId, queryClient]);

  // Upload screenshot mutation
  const uploadMutation = useMutation({
    mutationFn: async (uploadFiles: File[]) => {
      const formData = new FormData();
      formData.append('tournamentId', tournamentId);
      uploadFiles.forEach(file => {
        formData.append('file', file);
      });

      const { data } = await api.post('/ocr/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    },
    onMutate: () => {
      setIsUploading(true);
      setOcrProgress({ status: 'PENDING', progress: 0, message: 'Uploading file...' });
    },
    onSuccess: () => {
      setIsUploading(false);
      setFiles([]);
    },
    onError: (err: any) => {
      setIsUploading(false);
      alert(err.response?.data?.error || 'Failed to upload images');
      setOcrProgress(null);
    }
  });

  // Update draft local modification mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (players: any[]) => {
      const { data } = await api.put(`/ocr/draft/${draftData.id}`, { parsedPlayers: players });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-draft', tournamentId] });
      alert('Draft saved successfully');
    }
  });

  // Approve draft (ACID transaction payouts) mutation
  const approveMutation = useMutation({
    mutationFn: async (players: any[]) => {
      const { data } = await api.post(`/ocr/draft/${draftData.id}/approve`, { players });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-draft', tournamentId] });
      alert('Results approved! Payouts, history, and leaderboards successfully processed.');
      router.push('/tournaments');
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to approve results');
    }
  });

  // File picker handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUploadSubmit = () => {
    if (files.length === 0) return;
    uploadMutation.mutate(files);
  };

  // Drag pan screen logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Reordering placements
  const handleMove = (index: number, direction: 'UP' | 'DOWN') => {
    const updated = [...editedPlayers];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;

    // Swap players
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Adjust ranks
    updated[index].rank = index + 1;
    updated[targetIndex].rank = targetIndex + 1;

    setEditedPlayers(updated);
  };

  // Editing kills directly
  const handleKillsChange = (index: number, kills: number) => {
    const updated = [...editedPlayers];
    updated[index].kills = Math.max(0, kills);
    setEditedPlayers(updated);
  };

  // Swap matched user
  const handleResolveUser = (index: number, registration: any) => {
    const updated = [...editedPlayers];
    updated[index].name = registration.inGameName;
    updated[index].uid = registration.inGameId;
    updated[index].matchedUserId = registration.userId;
    updated[index].registrationId = registration.id;
    updated[index].confidence = 1.0;
    delete updated[index].warning;
    setEditedPlayers(updated);
    setActiveEditIndex(null);
    setSearchQuery('');
  };

  // Filter registrations list for search matching
  const filteredRegistrations = registrationsData?.filter((r: any) => {
    const matchStr = `${r.inGameName} ${r.inGameId}`.toLowerCase();
    return matchStr.includes(searchQuery.toLowerCase());
  }) || [];

  const handleApprove = () => {
    // Check if there are unmatched users
    const hasUnmatched = editedPlayers.some(p => !p.matchedUserId);
    if (hasUnmatched) {
      alert('All players must be matched/resolved to active tournament registrations before approval.');
      return;
    }

    if (confirm('Are you sure you want to approve results? This will distribute wallet prizes and finalize leaderboards. This action cannot be undone.')) {
      approveMutation.mutate(editedPlayers);
    }
  };

  // Get active screenshot details
  const activeScreenshot = draftData?.screenshots?.[0] || null;

  return (
    <div className="space-y-6 pb-20 relative text-slate-300 font-sans">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.push('/tournaments')}
          className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-2xl transition duration-300"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">AI-Assisted OCR Results Review</h1>
          <p className="text-slate-400 text-sm mt-1">Verify automated custom room standings captures, resolve names, and payout winnings</p>
        </div>
      </div>

      {/* Draft Setup & Upload Form (if no draft exists yet or is processing) */}
      {(!draftData && !isUploading) ? (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl text-center space-y-6">
          <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-start gap-3 text-left">
            <Info className="text-indigo-400 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-indigo-300 leading-relaxed uppercase">
              <span className="font-bold">Upload Guidelines:</span> Please upload high-resolution screenshots of the final standings (48-player custom room listings). You can upload up to 5 screenshots at once to capture the entire rankings.
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-10 transition duration-300 relative bg-slate-950/20">
            <input 
              type="file" 
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3">
              <Upload size={36} className="text-slate-500" />
              <div className="text-sm font-semibold text-slate-300">Drag & drop your standings screenshots</div>
              <div className="text-xs text-slate-500">Supports PNG, JPG, JPEG, WebP up to 10MB each</div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="text-left bg-slate-950/50 p-4 border border-slate-850 rounded-2xl">
              <div className="text-xs font-black text-slate-400 mb-2 uppercase">Selected Screenshots</div>
              <ul className="space-y-1.5">
                {files.map((file, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex justify-between">
                    <span>{file.name}</span>
                    <span className="text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleUploadSubmit}
            disabled={files.length === 0}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all duration-300 disabled:opacity-50"
          >
            Start Automated Text Processing
          </button>
        </div>
      ) : null}

      {/* WebSocket Progress Indicator */}
      {ocrProgress && (
        <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-4">
          <div className="flex justify-between items-center text-xs font-black uppercase text-slate-400">
            <span>OCR Status: {ocrProgress.status}</span>
            <span>{ocrProgress.progress}%</span>
          </div>
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-850">
            <div 
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${ocrProgress.progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 italic text-center font-medium leading-relaxed">{ocrProgress.message}</p>
        </div>
      )}

      {/* Main OCR Verification Workspace */}
      {draftData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Screenshot side-by-side Panel (5 columns) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col h-[700px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">Original Screenshot</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}
                  className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-450 rounded-lg"
                >
                  <ZoomOut size={16} />
                </button>
                <button 
                  onClick={() => setZoom(prev => Math.min(3, prev + 0.2))}
                  className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-450 rounded-lg"
                >
                  <ZoomIn size={16} />
                </button>
                <button 
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                  className="px-2.5 py-1 text-[10px] bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-450 rounded-lg uppercase font-bold"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Bounding Box Image Container */}
            <div 
              className="flex-1 bg-slate-950 border border-slate-850 rounded-2xl overflow-hidden relative cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {activeScreenshot ? (
                <div
                  className="absolute origin-center transition-transform duration-75 select-none"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    top: '10%',
                    left: '5%',
                    width: '90%',
                    height: '80%'
                  }}
                >
                  <img 
                    src={activeScreenshot.url} 
                    alt="Standings Screenshot" 
                    className="w-full h-full object-contain pointer-events-none"
                  />
                  {/* Bounding Boxes Overlays (if coordinates available) */}
                  {activeScreenshot.boundingBoxes?.map((b: any, index: number) => {
                    const box = b.box;
                    if (!box || box.length < 4) return null;
                    // Bounding coordinates relative representation
                    return (
                      <div 
                        key={index}
                        className="absolute border border-indigo-500/40 bg-indigo-500/10 pointer-events-none group"
                        style={{
                          left: `${box[0].x / 10}%`,
                          top: `${box[0].y / 10}%`,
                          width: `${(box[1].x - box[0].x) / 10}%`,
                          height: `${(box[2].y - box[1].y) / 10}%`
                        }}
                      >
                        <span className="hidden group-hover:block absolute bg-slate-950 text-white text-[8px] px-1 rounded -top-5 left-0 whitespace-nowrap z-30">
                          {b.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                  <span>No screenshots saved</span>
                </div>
              )}
            </div>

            <div className="mt-4 p-4 bg-slate-950/50 border border-slate-850 rounded-2xl">
              <div className="text-[10px] font-black uppercase text-slate-500 mb-1.5">IMAGE HEALTH STATS</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Blur Metric</div>
                  <div className="font-extrabold text-white mt-1">{activeScreenshot?.blur || 'N/A'}</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Brightness</div>
                  <div className="font-extrabold text-white mt-1">{activeScreenshot?.brightness || 'N/A'}</div>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Resolution</div>
                  <div className="font-extrabold text-white mt-1 truncate">{activeScreenshot?.resolution || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Standings Table (7 columns) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">Consolidated Draft Listing</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => saveDraftMutation.mutate(editedPlayers)}
                  disabled={saveDraftMutation.isPending}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 font-bold rounded-xl text-xs uppercase"
                >
                  {saveDraftMutation.isPending ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase shadow-md shadow-emerald-600/10"
                >
                  {approveMutation.isPending ? 'Approving...' : 'Approve & Payout'}
                </button>
              </div>
            </div>

            {/* Players interactive list table */}
            <div className="overflow-x-auto max-h-[500px] border border-slate-850 rounded-2xl bg-slate-950/40">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 border-b border-slate-850 text-slate-400 font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">Rank</th>
                    <th className="py-3 px-4">Player Name</th>
                    <th className="py-3 px-4 w-20 text-center">Kills</th>
                    <th className="py-3 px-4 w-28 text-center">Confidence</th>
                    <th className="py-3 px-4 w-24 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {editedPlayers.map((player, idx) => (
                    <tr key={idx} className={`hover:bg-slate-900/30 ${!player.matchedUserId ? 'bg-rose-500/5' : ''}`}>
                      
                      {/* Rank / Placements */}
                      <td className="py-3.5 px-4 font-black text-center text-white bg-slate-950/20">
                        {player.rank}
                      </td>

                      {/* Username / Match Warning */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-white text-sm">{player.name}</span>
                          {player.uid && <span className="text-[10px] text-slate-500">UID: {player.uid}</span>}
                          {player.warning && (
                            <div className="flex items-center gap-1 text-[9px] text-rose-455 font-bold uppercase mt-1">
                              <AlertTriangle size={10} />
                              <span>{player.warning}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Kills edits */}
                      <td className="py-3.5 px-4 text-center">
                        <input 
                          type="number"
                          value={player.kills}
                          onChange={(e) => handleKillsChange(idx, parseInt(e.target.value) || 0)}
                          className="w-14 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-center font-bold text-slate-200 focus:border-indigo-500"
                        />
                      </td>

                      {/* Confidence indicator badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          player.confidence >= 0.85 
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : player.confidence >= 0.50
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {Math.round(player.confidence * 100)}%
                        </span>
                      </td>

                      {/* Reorder and Re-associate buttons */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => handleMove(idx, 'UP')}
                            disabled={idx === 0}
                            className="p-1 hover:bg-slate-800 border border-transparent hover:border-slate-700 text-slate-500 hover:text-white rounded disabled:opacity-30"
                          >
                            <MoveUp size={12} />
                          </button>
                          <button 
                            onClick={() => handleMove(idx, 'DOWN')}
                            disabled={idx === editedPlayers.length - 1}
                            className="p-1 hover:bg-slate-800 border border-transparent hover:border-slate-700 text-slate-500 hover:text-white rounded disabled:opacity-30"
                          >
                            <MoveDown size={12} />
                          </button>
                          <button 
                            onClick={() => setActiveEditIndex(idx)}
                            className="px-2 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg text-[9px] uppercase font-bold"
                          >
                            Swap
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Swap/Link User Search Modal Overlay */}
      {activeEditIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setActiveEditIndex(null)} />
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl z-10 text-xs font-bold uppercase tracking-wider text-slate-400">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Re-associate Participant</h3>
              <button onClick={() => setActiveEditIndex(null)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search registered players (Name / UID)..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-655 focus:outline-none focus:border-indigo-500/80 transition normal-case font-normal"
                />
                <Search size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-850 rounded-2xl bg-slate-950/20 divide-y divide-slate-850/40">
                {filteredRegistrations.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 font-normal">No registered users matching search query</div>
                ) : (
                  filteredRegistrations.map((reg: any, idx: number) => (
                    <div 
                      key={idx}
                      onClick={() => handleResolveUser(activeEditIndex, reg)}
                      className="p-3.5 flex justify-between items-center hover:bg-indigo-600/10 cursor-pointer transition duration-200"
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-slate-200 font-bold text-sm normal-case">{reg.inGameName}</span>
                        <span className="text-slate-500 text-[10px] mt-0.5">UID: {reg.inGameId}</span>
                      </div>
                      <Plus size={14} className="text-indigo-400" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
