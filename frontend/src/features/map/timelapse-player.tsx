"use client";

import React from "react";
import { Play, Pause, SkipForward, SkipBack, X, Clock } from "lucide-react";

type TimelapsePlayerProps = {
  isPlaying: boolean;
  playbackIndex: number;
  playbackQueue: { label: string; layers: Record<string, unknown> }[];
  pbLoading: boolean;
  pbError: string;
  pbProgressText: string;
  pbStartDate: string;
  pbEndDate: string;
  showPicker: boolean;
  onPlayPause: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onSeekTo: (idx: number) => void;
  onExit: () => void;
  onClosePicker: () => void;
  onStartPlayback: () => void;
  onSetStartDate: (val: string) => void;
  onSetEndDate: (val: string) => void;
  isMobile?: boolean;
};

export function TimelapsePlayer({
  isPlaying,
  playbackIndex,
  playbackQueue,
  pbLoading,
  pbError,
  pbProgressText,
  pbStartDate,
  pbEndDate,
  showPicker,
  onPlayPause,
  onPrevFrame,
  onNextFrame,
  onSeekTo,
  onExit,
  onClosePicker,
  onStartPlayback,
  onSetStartDate,
  onSetEndDate,
  isMobile,
}: TimelapsePlayerProps) {
  return (
    <>
      {/* Ultra-Compact Video-style Time-Lapse Player */}
      {(isPlaying || playbackQueue.length > 0) && (
        <div className="map-video-mini-player">
          <button
            className="map-video-btn"
            onClick={onPrevFrame}
            type="button"
            title="Previous"
          >
            <SkipBack size={16} fill="currentColor" />
          </button>

          <button
            className={`map-video-btn ${isPlaying ? 'is-active' : ''}`}
            onClick={onPlayPause}
            type="button"
            title={pbLoading ? 'Loading...' : isPlaying ? 'Pause' : playbackIndex >= playbackQueue.length - 1 ? 'Replay' : 'Play'}
            disabled={pbLoading}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" />
            ) : (
              playbackIndex >= playbackQueue.length - 1 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                </svg>
              ) : (
                <Play size={18} fill="currentColor" />
              )
            )}
          </button>

          <button
            className="map-video-btn"
            onClick={onNextFrame}
            type="button"
            title="Next"
          >
            <SkipForward size={16} fill="currentColor" />
          </button>

          <div className="map-video-date-wrap">
            <span className="map-video-date">
              {playbackQueue[playbackIndex]?.label || 'Loading...'}
            </span>
          </div>

          {/* Seeker Bar */}
          <div
            className="map-video-seeker-container"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percent = x / rect.width;
              const newIdx = Math.floor(percent * playbackQueue.length);
              onSeekTo(newIdx);
            }}
          >
            <div className="map-video-seeker-bg" />
            <div
              className="map-video-seeker-fill"
              style={{ width: `${((playbackIndex + 1) / playbackQueue.length) * 100}%` }}
            />
            <div
              className="map-video-seeker-handle"
              style={{ left: `${((playbackIndex + 1) / playbackQueue.length) * 100}%` }}
            />
          </div>

          <div className="map-video-mini-right">
            <span className="map-video-counter">
              {playbackIndex + 1}/{playbackQueue.length}
            </span>

            {pbLoading ? (
              <div className="map-video-spinner" />
            ) : (
              <button
                className="map-video-close"
                onClick={onExit}
                title="Exit"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Time-Lapse Date Picker Modal */}
      {showPicker && (
        <>
          <div className="pb-picker-backdrop" onClick={onClosePicker} />
          <div className={`pb-picker-panel ${isMobile ? 'pb-picker-panel--mobile' : ''}`}>
            <div className="pb-picker-header">
              <div className="pb-picker-title">
                <Clock size={16} />
                Set Time-Lapse Period
              </div>
              <button className="pb-picker-close" onClick={onClosePicker} type="button">×</button>
            </div>

            <div className="pb-picker-body">
              <div className="pb-field">
                <label className="pb-label">Start Date</label>
                <input
                  className="pb-input"
                  type="date"
                  value={pbStartDate}
                  onChange={e => {
                    const newStart = e.target.value;
                    onSetStartDate(newStart);
                    if (newStart) {
                      const d = new Date(newStart);
                      d.setDate(d.getDate() + 7);
                      onSetEndDate(d.toISOString().slice(0, 10));
                    }
                  }}
                />
              </div>
              <div className="pb-field">
                <label className="pb-label">End Date (Max 7 days from start)</label>
                <input className="pb-input" type="date" value={pbEndDate} onChange={e => onSetEndDate(e.target.value)} />
              </div>
              {pbError && <div className="pb-error">{pbError}</div>}
              {pbProgressText && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', textAlign: 'center', padding: '8px 0' }}>
                  {pbProgressText}
                </div>
              )}
            </div>

            <div className="pb-picker-footer">
              <button className="pb-btn-cancel" onClick={onClosePicker} type="button">Cancel</button>
              <button className="pb-btn-play" onClick={onStartPlayback} type="button" disabled={pbLoading}>
                <Play size={14} fill="currentColor" />
                Play
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
