'use client';
import React, { useState } from 'react';
import axios from 'axios';

export default function ChannelFetchPage() {
  const [url, setUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [channelData, setChannelData] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError('You must accept the legal consent to proceed.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/youtube/channel-videos', {
        channelUrl: url,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChannelData(response.data);
      setSelectedIds([]); // Reset selection
      setUrl(''); 
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to scan channel');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === channelData.fetchedVideos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(channelData.fetchedVideos.map((v: any) => v.videoId));
    }
  };

  const handleBatchProcess = async () => {
    if (selectedIds.length === 0) return;
    setProcessing(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const selectedVideos = channelData.fetchedVideos
        .filter((v: any) => selectedIds.includes(v.videoId))
        .map((v: any) => ({
          videoId: v.videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          duration: v.duration,
          sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`
        }));

      await axios.post('http://localhost:5000/api/jobs/batch', {
        items: selectedVideos,
        outputType: 'mp4',
        consentAccepted: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Successfully initiated ${selectedIds.length} jobs! Check progress in History.`);
      setSelectedIds([]);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to initiate batch jobs');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h2 className="text-3xl font-bold mb-8 text-foreground">Channel Scan & Fetch</h2>
      
      <form onSubmit={handleScan} className="space-y-6 bg-card p-6 rounded-xl border border-secondary/50 shadow-sm mb-12">
        <div>
          <label className="block text-sm font-medium mb-2">YouTube Channel URL or @Handle</label>
          <input 
            type="text" 
            required
            className="w-full p-3 rounded-lg border bg-background text-foreground focus:ring-2 focus:ring-accent outline-none"
            placeholder="https://www.youtube.com/@supercdrama"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="p-4 bg-muted rounded-lg border border-yellow-500/30">
          <label className="flex items-start gap-4 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 accent-accent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span className="text-sm text-muted-foreground leading-relaxed">
              I certify that I have the legal authority to process content from this channel. 
              <strong> TubeFetch Pro verifies consent for all channel scans.</strong>
            </span>
          </label>
        </div>

        {error && <p className="text-red-500 text-sm font-medium p-3 bg-red-500/10 rounded-lg">{error}</p>}
        {success && <p className="text-green-500 text-sm font-medium p-3 bg-green-500/10 rounded-lg">{success}</p>}

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-accent text-white font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50 transition shadow-lg"
        >
          {loading ? 'Scanning Channel...' : 'Scan Channel'}
        </button>
      </form>

      {channelData && (
        <div className="bg-card p-6 rounded-xl border border-secondary/50 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">Found Videos: {channelData.channelName}</h3>
            <div className="flex gap-4">
              <button 
                onClick={toggleSelectAll}
                className="text-sm font-medium text-accent hover:underline"
              >
                {selectedIds.length === channelData.fetchedVideos.length ? 'Deselect All' : 'Select All'}
              </button>
              <button 
                disabled={selectedIds.length === 0 || processing}
                onClick={handleBatchProcess}
                className="px-6 py-2 bg-accent text-white rounded-lg font-bold disabled:opacity-50 hover:bg-blue-600 transition shadow-md"
              >
                {processing ? 'Initiating...' : `Process Selected (${selectedIds.length})`}
              </button>
            </div>
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {channelData.fetchedVideos.map((video: any) => (
              <div 
                key={video.videoId} 
                className={`flex gap-4 items-center p-4 border rounded-lg transition cursor-pointer ${selectedIds.includes(video.videoId) ? 'bg-accent/5 border-accent' : 'bg-background/50 hover:border-accent/30'}`}
                onClick={() => toggleSelect(video.videoId)}
              >
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(video.videoId)}
                  readOnly
                  className="w-5 h-5 accent-accent"
                />
                <img src={video.thumbnail} className="w-24 h-14 object-cover rounded shadow-sm" alt={video.title} />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{video.title}</h4>
                  <p className="text-xs text-muted-foreground">ID: {video.videoId} | Duration: {video.duration}s</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
