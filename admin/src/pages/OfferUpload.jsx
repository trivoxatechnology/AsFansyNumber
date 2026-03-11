import { useState } from 'react';
import ManualUpdateTab from '../components/offer/ManualUpdateTab';
import ExcelUploadTab from '../components/offer/ExcelUploadTab';
import { Tag, FileSpreadsheet } from 'lucide-react';

export default function OfferUpload() {
  const [activeTab, setActiveTab] = useState('manual');

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Offer Management</h1>
        <p style={styles.subtitle}>Update offers manually or via Excel injection.</p>
      </div>

      <div style={styles.tabContainer}>
        <button 
          onClick={() => setActiveTab('manual')} 
          style={{...styles.tabBtn, ...(activeTab==='manual' ? styles.activeTabBtn : {})}}
        >
          <Tag size={18} /> Manual Update
        </button>
        <button 
          onClick={() => setActiveTab('excel')} 
          style={{...styles.tabBtn, ...(activeTab==='excel' ? styles.activeTabBtn : {})}}
        >
          <FileSpreadsheet size={18} /> Excel Upload
        </button>
      </div>

      <div style={styles.contentArea}>
        {activeTab === 'manual' ? <ManualUpdateTab /> : <ExcelUploadTab />}
      </div>
    </div>
  );
}

const styles = {
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    marginBottom: '4px'
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem'
  },
  tabContainer: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
    borderBottom: '2px solid var(--border-color)',
    paddingBottom: '16px'
  },
  tabBtn: {
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: 'var(--radius-md)',
    transition: 'all 0.2s ease',
  },
  activeTabBtn: {
    background: 'var(--neon-green-dark)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(122,194,0,0.3)',
  },
  contentArea: {
    minHeight: '600px'
  }
};
