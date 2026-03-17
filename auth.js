/* ═══════════════════════════════════════
   Infopet — Pantalla de acceso con efecto IA
   Contraseña: nube o sakura
   ═══════════════════════════════════════ */

(function() {
  const VALID_KEYS = ['nube', 'sakura'];
  const SESSION_KEY = 'infopet_auth';
  const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 horas

  // Verificar si ya está autenticado
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    const { timestamp } = JSON.parse(saved);
    if (Date.now() - timestamp < SESSION_DURATION) return; // sesión válida
    localStorage.removeItem(SESSION_KEY);
  }

  // Crear overlay de login
  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.innerHTML = `
    <style>
      #auth-overlay {
        position: fixed; inset: 0; z-index: 99999;
        background: #0a0e17;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Albert Sans', sans-serif;
        overflow: hidden;
      }

      #auth-overlay canvas {
        position: absolute; inset: 0; z-index: 0;
      }

      #auth-box {
        position: relative; z-index: 2;
        text-align: center;
        padding: 48px;
        max-width: 380px; width: 90%;
      }

      #auth-logo {
        height: 64px;
        border-radius: 10px;
        margin-bottom: 24px;
        opacity: 0;
        animation: authFade 0.8s ease 0.3s forwards;
      }

      #auth-title {
        font-size: 24px;
        font-weight: 300;
        color: #f0f4f8;
        margin-bottom: 6px;
        opacity: 0;
        animation: authFade 0.8s ease 0.5s forwards;
      }

      #auth-title strong { font-weight: 700; }

      #auth-sub {
        font-size: 13px;
        color: #64748b;
        margin-bottom: 32px;
        opacity: 0;
        animation: authFade 0.8s ease 0.6s forwards;
      }

      #auth-input-wrap {
        position: relative;
        opacity: 0;
        animation: authFade 0.8s ease 0.7s forwards;
      }

      #auth-input {
        width: 100%;
        padding: 14px 20px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        background: rgba(255,255,255,0.05);
        color: #f0f4f8;
        font-family: 'Albert Sans', sans-serif;
        font-size: 15px;
        text-align: center;
        letter-spacing: 0.15em;
        outline: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(8px);
      }

      #auth-input:focus {
        border-color: rgba(76, 175, 125, 0.5);
        box-shadow: 0 0 0 3px rgba(76, 175, 125, 0.1), 0 8px 32px rgba(0,0,0,0.3);
      }

      #auth-input::placeholder {
        color: #4a5568;
        letter-spacing: 0.05em;
      }

      #auth-error {
        margin-top: 12px;
        font-size: 12px;
        color: #D45C4A;
        opacity: 0;
        transition: opacity 0.3s;
      }

      #auth-error.show { opacity: 1; }

      #auth-hint {
        margin-top: 24px;
        font-size: 11px;
        color: #334155;
        opacity: 0;
        animation: authFade 0.8s ease 1s forwards;
      }

      /* Efecto de éxito */
      #auth-overlay.success {
        animation: authDissolve 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
      }

      #auth-overlay.success #auth-input {
        border-color: #4CAF7D;
        box-shadow: 0 0 24px rgba(76, 175, 125, 0.3);
      }

      @keyframes authFade {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes authDissolve {
        to { opacity: 0; pointer-events: none; }
      }

      /* Partículas flotantes */
      .particle {
        position: absolute;
        width: 2px; height: 2px;
        background: rgba(76, 175, 125, 0.3);
        border-radius: 50%;
        animation: float linear infinite;
      }

      @keyframes float {
        0% { transform: translateY(100vh) scale(0); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(-10vh) scale(1); opacity: 0; }
      }
    </style>

    <div id="auth-box">
      <img id="auth-logo" src="assets/logo.jpeg" alt="InfoPet"/>
      <div id="auth-title"><strong>InfoPet</strong> Panel</div>
      <div id="auth-sub">Ingresa tu clave de acceso</div>
      <div id="auth-input-wrap">
        <input type="password" id="auth-input" placeholder="· · · · ·" autocomplete="off" autofocus/>
      </div>
      <div id="auth-error">Clave incorrecta</div>
      <div id="auth-hint">Panel de gestión · Infopet Reñaca</div>
    </div>
  `;

  document.body.prepend(overlay);
  document.body.style.overflow = 'hidden';

  // Crear partículas flotantes
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (6 + Math.random() * 10) + 's';
    p.style.animationDelay = Math.random() * 8 + 's';
    p.style.width = p.style.height = (1 + Math.random() * 3) + 'px';
    overlay.appendChild(p);
  }

  // Handle input
  const input = document.getElementById('auth-input');
  const error = document.getElementById('auth-error');

  // Auto-detectar contraseña mientras escribe (sin Enter)
  input.addEventListener('input', function() {
    const val = input.value.trim().toLowerCase();
    if (VALID_KEYS.includes(val)) {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ timestamp: Date.now() }));
      overlay.classList.add('success');
      document.body.style.overflow = '';
      setTimeout(() => overlay.remove(), 1200);
    }
  });

  // También permitir Enter
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const val = input.value.trim().toLowerCase();
      if (!VALID_KEYS.includes(val)) {
        error.classList.add('show');
        input.style.borderColor = 'rgba(212, 92, 74, 0.5)';
        input.style.animation = 'none';
        input.offsetHeight;
        input.style.animation = 'shake 0.4s ease';
        setTimeout(() => {
          input.style.borderColor = 'rgba(255,255,255,0.1)';
          error.classList.remove('show');
        }, 2000);
      }
    }
  });

  // Shake animation
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(shakeStyle);
})();
