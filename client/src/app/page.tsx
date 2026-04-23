'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import StatusTracker from '@/components/StatusTracker';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:5001/api';

const IconDownload = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const IconCloud = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h11a4 4 0 000-8 6 6 0 00-11.75-1.5A4 4 0 003 15z" />
  </svg>
);

const IconCheck = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const Spinner = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [videoResult, setVideoResult] = useState<any>(null);
  const [channelData, setChannelData] = useState<any>(null);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [userJobIds, setUserJobIds] = useState<string[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<any[]>([]);

  useEffect(() => { historyRef.current = history; }, [history]);

  useEffect(() => {
    const saved = localStorage.getItem('tubefetch_jobs');
    if (saved) setUserJobIds(JSON.parse(saved));
    fetchHistory();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (historyRef.current.some(j => ['pending','processing','converting','uploading','validating'].includes(j.status))) fetchHistory();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(t);
  }, [success]);

  const fetchHistory = async () => {
    try { setHistory((await axios.get(`${API_BASE}/jobs/history`)).data); } catch {}
  };

  const saveIds = (ids: string[]) => {
    const updated = [...userJobIds, ...ids];
    setUserJobIds(updated);
    localStorage.setItem('tubefetch_jobs', JSON.stringify(updated));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return setError('Paste a YouTube URL to get started.');
    setError(''); setSuccess(''); setLoading(true);
    setVideoResult(null); setChannelData(null); setSelectedVideos(new Set());
    try {
      const res = await axios.post(`${API_BASE}/youtube/channel-videos`, { channelUrl: query });
      if (res.data.fetchedVideos?.length > 1) setChannelData(res.data);
      else if (res.data.fetchedVideos?.length === 1) setVideoResult(res.data.fetchedVideos[0]);
      else setError('Nothing found. Check the URL and try again.');
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not connect. Check the URL or try again.');
    } finally { setLoading(false); }
  };

  const clear = () => {
    setQuery(''); setVideoResult(null); setChannelData(null);
    setSelectedVideos(new Set()); setError(''); setSuccess('');
  };

  const directUrl = (videoId: string, type: 'mp3' | 'mp4', quality: string, title: string) =>
    `${API_BASE}/youtube/download?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&type=${type}&quality=${quality}&title=${encodeURIComponent(title || 'download')}`;

  const onDirectClick = () => {
    setError('');
    setSuccess('Preparing your download — your browser will save the file when ready.');
  };

  const saveToLibrary = async (videoId: string, type: 'mp3' | 'mp4', quality = 'high') => {
    setProcessing(true); setError('');
    try {
      const res = await axios.post(`${API_BASE}/jobs/create`, {
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        outputType: type, quality, consentAccepted: true,
      });
      saveIds([res.data._id]);
      fetchHistory();
      setSuccess(`Saving to your library: ${res.data.title}`);
    } catch { setError('Failed to save to library.'); }
    finally { setProcessing(false); }
  };

  const batchSave = async (type: 'mp3' | 'mp4') => {
    if (!selectedVideos.size || !channelData) return;
    setProcessing(true); setError('');
    try {
      const items = channelData.fetchedVideos
        .filter((v: any) => selectedVideos.has(v.videoId))
        .map((v: any) => ({ sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`, videoId: v.videoId, title: v.title, thumbnail: v.thumbnail, duration: v.duration }));
      const res = await axios.post(`${API_BASE}/jobs/batch`, { items, outputType: type, quality: 'high', consentAccepted: true });
      saveIds(res.data.jobIds);
      fetchHistory();
      setSuccess(`${res.data.jobIds.length} videos saving to your library.`);
      setSelectedVideos(new Set());
    } catch { setError('Batch save failed.'); }
    finally { setProcessing(false); }
  };

  const toggleVideo = (id: string) => setSelectedVideos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (!channelData) return;
    const all = channelData.fetchedVideos.map((v: any) => v.videoId);
    setSelectedVideos(prev => prev.size === all.length ? new Set() : new Set(all));
  };

  const deleteJob = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/jobs/${id}`);
      setHistory(prev => prev.filter(h => h._id !== id));
      const updated = userJobIds.filter(j => j !== id);
      setUserJobIds(updated);
      localStorage.setItem('tubefetch_jobs', JSON.stringify(updated));
    } catch {}
  };

  const fmt = (s: number) => s > 0 ? `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}` : '';
  const userJobs = history.filter(h => userJobIds.includes(h._id));

  const MP4_OPTIONS = [{ l: '1080p', q: 'high' }, { l: '720p', q: 'medium' }, { l: '480p', q: 'low' }];
  const MP3_OPTIONS = [{ l: '320 kbps', q: 'high' }, { l: '128 kbps', q: 'low' }];

  return (
    <div className="max-w-4xl mx-auto px-5 pt-12 pb-20">

      {/* Hero */}
      <header className="mb-10">
        <h1 onClick={clear} className="text-3xl sm:text-4xl font-bold tracking-tight cursor-pointer inline-block">
          TubeFetch
        </h1>
        <p className="text-sm text-[#888] mt-2 max-w-xl">
          Paste a YouTube video or channel link. Download instantly to your device, or save it to your online library to watch anytime.
        </p>
      </header>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="https://youtube.com/watch?v=...  or  https://youtube.com/@channel"
          className="flex-1 h-12 px-4 rounded-lg bg-[#181818] border border-[#282828] text-sm text-white placeholder:text-[#444] outline-none focus:border-[#555] transition-colors"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-12 px-6 rounded-lg bg-white text-black text-sm font-semibold hover:bg-[#ddd] transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          {loading ? <><Spinner className="w-4 h-4 text-black" /> Fetching</> : 'Fetch'}
        </button>
      </form>

      {/* Hint row */}
      {!videoResult && !channelData && !error && (
        <p className="text-xs text-[#555] mb-6">Tip: works with single videos, Shorts, and full channel handles like <span className="text-[#888]">@channelname</span>.</p>
      )}

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-red-950/40 border border-red-900/50 rounded-lg">
          <span className="text-red-400 text-sm leading-relaxed">{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 mb-4 bg-green-950/30 border border-green-900/40 rounded-lg">
          <span className="text-green-400 text-sm leading-relaxed">{success}</span>
        </div>
      )}

      <div ref={resultsRef}>

        {/* Single video result */}
        {videoResult && (
          <div className="mt-4 bg-[#141414] border border-[#222] rounded-xl overflow-hidden">
            {/* Video header */}
            <div className="flex flex-col sm:flex-row">
              <div className="sm:w-72 shrink-0 relative bg-black">
                {videoResult.thumbnail && <img src={videoResult.thumbnail} alt="" className="w-full aspect-video object-cover" />}
                {videoResult.duration > 0 && (
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-xs text-white rounded">{fmt(videoResult.duration)}</span>
                )}
              </div>
              <div className="p-5 flex-1 min-w-0">
                <h2 className="text-base font-semibold leading-snug mb-1">{videoResult.title}</h2>
                {videoResult.channelName && <p className="text-xs text-[#666]">{videoResult.channelName}</p>}
              </div>
            </div>

            {/* Download to device section */}
            <div className="px-5 py-4 border-t border-[#222] bg-linear-to-b from-[#151515] to-[#121212]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-green-500/15 text-green-400 flex items-center justify-center">
                  <IconDownload className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Download to your device</p>
                  <p className="text-[11px] text-[#666]">Saves directly to your computer or phone</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                <div>
                  <p className="text-[10px] text-[#666] mb-1.5 uppercase tracking-wider">Video (MP4)</p>
                  <div className="flex gap-1.5">
                    {MP4_OPTIONS.map(o => (
                      <a key={o.q} href={directUrl(videoResult.videoId, 'mp4', o.q, videoResult.title)} onClick={onDirectClick}
                        className="flex-1 text-center py-2 text-xs text-white bg-[#1e1e1e] border border-[#2a2a2a] rounded-md hover:bg-[#262626] hover:border-green-500/40 transition-colors">
                        {o.l}
                      </a>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-[#666] mb-1.5 uppercase tracking-wider">Audio (MP3)</p>
                  <div className="flex gap-1.5">
                    {MP3_OPTIONS.map(o => (
                      <a key={o.q} href={directUrl(videoResult.videoId, 'mp3', o.q, videoResult.title)} onClick={onDirectClick}
                        className="flex-1 text-center py-2 text-xs text-white bg-[#1e1e1e] border border-[#2a2a2a] rounded-md hover:bg-[#262626] hover:border-green-500/40 transition-colors">
                        {o.l}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save to library section */}
            <div className="px-5 py-4 border-t border-[#222]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <IconCloud className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Save to your library</p>
                  <p className="text-[11px] text-[#666]">Keep a copy online — watch again on any device</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => saveToLibrary(videoResult.videoId, 'mp4')} disabled={processing}
                  className="flex-1 py-2 text-xs text-[#ccc] bg-[#1e1e1e] border border-[#2a2a2a] rounded-md hover:text-white hover:border-blue-500/40 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                  {processing ? <Spinner className="w-3 h-3" /> : <IconCloud className="w-3.5 h-3.5" />}
                  Save Video
                </button>
                <button onClick={() => saveToLibrary(videoResult.videoId, 'mp3')} disabled={processing}
                  className="flex-1 py-2 text-xs text-[#ccc] bg-[#1e1e1e] border border-[#2a2a2a] rounded-md hover:text-white hover:border-blue-500/40 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                  {processing ? <Spinner className="w-3 h-3" /> : <IconCloud className="w-3.5 h-3.5" />}
                  Save Audio
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Channel results */}
        {channelData && (
          <div className="mt-4">
            {/* Channel header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-4 bg-[#141414] border border-[#222] rounded-xl">
              <div>
                <h2 className="text-base font-semibold">{channelData.channelName}</h2>
                <p className="text-xs text-[#666] mt-0.5">
                  {channelData.fetchedVideos.length} videos found
                  {selectedVideos.size > 0 && <span className="text-green-400"> · {selectedVideos.size} selected</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleAll} className="px-3 py-1.5 text-xs text-[#aaa] border border-[#2a2a2a] rounded-md hover:text-white hover:border-[#444] transition-colors">
                  {selectedVideos.size === channelData.fetchedVideos.length ? 'Clear all' : 'Select all'}
                </button>
              </div>
            </div>

            {/* Floating batch bar */}
            {selectedVideos.size > 0 && (
              <div className="sticky top-2 z-10 mb-3 p-3 bg-[#181818]/95 backdrop-blur border border-[#2a2a2a] rounded-xl shadow-lg flex items-center justify-between">
                <p className="text-xs text-[#ccc]">
                  <span className="text-green-400 font-medium">{selectedVideos.size}</span> selected — save all to library
                </p>
                <div className="flex gap-2">
                  <button onClick={() => batchSave('mp4')} disabled={processing} className="px-3 py-1.5 text-xs bg-white text-black font-medium rounded-md hover:bg-[#ddd] transition-colors disabled:opacity-40 flex items-center gap-1.5">
                    {processing ? <Spinner className="w-3 h-3 text-black" /> : <IconCloud className="w-3.5 h-3.5" />}
                    Save as Video
                  </button>
                  <button onClick={() => batchSave('mp3')} disabled={processing} className="px-3 py-1.5 text-xs bg-[#2a2a2a] text-white font-medium rounded-md hover:bg-[#333] transition-colors disabled:opacity-40 flex items-center gap-1.5">
                    {processing ? <Spinner className="w-3 h-3" /> : <IconCloud className="w-3.5 h-3.5" />}
                    Save as Audio
                  </button>
                </div>
              </div>
            )}

            {/* Channel video grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {channelData.fetchedVideos.map((v: any) => {
                const sel = selectedVideos.has(v.videoId);
                return (
                  <div key={v.videoId}
                    className={`rounded-xl overflow-hidden border transition-colors ${sel ? 'border-green-500/50 bg-green-500/5' : 'border-[#222] bg-[#141414]'}`}>
                    <div onClick={() => toggleVideo(v.videoId)} className="relative aspect-video bg-black cursor-pointer">
                      <img src={v.thumbnail} className="w-full h-full object-cover" alt="" />
                      <div className={`absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center transition-colors ${sel ? 'bg-green-500' : 'bg-black/70 border border-white/30'}`}>
                        {sel && <IconCheck className="w-3 h-3 text-black" />}
                      </div>
                      {v.duration > 0 && <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[10px] text-white rounded">{fmt(v.duration)}</span>}
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-[#ccc] line-clamp-2 leading-relaxed mb-3 min-h-8">{v.title}</p>
                      <div className="flex gap-1.5">
                        <a href={directUrl(v.videoId, 'mp4', 'high', v.title)} onClick={onDirectClick}
                          className="flex-1 py-1.5 text-center text-[11px] text-[#aaa] bg-[#1e1e1e] border border-[#2a2a2a] rounded hover:text-white hover:border-green-500/40 transition-colors flex items-center justify-center gap-1">
                          <IconDownload className="w-3 h-3" /> MP4
                        </a>
                        <a href={directUrl(v.videoId, 'mp3', 'high', v.title)} onClick={onDirectClick}
                          className="flex-1 py-1.5 text-center text-[11px] text-[#aaa] bg-[#1e1e1e] border border-[#2a2a2a] rounded hover:text-white hover:border-green-500/40 transition-colors flex items-center justify-center gap-1">
                          <IconDownload className="w-3 h-3" /> MP3
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Saved library */}
        <section className="mt-14">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <IconCloud className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Your saved library</h3>
              {userJobs.length > 0 && <span className="text-xs text-[#555]">· {userJobs.length}</span>}
            </div>
          </div>

          {userJobs.length === 0 ? (
            <div className="p-8 text-center bg-[#121212] border border-dashed border-[#222] rounded-xl">
              <IconCloud className="w-6 h-6 text-[#333] mx-auto mb-2" />
              <p className="text-sm text-[#666]">Your library is empty.</p>
              <p className="text-xs text-[#444] mt-1">Tap <span className="text-blue-400">Save to library</span> on any video to keep it here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {userJobs.map(job => (
                <div key={job._id} className="flex items-center gap-4 p-3 bg-[#141414] border border-[#222] rounded-xl hover:border-[#2a2a2a] transition-colors">
                  <div className="w-24 aspect-video rounded-md overflow-hidden bg-black shrink-0 relative">
                    {job.thumbnail && <img src={job.thumbnail} className="w-full h-full object-cover" alt="" />}
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/80 text-[9px] text-white rounded font-medium">
                      {job.outputType?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate font-medium">{job.title || 'Untitled'}</p>
                    <p className="text-[11px] text-[#555] mt-0.5">
                      {job.fileSize ? `${(job.fileSize / 1048576).toFixed(1)} MB` : 'Processing...'}
                    </p>
                  </div>
                  <div className="w-64 shrink-0">
                    <StatusTracker status={job.status} error={job.errorMessage} downloadUrl={job.downloadUrl} onDelete={() => deleteJob(job._id)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="mt-20 pt-6 border-t border-[#1a1a1a] text-center">
        <p className="text-[11px] text-[#333]">TubeFetch · For personal and legal use only. Respect content creators and copyright.</p>
      </footer>
    </div>
  );
}
