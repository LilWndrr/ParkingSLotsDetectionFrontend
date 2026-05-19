const fs = require('fs');

const livemapCss = fs.readFileSync('c:/Users/seyfy/Java/carDetection/livemap-frontend/src/index.css', 'utf8');
const frontendCss = fs.readFileSync('c:/Users/seyfy/Java/carDetection/frontend/src/index.css', 'utf8');

// find where dashboard layout starts in frontend
const dashboardIdx = frontendCss.indexOf('/* ========= Dashboard Layout ========= */');
const frontendSpecific = frontendCss.slice(dashboardIdx);

const navbarCss = `
/* ═══════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════ */
.navbar {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.navbar-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}

.navbar-logo {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent-green-dim), var(--accent-blue-dim));
  border-radius: var(--radius-sm);
  color: var(--accent-green);
  border: 1px solid rgba(52, 211, 153, 0.1);
}

.navbar-brand-text {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, var(--text-primary) 30%, var(--accent-green));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 8px;
}

.navbar-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: var(--radius-xs);
  transition: all var(--transition);
}

.navbar-link:hover {
  background: var(--bg-card-elevated);
  color: var(--text-primary);
}

.navbar-link.active {
  background: var(--accent-green-dim);
  color: var(--accent-green);
}

.navbar-hamburger {
  display: none;
  background: none;
  border: none;
  flex-direction: column;
  gap: 5px;
  cursor: pointer;
  padding: 4px;
}

.hamburger-bar {
  width: 24px;
  height: 2px;
  background: var(--text-primary);
  transition: all var(--transition);
}

@media (max-width: 768px) {
  .navbar-hamburger {
    display: flex;
  }
  
  .navbar-links {
    position: absolute;
    top: 64px;
    left: 0;
    right: 0;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-direction: column;
    padding: 16px;
    gap: 12px;
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
    transition: all var(--transition);
    z-index: -1;
  }
  
  .navbar-links.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: auto;
  }
  
  .navbar-link {
    width: 100%;
    justify-content: center;
    padding: 12px;
  }
}
`;

fs.writeFileSync('c:/Users/seyfy/Java/carDetection/parking-frontend/src/index.css', livemapCss + '\n' + navbarCss + '\n' + frontendSpecific);
console.log('CSS merged successfully.');
