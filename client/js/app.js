/* ═══════════════════════════════════════════════════
   GUESSMYMESS CLIENT — APP LOGIC (Socket.IO + UI)
   ═══════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Socket Connection ──────────────────────────────
  const socket = io();

  // ─── Sound Effects (Web Audio API) ────────────────────
  const SoundFX = (() => {
    let audioCtx = null;
    function ctx() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      return audioCtx;
    }

    function play(freq, type, duration, vol = 0.15) {
      try {
        const c = ctx();
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime);
        gain.gain.setValueAtTime(vol, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(c.currentTime);
        osc.stop(c.currentTime + duration);
      } catch(e) { /* ignore audio errors */ }
    }

    return {
      pop:     () => play(600, 'sine', 0.12, 0.12),
      ding:    () => { play(880, 'sine', 0.3, 0.12); setTimeout(() => play(1100, 'sine', 0.25, 0.1), 120); },
      buzz:    () => play(200, 'sawtooth', 0.2, 0.06),
      tick:    () => play(440, 'square', 0.06, 0.04),
      whoosh:  () => { play(300, 'sine', 0.15, 0.05); play(500, 'sine', 0.15, 0.05); },
      fanfare: () => {
        [523, 659, 784, 1047].forEach((f, i) => {
          setTimeout(() => play(f, 'sine', 0.35, 0.1), i * 150);
        });
      },
    };
  })();

  // ─── Avatar Renderer ────────────────────────────────
  // A self-contained system for drawing customizable character avatars

  const AvatarRenderer = (() => {
    // Body colors
    const bodyColors = [
      '#f5d6ba', '#f0c8a0', '#d4a574', '#c68c5a', '#a06830',
      '#7ecfff', '#7eff7e', '#ff7e7e', '#ffcc4d', '#c9a0ff',
      '#ff9dcc', '#a0f0e0', '#ffaf7a', '#b0b0b0', '#ffe066',
    ];

    // Eye styles as draw functions
    const eyeStyles = [
      // 0: Normal round
      (ctx, x, y, s) => {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(x - 5 * s, y, 4 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 5 * s, y, 4 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(x - 4 * s, y + 1 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 6 * s, y + 1 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
      },
      // 1: Happy closed eyes
      (ctx, x, y, s) => {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x - 5 * s, y, 3 * s, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + 5 * s, y, 3 * s, Math.PI, 0); ctx.stroke();
      },
      // 2: Winking  
      (ctx, x, y, s) => {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(x - 5 * s, y, 4 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(x - 4 * s, y + 1 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x + 5 * s, y, 3 * s, Math.PI, 0); ctx.stroke();
      },
      // 3: Angry
      (ctx, x, y, s) => {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(x - 5 * s, y, 4 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 5 * s, y, 4 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(x - 4 * s, y + 1 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 6 * s, y + 1 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
        // Angry brows
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 9 * s, y - 6 * s); ctx.lineTo(x - 1 * s, y - 4 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 11 * s, y - 6 * s); ctx.lineTo(x + 2 * s, y - 4 * s); ctx.stroke();
      },
      // 4: Big sparkle eyes
      (ctx, x, y, s) => {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 5 * s, y, 5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 5 * s, y, 5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4488ff';
        ctx.beginPath(); ctx.arc(x - 5 * s, y, 3 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 5 * s, y, 3 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 6 * s, y - 1 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4 * s, y - 1 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      },
      // 5: X X dead eyes
      (ctx, x, y, s) => {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.8 * s; ctx.lineCap = 'round';
        [-5, 5].forEach(ox => {
          const cx = x + ox * s;
          ctx.beginPath(); ctx.moveTo(cx - 3 * s, y - 3 * s); ctx.lineTo(cx + 3 * s, y + 3 * s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + 3 * s, y - 3 * s); ctx.lineTo(cx - 3 * s, y + 3 * s); ctx.stroke();
        });
      },
      // 6: Sunglasses
      (ctx, x, y, s) => {
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.roundRect(x - 10 * s, y - 4 * s, 8 * s, 7 * s, 2 * s);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(x + 2 * s, y - 4 * s, 8 * s, 7 * s, 2 * s);
        ctx.fill();
        ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.moveTo(x - 2 * s, y); ctx.lineTo(x + 2 * s, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 10 * s, y); ctx.lineTo(x - 13 * s, y - 2 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 10 * s, y); ctx.lineTo(x + 13 * s, y - 2 * s); ctx.stroke();
      },
    ];

    // Mouth styles as draw functions
    const mouthStyles = [
      // 0: Smile
      (ctx, x, y, s) => {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y - 2 * s, 5 * s, 0.2, Math.PI - 0.2); ctx.stroke();
      },
      // 1: Open smile
      (ctx, x, y, s) => {
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#ff6666';
        ctx.beginPath(); ctx.arc(x, y + 1 * s, 3 * s, 0, Math.PI); ctx.fill();
      },
      // 2: Flat line
      (ctx, x, y, s) => {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 4 * s, y); ctx.lineTo(x + 4 * s, y); ctx.stroke();
      },
      // 3: Frown
      (ctx, x, y, s) => {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y + 5 * s, 5 * s, Math.PI + 0.3, -0.3); ctx.stroke();
      },
      // 4: O mouth  
      (ctx, x, y, s) => {
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 3 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#cc4444';
        ctx.beginPath(); ctx.ellipse(x, y + 1 * s, 2 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
      },
      // 5: Tongue out
      (ctx, x, y, s) => {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5 * s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x, y - 2 * s, 5 * s, 0.2, Math.PI - 0.2); ctx.stroke();
        ctx.fillStyle = '#ff6666';
        ctx.beginPath(); ctx.ellipse(x + 1 * s, y + 3 * s, 2.5 * s, 3 * s, 0.1, 0, Math.PI * 2); ctx.fill();
      },
      // 6: Fangs smile
      (ctx, x, y, s) => {
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 2 * s, y + 3 * s); ctx.lineTo(x - 1 * s, y); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 1 * s, y); ctx.lineTo(x + 2 * s, y + 3 * s); ctx.lineTo(x + 3 * s, y); ctx.fill();
      },
    ];

    // Hat/accessory styles
    const hatStyles = [
      // 0: None
      null,
      // 1: Party hat
      (ctx, x, y, s, bodyColor) => {
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(x, y - 18 * s);
        ctx.lineTo(x - 10 * s, y);
        ctx.lineTo(x + 10 * s, y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.arc(x, y - 18 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
        // Stripes
        ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 1.5 * s;
        ctx.beginPath(); ctx.moveTo(x - 6 * s, y - 5 * s); ctx.lineTo(x + 6 * s, y - 5 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 3 * s, y - 11 * s); ctx.lineTo(x + 3 * s, y - 11 * s); ctx.stroke();
      },
      // 2: Top hat
      (ctx, x, y, s) => {
        ctx.fillStyle = '#222';
        ctx.fillRect(x - 8 * s, y - 15 * s, 16 * s, 14 * s);
        ctx.fillRect(x - 12 * s, y - 2 * s, 24 * s, 3 * s);
        ctx.fillStyle = '#cc3333';
        ctx.fillRect(x - 8 * s, y - 5 * s, 16 * s, 2 * s);
      },
      // 3: Crown
      (ctx, x, y, s) => {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(x - 10 * s, y);
        ctx.lineTo(x - 10 * s, y - 10 * s);
        ctx.lineTo(x - 5 * s, y - 5 * s);
        ctx.lineTo(x, y - 12 * s);
        ctx.lineTo(x + 5 * s, y - 5 * s);
        ctx.lineTo(x + 10 * s, y - 10 * s);
        ctx.lineTo(x + 10 * s, y);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#cc9900'; ctx.lineWidth = 1 * s;
        ctx.stroke();
        // Jewels
        ctx.fillStyle = '#ff3333';
        ctx.beginPath(); ctx.arc(x, y - 7 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3366ff';
        ctx.beginPath(); ctx.arc(x - 6 * s, y - 5 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 6 * s, y - 5 * s, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      },
      // 4: Beanie
      (ctx, x, y, s) => {
        ctx.fillStyle = '#5577cc';
        ctx.beginPath(); ctx.arc(x, y, 12 * s, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#3355aa';
        ctx.fillRect(x - 12 * s, y - 2 * s, 24 * s, 4 * s);
        ctx.fillStyle = '#5577cc';
        ctx.beginPath(); ctx.arc(x, y - 12 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
      },
      // 5: Pirate bandana
      (ctx, x, y, s) => {
        ctx.fillStyle = '#cc2222';
        ctx.beginPath(); ctx.arc(x, y + 1 * s, 13 * s, Math.PI + 0.1, -0.1); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 * s;
        ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 3 * s); ctx.lineTo(x + 2 * s, y - 3 * s);
        ctx.lineTo(x + 2 * s, y); ctx.lineTo(x - 2 * s, y); ctx.closePath(); 
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 2 * s, y - 3 * s); ctx.lineTo(x + 2 * s, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 2 * s, y - 3 * s); ctx.lineTo(x - 2 * s, y); ctx.stroke();
      },
      // 6: Flower
      (ctx, x, y, s) => {
        const petalColors = ['#ff6688', '#ff88aa', '#ff99bb'];
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const px = x + 6 * s + Math.cos(angle) * 4 * s;
          const py = y - 5 * s + Math.sin(angle) * 4 * s;
          ctx.fillStyle = petalColors[i % 3];
          ctx.beginPath(); ctx.arc(px, py, 3 * s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.arc(x + 6 * s, y - 5 * s, 2.5 * s, 0, Math.PI * 2); ctx.fill();
      },
      // 7: Horns
      (ctx, x, y, s) => {
        ctx.fillStyle = '#cc3333';
        ctx.beginPath();
        ctx.moveTo(x - 8 * s, y + 2 * s); ctx.lineTo(x - 12 * s, y - 10 * s); ctx.lineTo(x - 3 * s, y); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 8 * s, y + 2 * s); ctx.lineTo(x + 12 * s, y - 10 * s); ctx.lineTo(x + 3 * s, y); ctx.closePath(); ctx.fill();
      },
    ];

    function draw(canvas, avatarData, size) {
      const ctx = canvas.getContext('2d');
      const w = size || canvas.width;
      const h = size || canvas.height;
      canvas.width = w;
      canvas.height = h;
      const s = w / 80; // scale factor
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      const bci = avatarData.bodyColor || 0;
      const ei = avatarData.eyeIndex || 0;
      const mi = avatarData.mouthIndex || 0;
      const hi = avatarData.hatIndex || 0;

      const bodyColor = bodyColors[bci % bodyColors.length];

      // Body (circle)
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(cx, cy + 4 * s, 28 * s, 0, Math.PI * 2);
      ctx.fill();

      // Outline
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      // Eyes
      const eyeFn = eyeStyles[ei % eyeStyles.length];
      eyeFn(ctx, cx, cy - 2 * s, s);

      // Mouth
      const mouthFn = mouthStyles[mi % mouthStyles.length];
      mouthFn(ctx, cx, cy + 12 * s, s);

      // Hat (rendered on top)
      if (hi > 0) {
        const hatFn = hatStyles[hi % hatStyles.length];
        if (hatFn) hatFn(ctx, cx, cy - 22 * s, s, bodyColor);
      }
    }

    // Create a small canvas with the rendered avatar  
    function createAvatarElement(avatarData, size) {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      c.className = 'avatar-mini-canvas';
      draw(c, avatarData, size);
      return c;
    }

    return {
      bodyColors,
      eyeCount: eyeStyles.length,
      mouthCount: mouthStyles.length,
      hatCount: hatStyles.length,
      draw,
      createAvatarElement,
    };
  })();

  // ─── State ──────────────────────────────────────────
  let myId = null;
  let myName = '';
  let roomCode = '';
  let isHost = false;
  let isDrawing = false;
  let currentDrawerId = null;
  let hasGuessed = false;
  let timerTotal = 80;

  // Avatar customization state
  let avatarState = { bodyColor: 0, eyeIndex: 0, mouthIndex: 0, hatIndex: 0 };
  let activeAvatarCategory = 'bodyColor';
  const categoryMaxes = {
    bodyColor: AvatarRenderer.bodyColors.length,
    eyeIndex: AvatarRenderer.eyeCount,
    mouthIndex: AvatarRenderer.mouthCount,
    hatIndex: AvatarRenderer.hatCount,
  };

  // ─── DOM Elements ───────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Screens
  const landingScreen = $('#landing-screen');
  const lobbyScreen = $('#lobby-screen');
  const gameScreen = $('#game-screen');
  const resultsScreen = $('#results-screen');
  const allScreens = [landingScreen, lobbyScreen, gameScreen, resultsScreen];

  // Landing
  const usernameInput = $('#username-input');
  const createRoomBtn = $('#create-room-btn');
  const joinRoomBtnMain = $('#join-room-btn-main');
  const joinRoomRow = $('#join-room-row');
  const roomCodeInput = $('#room-code-input');
  const joinRoomBtn = $('#join-room-btn');
  const landingError = $('#landing-error');
  const avatarCanvas = $('#avatar-canvas');
  const avatarPrev = $('#avatar-prev');
  const avatarNext = $('#avatar-next');
  const avatarCatBtns = $$('.avatar-cat-btn');

  // Lobby
  const lobbyRoomCode = $('#lobby-room-code');
  const copyCodeBtn = $('#copy-code-btn');
  const lobbyPlayerList = $('#lobby-player-list');
  const startGameBtn = $('#start-game-btn');
  const lobbyHint = $('#lobby-hint');

  // Game
  const roundCurrent = $('#round-current');
  const roundMax = $('#round-max');
  const wordHint = $('#word-hint');
  const timerText = $('#timer-text');
  const timerCircle = $('#timer-ring');
  const scoreboardList = $('#scoreboard-list');
  const chatMessages = $('#chat-messages');
  const chatInput = $('#chat-input');
  const sendBtn = $('#send-btn');
  const toolbar = $('#toolbar');

  // Word Modal
  const wordModal = $('#word-modal');
  const wordChoices = $('#word-choices');

  // Results
  const podium = $('#podium');
  const resultsList = document.getElementById('results-list');
  const playAgainBtn = document.getElementById('play-again-btn');
  const backToMenuBtn = document.getElementById('back-to-menu-btn');
  // wordChoices already declared above if it was, let me check.
  // Actually I see what happened, I added it at the end of a block that already had it.
  const turnOverlay = document.getElementById('turn-overlay');
  const turnOverlayText = document.getElementById('turn-overlay-text');

  const likeBtn = document.getElementById('like-btn');
  const dislikeBtn = document.getElementById('dislike-btn');

  const scoreboardToggle = document.getElementById('scoreboard-toggle');
  const chatToggle = document.getElementById('chat-toggle');
  const gameBody = document.querySelector('.game-body');
  const scoreboardPanel = document.querySelector('.scoreboard-panel');
  const chatPanel = document.querySelector('.chat-panel');

  // ─── Screen Navigation ──────────────────────────────
  function showScreen(screen) {
    allScreens.forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
  }

  // ─── Avatar Customizer ─────────────────────────────
  function refreshLandingAvatar() {
    AvatarRenderer.draw(avatarCanvas, avatarState, 80);
  }

  // Category buttons
  avatarCatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      activeAvatarCategory = btn.dataset.cat;
      avatarCatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Left/right arrows cycle the active category
  avatarPrev.addEventListener('click', () => {
    const max = categoryMaxes[activeAvatarCategory];
    avatarState[activeAvatarCategory] = (avatarState[activeAvatarCategory] - 1 + max) % max;
    refreshLandingAvatar();
  });

  avatarNext.addEventListener('click', () => {
    const max = categoryMaxes[activeAvatarCategory];
    avatarState[activeAvatarCategory] = (avatarState[activeAvatarCategory] + 1) % max;
    refreshLandingAvatar();
  });

  // Randomize avatar on page load
  avatarState.bodyColor = Math.floor(Math.random() * AvatarRenderer.bodyColors.length);
  avatarState.eyeIndex = Math.floor(Math.random() * AvatarRenderer.eyeCount);
  avatarState.mouthIndex = Math.floor(Math.random() * AvatarRenderer.mouthCount);
  avatarState.hatIndex = Math.floor(Math.random() * AvatarRenderer.hatCount);
  refreshLandingAvatar();

  // ─── Landing Screen Actions ─────────────────────────

  function showError(msg) {
    landingError.textContent = msg;
    setTimeout(() => { landingError.textContent = ''; }, 4000);
  }

  // Create Room = Play button
  createRoomBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (!name) return showError('Please enter your name!');
    if (name.length < 2) return showError('Name must be at least 2 characters.');

    myName = name;
    createRoomBtn.disabled = true;
    createRoomBtn.textContent = 'Creating...';

    socket.emit('createRoom', { username: name, avatar: { ...avatarState } }, (response) => {
      createRoomBtn.disabled = false;
      createRoomBtn.textContent = 'Play!';

      if (response.success) {
        myId = socket.id;
        roomCode = response.roomCode;
        isHost = true;
        enterLobby();
      } else {
        showError(response.error || 'Failed to create room.');
      }
    });
  });

  // Toggle join room row
  joinRoomBtnMain.addEventListener('click', () => {
    const row = joinRoomRow;
    if (row.style.display === 'none') {
      row.style.display = 'flex';
      roomCodeInput.focus();
    } else {
      row.style.display = 'none';
    }
  });

  // Join Room
  joinRoomBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!name) return showError('Please enter your name!');
    if (name.length < 2) return showError('Name must be at least 2 characters.');
    if (!code || code.length !== 4) return showError('Enter a valid 4-character room code.');

    myName = name;
    joinRoomBtn.disabled = true;
    joinRoomBtn.textContent = 'Joining...';

    socket.emit('joinRoom', { roomCode: code, username: name, avatar: { ...avatarState } }, (response) => {
      joinRoomBtn.disabled = false;
      joinRoomBtn.textContent = 'Join';

      if (response.success) {
        myId = socket.id;
        roomCode = response.roomCode;
        isHost = false;
        enterLobby();
      } else {
        showError(response.error || 'Failed to join room.');
      }
    });
  });

  // Enter key shortcuts
  usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createRoomBtn.click();
  });
  roomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoomBtn.click();
  });

  // ─── Lobby ──────────────────────────────────────────

  function enterLobby() {
    showScreen(lobbyScreen);
    lobbyRoomCode.textContent = roomCode;

    if (isHost) {
      startGameBtn.style.display = 'block';
      lobbyHint.textContent = 'You are the host. Click Start Game when ready!';
    } else {
      startGameBtn.style.display = 'none';
      lobbyHint.textContent = 'Waiting for host to start the game...';
    }
  }

  copyCodeBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      copyCodeBtn.textContent = '✅';
      setTimeout(() => { copyCodeBtn.textContent = '📋'; }, 1500);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = roomCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      copyCodeBtn.textContent = '✅';
      setTimeout(() => { copyCodeBtn.textContent = '📋'; }, 1500);
    });
  });

  startGameBtn.addEventListener('click', () => {
    socket.emit('startGame');
  });

  // ─── Player List Rendering ──────────────────────────

  function renderLobbyPlayers(players) {
    lobbyPlayerList.innerHTML = '';
    players.forEach(p => {
      const li = document.createElement('li');

      // Render avatar on a mini canvas
      const avatarEl = AvatarRenderer.createAvatarElement(p.avatar, 36);
      avatarEl.style.borderRadius = '50%';
      avatarEl.style.width = '36px';
      avatarEl.style.height = '36px';
      li.appendChild(avatarEl);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;
      nameSpan.style.fontWeight = '700';
      li.appendChild(nameSpan);

      if (p.id === myId) {
        const youBadge = document.createElement('span');
        youBadge.textContent = ' (You)';
        youBadge.style.color = '#888';
        youBadge.style.fontSize = '0.8em';
        li.appendChild(youBadge);
      }
      lobbyPlayerList.appendChild(li);
    });
  }

  function renderScoreboard(players) {
    scoreboardList.innerHTML = '';
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const rankMap = {};
    sorted.forEach((p, i) => { rankMap[p.id] = i + 1; });

    players.forEach(p => {
      const li = document.createElement('li');
      if (p.isDrawing) li.classList.add('is-drawing');
      if (p.id !== myId && hasGuessedSet.has(p.id)) li.classList.add('has-guessed');

      // Rank
      const rank = document.createElement('span');
      rank.className = 'sb-rank';
      rank.textContent = '#' + rankMap[p.id];
      li.appendChild(rank);

      // Avatar (canvas-rendered)
      const avatarEl = AvatarRenderer.createAvatarElement(p.avatar, 32);
      avatarEl.className = 'sb-avatar';
      avatarEl.style.borderRadius = '50%';
      li.appendChild(avatarEl);

      // Info
      const info = document.createElement('div');
      info.className = 'sb-info';
      const name = document.createElement('div');
      name.className = 'sb-name';
      name.textContent = p.name + (p.id === myId ? ' (You)' : '');
      info.appendChild(name);
      const score = document.createElement('div');
      score.className = 'sb-score';
      score.textContent = p.score + ' points';
      info.appendChild(score);
      li.appendChild(info);

      // Drawing badge
      if (p.isDrawing) {
        const badge = document.createElement('span');
        badge.className = 'sb-drawing-badge';
        badge.textContent = 'DRAWING';
        li.appendChild(badge);
      }

      scoreboardList.appendChild(li);
    });
  }

  // Track who has guessed
  const hasGuessedSet = new Set();

  // ─── Game Entry ─────────────────────────────────────

  function enterGame() {
    showScreen(gameScreen);
    chatMessages.innerHTML = '';
    hasGuessedSet.clear();
    isDrawing = false;
    hasGuessed = false;
    wordHint.textContent = '';
    toolbar.classList.add('hidden');
  }

  // ─── Timer ──────────────────────────────────────────

  function updateTimer(timeLeft) {
    timerText.textContent = timeLeft;
    if (timeLeft <= 15) {
      timerCircle.classList.add('urgent');
    } else {
      timerCircle.classList.remove('urgent');
    }
  }

  // ─── Chat ──────────────────────────────────────────

  function addChatMessage(data) {
    const div = document.createElement('div');
    div.className = 'chat-msg';

    switch (data.type) {
      case 'system':
        div.classList.add('system');
        div.textContent = data.message;
        break;
      case 'correct':
        div.classList.add('correct');
        div.textContent = data.message;
        break;
      case 'close':
        div.classList.add('close-guess');
        div.textContent = data.message;
        break;
      case 'guessed-chat':
        div.classList.add('guessed-chat');
        const authorGuessed = document.createElement('span');
        authorGuessed.className = 'msg-author';
        authorGuessed.textContent = data.playerName + ':';
        div.appendChild(authorGuessed);
        div.appendChild(document.createTextNode(' ' + data.message));
        break;
      case 'drawing-notice':
        div.classList.add('drawing-notice');
        div.textContent = data.message;
        break;
      default:
        const author = document.createElement('span');
        author.className = 'msg-author';
        author.textContent = data.playerName + ':';
        div.appendChild(author);
        div.appendChild(document.createTextNode(' ' + data.message));
    }

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addSystemMessage(msg) {
    addChatMessage({ type: 'system', message: msg });
  }

  function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    socket.emit('chatMessage', msg);
    chatInput.value = '';
  }

  sendBtn.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });

  // ─── Word Selection Modal ──────────────────────────

  function showWordModal(words) {
    wordChoices.innerHTML = '';
    words.forEach(word => {
      const btn = document.createElement('button');
      btn.className = 'word-choice-btn';
      btn.textContent = word;
      btn.addEventListener('click', () => {
        socket.emit('wordSelected', word);
        hideWordModal();
      });
      wordChoices.appendChild(btn);
    });
    wordModal.classList.add('active');
  }

  function hideWordModal() {
    wordModal.classList.remove('active');
  }

  // ─── Turn Overlay ──────────────────────────────────

  function showTurnOverlay(text, duration = 3000) {
    turnOverlayText.textContent = text;
    turnOverlay.classList.add('active');
    setTimeout(() => {
      turnOverlay.classList.remove('active');
    }, duration);
  }

  // ─── Reactions ─────────────────────────────────────

  function sendReaction(type) {
    if (isDrawing) return; // Drawer can't react to themselves
    socket.emit('reaction', type);
    // Visual feedback for sender
    const btn = type === 'like' ? likeBtn : dislikeBtn;
    btn.style.transform = 'scale(1.4)';
    setTimeout(() => btn.style.transform = '', 200)
  }

  function showRemoteReaction(data) {
    const isLike = data.type === 'like';
    const emoji = isLike ? '👍' : '👎';
    
    // 1. Floating Emoji
    const el = document.createElement('div');
    el.className = 'reaction-emoji';
    el.textContent = emoji;
    
    // Random position over canvas
    const wrapperRect = canvas.parentElement.getBoundingClientRect();
    const x = 20 + Math.random() * (wrapperRect.width - 60);
    const y = 20 + Math.random() * (wrapperRect.height - 60);
    
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    canvas.parentElement.appendChild(el);
    setTimeout(() => el.remove(), 2000);

    // 2. Chat log / Toast (keep it subtle)
    if (isLike) SoundFX.pop();
    else SoundFX.buzz();
  }

  likeBtn.addEventListener('click', () => sendReaction('like'));
  dislikeBtn.addEventListener('click', () => sendReaction('dislike'));

  // ─── Mobile Toggles ────────────────────────────────
  function closeSidePanels() {
    scoreboardPanel.classList.remove('active');
    chatPanel.classList.remove('active');
    gameBody.classList.remove('dimmed');
  }

  scoreboardToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = scoreboardPanel.classList.contains('active');
    closeSidePanels();
    if (!isActive) {
      scoreboardPanel.classList.add('active');
      gameBody.classList.add('dimmed');
    }
  });

  chatToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = chatPanel.classList.contains('active');
    closeSidePanels();
    if (!isActive) {
      chatPanel.classList.add('active');
      gameBody.classList.add('dimmed');
    }
  });

  gameBody.addEventListener('click', (e) => {
    if (gameBody.classList.contains('dimmed')) {
      closeSidePanels();
    }
  });

  // ─── Results ───────────────────────────────────────

  function showResults(rankings) {
    showScreen(resultsScreen);

    // Podium (top 3)
    podium.innerHTML = '';
    const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd
    podiumOrder.forEach(idx => {
      if (idx >= rankings.length) return;
      const p = rankings[idx];
      const item = document.createElement('div');
      item.className = 'podium-item';

      const avatarEl = AvatarRenderer.createAvatarElement(p.avatar, 48);
      avatarEl.className = 'podium-avatar';
      avatarEl.style.borderRadius = '50%';
      item.appendChild(avatarEl);

      const nameEl = document.createElement('div');
      nameEl.className = 'podium-name';
      nameEl.textContent = p.name;
      item.appendChild(nameEl);

      const scoreEl = document.createElement('div');
      scoreEl.className = 'podium-score';
      scoreEl.textContent = p.score + ' pts';
      item.appendChild(scoreEl);

      const bar = document.createElement('div');
      bar.className = 'podium-bar';
      // rankings[0] is 1st (Gold), rankings[1] is 2nd (Silver), rankings[2] is 3rd (Bronze)
      // idx 0 -> rankings[1] (2nd), idx 1 -> rankings[0] (1st), idx 2 -> rankings[2] (3rd)
      const medal = idx === 1 ? '🥇' : idx === 0 ? '🥈' : '🥉';
      bar.textContent = medal;
      item.appendChild(bar);

      podium.appendChild(item);
    });

    // Full list
    resultsList.innerHTML = '';
    rankings.forEach(p => {
      const li = document.createElement('li');

      const avatarEl = AvatarRenderer.createAvatarElement(p.avatar, 28);
      avatarEl.className = 'result-avatar';
      avatarEl.style.borderRadius = '50%';
      li.appendChild(avatarEl);

      const nameEl = document.createElement('span');
      nameEl.className = 'result-name';
      nameEl.textContent = p.name + (p.id === myId ? ' (You)' : '');
      li.appendChild(nameEl);

      const scoreEl = document.createElement('span');
      scoreEl.className = 'result-score';
      scoreEl.textContent = p.score + ' pts';
      li.appendChild(scoreEl);

      resultsList.appendChild(li);
    });

    playAgainBtn.style.display = isHost ? 'block' : 'none';
    spawnConfetti();
  }

  playAgainBtn.addEventListener('click', () => {
    socket.emit('playAgain');
  });

  backToMenuBtn.addEventListener('click', () => {
    window.location.reload();
  });

  // ─── Confetti ──────────────────────────────────────

  function spawnConfetti() {
    const colors = ['#ff4757', '#ffa502', '#2ed573', '#1e90ff', '#6c5ce7', '#fd79a8', '#ffd800', '#00cec9', '#ff6b81', '#a29bfe'];
    const shapes = ['circle', 'rect', 'strip'];
    for (let i = 0; i < 120; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 4 + Math.random() * 10;
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = color;
      piece.style.setProperty('--fall-duration', (2.5 + Math.random() * 2.5) + 's');
      piece.style.animationDelay = Math.random() * 1.5 + 's';
      if (shape === 'circle') {
        piece.style.width = size + 'px';
        piece.style.height = size + 'px';
        piece.style.borderRadius = '50%';
      } else if (shape === 'rect') {
        piece.style.width = size + 'px';
        piece.style.height = size * 0.6 + 'px';
        piece.style.borderRadius = '2px';
      } else {
        piece.style.width = size * 0.4 + 'px';
        piece.style.height = size * 1.5 + 'px';
        piece.style.borderRadius = '1px';
      }
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 6000);
    }
    SoundFX.fanfare();
  }

  // ─── Socket.IO Event Handlers ───────────────────────

  socket.on('updatePlayers', (players) => {
    myId = socket.id;
    if (lobbyScreen.classList.contains('active')) {
      renderLobbyPlayers(players);
    }
    if (gameScreen.classList.contains('active')) {
      renderScoreboard(players);
    }
  });

  socket.on('systemMessage', (msg) => {
    if (lobbyScreen.classList.contains('active')) {
      lobbyHint.textContent = msg;
      setTimeout(() => {
        if (isHost) lobbyHint.textContent = 'You are the host. Click Start Game when ready!';
        else lobbyHint.textContent = 'Waiting for host to start the game...';
      }, 3000);
    } else {
      addSystemMessage(msg);
    }
  });

  socket.on('gameStarted', () => {
    enterGame();
  });

  socket.on('newTurn', (data) => {
    currentDrawerId = data.drawerId;
    isDrawing = data.drawerId === socket.id;
    hasGuessed = false;
    hasGuessedSet.clear();

    roundCurrent.textContent = data.round;
    roundMax.textContent = data.maxRounds;
    wordHint.textContent = '';

    if (isDrawing) {
      showTurnOverlay('Your turn to draw! 🎨', 2000);
      toolbar.classList.remove('hidden');
      chatInput.disabled = true;
      chatInput.placeholder = "You're drawing!";
      if (window.SkribblCanvas) window.SkribblCanvas.setDrawingEnabled(true);
    } else {
      showTurnOverlay(data.drawerName + ' is drawing!', 2000);
      toolbar.classList.add('hidden');
      chatInput.disabled = false;
      chatInput.placeholder = 'Type your guess here...';
      if (window.SkribblCanvas) window.SkribblCanvas.setDrawingEnabled(false);
    }

    SoundFX.whoosh();
    addChatMessage({
      type: 'drawing-notice',
      message: isDrawing ? 'Your turn to draw!' : data.drawerName + ' is drawing now!'
    });

    updateTimer(80);
  });

  socket.on('wordChoices', (words) => {
    showWordModal(words);
    SoundFX.pop();
  });

  socket.on('wordSelected_ack', (word) => {
    wordHint.textContent = word;
    wordHint.style.color = '#33cc33';
  });

  socket.on('wordHint', (hint) => {
    if (!isDrawing) {
      wordHint.textContent = hint;
      wordHint.style.color = '';
    }
  });

  socket.on('timerUpdate', (timeLeft) => {
    updateTimer(timeLeft);
    if (timeLeft <= 5 && timeLeft > 0) SoundFX.tick();
  });

  socket.on('chatMessage', (data) => {
    addChatMessage(data);
  });

  socket.on('correctGuess', (data) => {
    hasGuessedSet.add(data.playerId);
    if (data.playerId === socket.id) {
      hasGuessed = true;
      chatInput.disabled = true;
      chatInput.placeholder = 'You guessed it! ✅';
      SoundFX.ding();
    } else {
      SoundFX.pop();
    }
    addChatMessage({
      type: 'correct',
      message: `${data.playerName} guessed the word! (+${data.points} pts)`
    });
  });

  socket.on('turnEnd', (data) => {
    if (data.word) {
      addChatMessage({ type: 'system', message: `The word was: ${data.word}` });
    }
    if (data.reason === 'timeout') showTurnOverlay('⏰ Time\'s up!', 2500);
    else if (data.reason === 'allGuessed') showTurnOverlay('🎉 Everyone guessed it!', 2500);
    else if (data.reason === 'drawerLeft') showTurnOverlay('The drawer left...', 2000);

    toolbar.classList.add('hidden');
    wordHint.style.color = '';
    if (window.SkribblCanvas) window.SkribblCanvas.setDrawingEnabled(false);
    SoundFX.buzz();
  });

  socket.on('clearCanvas', () => {
    if (window.SkribblCanvas) window.SkribblCanvas.clearLocal();
  });

  socket.on('replayCanvas', (drawingData) => {
    if (window.SkribblCanvas) window.SkribblCanvas.replayStrokes(drawingData);
  });

  socket.on('draw', (data) => {
    if (window.SkribblCanvas) window.SkribblCanvas.drawRemote(data);
  });

  socket.on('fill', (data) => {
    if (window.SkribblCanvas) window.SkribblCanvas.fillRemote(data);
  });

  socket.on('reaction', (data) => {
    showRemoteReaction(data);
  });

  socket.on('gameOver', (rankings) => {
    showResults(rankings);
  });

  socket.on('backToLobby', () => {
    enterLobby();
    showScreen(lobbyScreen);
  });

  // ─── Expose for canvas module ───────────────────────
  window.SkribblApp = {
    socket,
    getMyId: () => myId,
    isDrawing: () => isDrawing,
  };

  // ─── Init ──────────────────────────────────────────
  usernameInput.focus();
  console.log('🎨 Skribbl client loaded!');

})();
