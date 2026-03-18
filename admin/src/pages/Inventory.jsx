import { List } from 'lucide-react';

export default function Inventory() {
  return (
    <div className="card">
      <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
        <List size={20} style={{ color: 'var(--primary)' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Inventory Manager</h2>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        This page is under development. Inventory management features coming soon.
      </p>
    </div>
  );
}
