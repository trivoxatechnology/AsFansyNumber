import { ShoppingCart, Menu, X, ChevronDown, User, Heart, PhoneCall, HelpCircle, Gift } from 'lucide-react';
import { useState } from 'react';

export default function Navbar({ cartCount, onCartClick }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const toggleDropdown = (name) => {
    if (activeDropdown === name) setActiveDropdown(null);
    else setActiveDropdown(name);
  };

  return (
    <>
      <nav style={styles.nav}>
        <div className="container" style={styles.container}>
          <div style={styles.leftSection}>
            <button 
              style={styles.mobileMenuBtn} 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <a href="#" style={styles.logo}>
              <img 
                src="/logo.png" 
                alt="AsFancyNumber Logo" 
                style={styles.logoImg} 
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <span style={{...styles.logoText, display: 'none'}}>
                As<span className="text-neon">FancyNumber</span>
              </span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <div style={styles.desktopNav}>
            <a href="#" style={styles.navLink}>Home</a>
            <a href="#" style={styles.navLink}>Buy Numbers</a>
            
            {/* Dropdown: VIP Numbers */}
            <div 
              style={styles.dropdownContainer}
              onMouseEnter={() => setActiveDropdown('vip')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button style={styles.dropdownBtn}>
                VIP Numbers <ChevronDown size={14} />
              </button>
              {activeDropdown === 'vip' && (
                <div style={styles.dropdownMenu}>
                  <a href="#" style={styles.dropdownItem}>Penta VIP</a>
                  <a href="#" style={styles.dropdownItem}>Hexa VIP</a>
                  <a href="#" style={styles.dropdownItem}>Septa VIP</a>
                  <a href="#" style={styles.dropdownItem}>Octa VIP</a>
                  <a href="#" style={styles.dropdownItem}>Premium VIP</a>
                  <a href="#" style={styles.dropdownItem}>VVIP Numbers</a>
                </div>
              )}
            </div>

            {/* Dropdown: Categories */}
            <div 
              style={styles.dropdownContainer}
              onMouseEnter={() => setActiveDropdown('cat')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button style={styles.dropdownBtn}>
                Categories <ChevronDown size={14} />
              </button>
              {activeDropdown === 'cat' && (
                <div style={styles.dropdownMenu}>
                  <a href="#" style={styles.dropdownItem}>Repeating</a>
                  <a href="#" style={styles.dropdownItem}>Mirror</a>
                  <a href="#" style={styles.dropdownItem}>Sequential</a>
                  <a href="#" style={styles.dropdownItem}>ABAB Pattern</a>
                  <a href="#" style={styles.dropdownItem}>ABCD Pattern</a>
                  <a href="#" style={styles.dropdownItem}>Palindrome</a>
                  <a href="#" style={styles.dropdownItem}>Lucky Series</a>
                  <a href="#" style={styles.dropdownItem}>Zero Series</a>
                </div>
              )}
            </div>

            {/* Dropdown: More (Special & Business grouped to save space) */}
            <div 
              style={styles.dropdownContainer}
              onMouseEnter={() => setActiveDropdown('more')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button style={styles.dropdownBtn}>
                More <ChevronDown size={14} />
              </button>
              {activeDropdown === 'more' && (
                <div style={{...styles.dropdownMenu, width: '400px', display: 'grid', gridTemplateColumns: '1fr 1fr'}}>
                  <div>
                    <div style={styles.dropdownHeader}>Special Numbers</div>
                    <a href="#" style={styles.dropdownItem}>Couple Numbers</a>
                    <a href="#" style={styles.dropdownItem}>Birthday Numbers</a>
                    <a href="#" style={styles.dropdownItem}>Anniversary</a>
                    <a href="#" style={styles.dropdownItem}>Numerology</a>
                    <a href="#" style={styles.dropdownItem}>Astrology</a>
                  </div>
                  <div>
                    <div style={styles.dropdownHeader}>Business Numbers</div>
                    <a href="#" style={styles.dropdownItem}>Easy Recall</a>
                    <a href="#" style={styles.dropdownItem}>Branding</a>
                    <a href="#" style={styles.dropdownItem}>Marketing</a>
                    <a href="#" style={styles.dropdownItem}>Call Center</a>
                    <a href="#" style={styles.dropdownItem}>Corporate</a>
                  </div>
                </div>
              )}
            </div>

            <a href="#" style={{...styles.navLink, color: 'var(--neon-green-dark)'}}><Gift size={16} /> Offers</a>
            <a href="#" style={styles.navLink}>How it Works</a>
          </div>
          
          <div style={styles.rightActions}>
            <button style={styles.cartBtn} onClick={onCartClick}>
              <ShoppingCart size={20} />
              <span style={styles.cartCount}>{cartCount}</span>
            </button>

            <div 
              style={styles.dropdownContainer}
              onMouseEnter={() => setActiveDropdown('account')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button style={styles.iconBtn}>
                <User size={20} />
              </button>
              {activeDropdown === 'account' && (
                <div style={{...styles.dropdownMenu, right: 0, left: 'auto', width: '200px'}}>
                  <a href="#" style={styles.dropdownItem}><b>My Account</b></a>
                  <a href="#" style={styles.dropdownItem}>My Orders</a>
                  <a href="#" style={styles.dropdownItem}>Wishlist</a>
                  <a href="#" style={styles.dropdownItem}>Saved Numbers</a>
                  <a href="#" style={styles.dropdownItem}>Settings</a>
                  <div style={{height: '1px', background: 'var(--border-color)', margin: '4px 0'}}></div>
                  <a href="#" style={styles.dropdownItem}>Login / Register</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div style={styles.mobileMenu}>
          {/* Scrollable Mobile Nav Items would go here */}
          <div style={styles.mobileNavContent}>
             <a href="#" style={styles.mobileNavLink}>Home</a>
             <a href="#" style={styles.mobileNavLink}>Buy Numbers</a>
             <div style={styles.mobileNavSection}>VIP Numbers</div>
             <a href="#" style={styles.mobileNavSubLink}>Penta VIP</a>
             <a href="#" style={styles.mobileNavSubLink}>Hexa VIP</a>
             <div style={styles.mobileNavSection}>Categories</div>
             <a href="#" style={styles.mobileNavSubLink}>Repeating Numbers</a>
             <a href="#" style={styles.mobileNavSubLink}>Mirror Numbers</a>
             <div style={styles.mobileNavSection}>Other</div>
             <a href="#" style={styles.mobileNavLink}>Special Numbers</a>
             <a href="#" style={styles.mobileNavLink}>Business Numbers</a>
             <a href="#" style={styles.mobileNavLink}>Offers</a>
             <a href="#" style={styles.mobileNavLink}>How it Works</a>
             <a href="#" style={styles.mobileNavLink}>Support</a>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  nav: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: '80px',
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border-color)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    boxShadow: 'var(--shadow-sm)',
  },
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  mobileMenuBtn: {
    display: 'none', // Hidden on desktop
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-main)',
    '@media (max-width: 1100px)': {
      display: 'block'
    }
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoImg: {
    height: '56px',
    width: '56px',
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
  },
  logoText: {
    fontSize: '1.5rem',
    fontWeight: 800,
    letterSpacing: '1px',
    color: 'var(--text-main)',
  },
  desktopNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    // Media query equivalent needed in actual CSS if breaking down
    // '@media (max-width: 1100px)': { display: 'none' }
  },
  navLink: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-main)',
    transition: 'color 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  dropdownContainer: {
    position: 'relative',
    height: '80px', // Match nav height for easy hover
    display: 'flex',
    alignItems: 'center',
  },
  dropdownBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: 'var(--text-main)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 0',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '70px',
    left: 0,
    width: '220px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1001,
  },
  dropdownHeader: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    padding: '8px 12px 4px',
    letterSpacing: '1px',
  },
  dropdownItem: {
    padding: '10px 12px',
    fontSize: '0.9rem',
    color: 'var(--text-main)',
    borderRadius: '4px',
    transition: 'background 0.2s',
    display: 'block',
    textDecoration: 'none',
  },
  rightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '8px',
  },
  cartBtn: {
    background: '#f8fafc',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'var(--transition)',
    fontWeight: 600,
  },
  cartCount: {
    background: 'var(--neon-green-dark)',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: '20px',
    fontWeight: 700,
    fontSize: '0.85rem',
  },
  mobileMenu: {
    position: 'fixed',
    top: '80px',
    left: 0,
    right: 0,
    bottom: 0,
    background: 'var(--bg-main)',
    zIndex: 999,
    padding: '20px',
    overflowY: 'auto',
  },
  mobileNavContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  mobileNavLink: {
    fontSize: '1.2rem',
    fontWeight: 600,
    padding: '12px 0',
    borderBottom: '1px solid var(--border-color)',
  },
  mobileNavSection: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: 700,
    marginTop: '16px',
    letterSpacing: '1px',
  },
  mobileNavSubLink: {
    fontSize: '1rem',
    padding: '8px 0',
    paddingLeft: '16px',
    color: 'var(--text-main)',
  }
};
