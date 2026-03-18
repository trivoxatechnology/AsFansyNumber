import { Archive } from 'lucide-react';

export default function DraftManager() {
  return (
    <div className="card">
      <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
        <Archive size={20} style={{ color: 'var(--primary)' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Draft Manager</h2>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        This page is under development. Draft management features coming soon.
      </p>
    </div>
  );
}
