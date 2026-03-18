import React from 'react';
import { RefreshCw } from 'lucide-react'

export function BannerView({ show, onRetry }) {
  if (!show) return null
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      background: '#fef3c7',
      color: '#d97706',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '0.82rem',
      fontWeight: 700,
      border: '1px solid #fcd34d',
      marginBottom: '16px',
    }}>
      <RefreshCw size={14} />
      <span>
        ⚠️ Server connection disturbed.
        Showing last known data.
      </span>
      <button
        onClick={onRetry}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: '1px solid #d97706',
          borderRadius: '6px',
          padding: '3px 14px',
          cursor: 'pointer',
          color: '#d97706',
          fontWeight: 700,
          fontSize: '0.8rem',
        }}
      >
        ↻ Retry
      </button>
      <span style={{ fontSize: '0.75rem', color: '#92400e' }}>
        Auto-retries every 60s
      </span>
    </div>
  )
}
