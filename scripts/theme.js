const THEMES = {
  dark: {
    name: 'dark',
    bg: '#0d1117',
    border: '#30363d',
    ink: '#e6edf3',
    muted: '#8d96a0',
    grid: '#21262d',
    chipBg: '#161b22',
    shine: 'rgba(255,255,255,0.22)',
    accent: '#2f81f7',
    accentHi: '#79c0ff',
  },
  light: {
    name: 'light',
    bg: '#ffffff',
    border: '#d0d7de',
    ink: '#1f2328',
    muted: '#656d76',
    grid: '#eaeef2',
    chipBg: '#f6f8fa',
    shine: 'rgba(255,255,255,0.55)',
    accent: '#0969da',
    accentHi: '#54aeff',
  },
};

const fmt = (n) => Number(n || 0).toLocaleString('en-US').replace(/,/g, ' ');
const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const escapeXML = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sharedCSS() {
  return `
    .fade { opacity: 0; animation: fadein .5s ease-out forwards; }
    .chip { opacity: 0; animation: rise .5s ease-out both; }
    .late { opacity: 0; animation: fadein .45s ease-out 1.5s forwards; }
    @keyframes fadein { to { opacity: 1; } }
    @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes breathe { from { opacity: .15; } to { opacity: .5; } }
    @keyframes ping { 0% { transform: scale(.5); opacity: .8; } 55% { transform: scale(2.4); opacity: 0; } 100% { transform: scale(2.4); opacity: 0; } }
    @keyframes sweep { 0% { transform: translateX(0) skewX(-14deg); } 22% { transform: translateX(1115px) skewX(-14deg); } 100% { transform: translateX(1115px) skewX(-14deg); } }
  `;
}

module.exports = { THEMES, fmt, fmtK, MONTH_NAMES, escapeXML, sharedCSS };
