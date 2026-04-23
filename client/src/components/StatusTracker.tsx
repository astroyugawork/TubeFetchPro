'use client';
import React from 'react';

type Status = 'pending' | 'validating' | 'processing' | 'converting' | 'uploading' | 'completed' | 'failed';

interface StatusTrackerProps {
  status: Status;
  error?: string;
  downloadUrl?: string;
  onDelete?: () => void;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'Queued',
  validating: 'Checking',
  processing: 'Downloading',
  converting: 'Converting',
  uploading: 'Uploading',
  completed: 'Ready',
  failed: 'Failed',
};

function getStepIndex(status: Status): number {
  const map: Record<string, number> = {
    pending: 0, validating: 0, processing: 1, converting: 2, uploading: 3, completed: 4,
  };
  return map[status] ?? -1;
}

export default function StatusTracker({ status, error, downloadUrl, onDelete }: StatusTrackerProps) {
  const step = getStepIndex(status);
  const failed = status === 'failed';
  const done = status === 'completed';
  const totalSteps = 4;

  return (
    <div className="flex items-center gap-3">
      {/* Progress / action area */}
      <div className="flex-1 min-w-0">
        {done && downloadUrl ? (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-black text-xs font-semibold rounded-md hover:bg-green-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download
          </a>
        ) : failed ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-xs text-red-400 truncate" title={error}>{error || 'Failed'}</span>
          </div>
        ) : (
          <div>
            <div className="flex gap-0.5 mb-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className="flex-1 h-1 rounded-full bg-[#222] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      i < step ? 'bg-blue-500' : i === step ? 'bg-blue-500 animate-pulse' : ''
                    }`}
                    style={{ width: i <= step ? '100%' : '0%' }}
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#888]">{STATUS_LABEL[status]}...</p>
          </div>
        )}
      </div>

      {/* Delete */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="shrink-0 text-[#444] hover:text-red-400 transition-colors"
          title="Remove from library"
          aria-label="Remove from library"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
