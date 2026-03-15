/* ═══════════════════════════════════════════════════
   GUESSMYMESS SERVER — MAIN ENTRY POINT
   ═══════════════════════════════════════════════════ */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { getRandomWords, isCloseGuess } = require('./words');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'client')));

// ─── In-Memory State ───────────────────────────────────────────
const rooms = new Map(); // roomCode -> Room object

const ROUND_TIME = 80; // seconds per turn
const MAX_ROUNDS = 3;  // rounds per game
const MAX_PLAYERS = 12;
const HINT_INTERVALS = [0.3, 0.6]; // reveal letters at 30% and 60% of time elapsed

// ─── Helpers ───────────────────────────────────────────────────

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId,
    players: [],
    state: 'lobby', // lobby | playing | finished
    currentRound: 0,
    maxRounds: MAX_ROUNDS,
    roundTime: ROUND_TIME,
    currentDrawerIndex: -1,
    currentWord: null,
    wordChoices: null,
    revealedLetters: [],
    guessedPlayers: new Set(),
    timer: null,
    timeLeft: 0,
    drawingData: [], // strokes for replay on join
  };
  rooms.set(code, room);
  return room;
}

function addPlayer(room, id, name, avatarData) {
  // avatarData: { bodyColor, eyeIndex, mouthIndex, hatIndex }
  const avatar = avatarData || { bodyColor: 0, eyeIndex: 0, mouthIndex: 0, hatIndex: 0 };
  const player = { id, name, score: 0, avatar, isDrawing: false };
  room.players.push(player);
  return player;
}

function removePlayer(room, id) {
  room.players = room.players.filter(p => p.id !== id);
  room.guessedPlayers.delete(id);
}

function getPlayer(room, id) {
  return room.players.find(p => p.id === id);
}

function getRoomByPlayer(socketId) {
  for (const [, room] of rooms) {
    if (room.players.some(p => p.id === socketId)) return room;
  }
  return null;
}

function generateHint(word, revealedIndices) {
  return word.split('').map((ch, i) => {
    if (ch === ' ') return '  ';
    return revealedIndices.includes(i) ? ch : '_';
  }).join(' ');
}

function calculatePoints(timeLeft, totalTime) {
  const fraction = timeLeft / totalTime;
  return Math.round(50 + 450 * fraction); // 50–500 points
}

// ─── Game Logic ────────────────────────────────────────────────

function startRound(room) {
  room.currentRound++;
  room.currentDrawerIndex = -1;
  nextTurn(room);
}

function nextTurn(room) {
  // Clear previous timer
  if (room.timer) clearInterval(room.timer);

  room.currentDrawerIndex++;

  // If we've gone through all players, start new round or end game
  if (room.currentDrawerIndex >= room.players.length) {
    if (room.currentRound >= room.maxRounds) {
      endGame(room);
      return;
    }
    room.currentRound++;
    room.currentDrawerIndex = 0;
  }

  const drawer = room.players[room.currentDrawerIndex];
  if (!drawer) {
    endGame(room);
    return;
  }

  // Reset turn state
  room.players.forEach(p => (p.isDrawing = false));
  drawer.isDrawing = true;
  room.currentWord = null;
  room.wordChoices = getRandomWords(3);
  room.revealedLetters = [];
  room.guessedPlayers = new Set();
  room.drawingData = [];

  // Send word choices to drawer
  io.to(drawer.id).emit('wordChoices', room.wordChoices);

  // Notify everyone of new turn
  io.to(room.code).emit('newTurn', {
    drawerId: drawer.id,
    drawerName: drawer.name,
    round: room.currentRound,
    maxRounds: room.maxRounds,
  });

  io.to(room.code).emit('clearCanvas');
  io.to(room.code).emit('updatePlayers', room.players.map(sanitizePlayer));
}

function startDrawingTimer(room) {
  room.timeLeft = room.roundTime;
  const hintsGiven = new Set();

  room.timer = setInterval(() => {
    room.timeLeft--;

    io.to(room.code).emit('timerUpdate', room.timeLeft);

    // Progressive hints
    if (room.currentWord) {
      const elapsed = room.roundTime - room.timeLeft;
      const fraction = elapsed / room.roundTime;

      HINT_INTERVALS.forEach((threshold, idx) => {
        if (fraction >= threshold && !hintsGiven.has(idx)) {
          hintsGiven.add(idx);
          revealLetter(room);
        }
      });
    }

    // Time's up
    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      io.to(room.code).emit('turnEnd', {
        word: room.currentWord,
        reason: 'timeout',
      });
      setTimeout(() => nextTurn(room), 3000);
    }
  }, 1000);
}

function revealLetter(room) {
  if (!room.currentWord) return;
  const word = room.currentWord;
  const hiddenIndices = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ' && !room.revealedLetters.includes(i)) {
      hiddenIndices.push(i);
    }
  }
  if (hiddenIndices.length === 0) return;
  const revealIdx = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
  room.revealedLetters.push(revealIdx);
  io.to(room.code).emit('wordHint', generateHint(word, room.revealedLetters));
}

function endGame(room) {
  if (room.timer) clearInterval(room.timer);
  room.state = 'finished';

  const rankings = [...room.players].sort((a, b) => b.score - a.score);
  io.to(room.code).emit('gameOver', rankings.map(sanitizePlayer));
}

function sanitizePlayer(p) {
  return { id: p.id, name: p.name, score: p.score, avatar: p.avatar, isDrawing: p.isDrawing };
}

// ─── Socket.IO Events ─────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // ── Create Room ──
  socket.on('createRoom', (data, callback) => {
    const username = typeof data === 'string' ? data : data.username;
    const avatarData = typeof data === 'object' ? data.avatar : null;
    const room = createRoom(socket.id, username);
    const player = addPlayer(room, socket.id, username, avatarData);
    socket.join(room.code);
    callback({ success: true, roomCode: room.code, player: sanitizePlayer(player) });
    io.to(room.code).emit('updatePlayers', room.players.map(sanitizePlayer));
    io.to(room.code).emit('systemMessage', `${username} created the room.`);
  });

  // ── Join Room ──
  socket.on('joinRoom', ({ roomCode, username, avatar }, callback) => {
    const code = roomCode.toUpperCase();
    const room = rooms.get(code);

    if (!room) return callback({ success: false, error: 'Room not found.' });
    if (room.state !== 'lobby') return callback({ success: false, error: 'Game already in progress.' });
    if (room.players.length >= MAX_PLAYERS) return callback({ success: false, error: 'Room is full.' });

    const player = addPlayer(room, socket.id, username, avatar);
    socket.join(code);
    callback({ success: true, roomCode: code, player: sanitizePlayer(player) });
    io.to(code).emit('updatePlayers', room.players.map(sanitizePlayer));
    io.to(code).emit('systemMessage', `${username} joined the room.`);
  });

  // ── Start Game ──
  socket.on('startGame', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;
    if (room.players.length < 2) {
      io.to(socket.id).emit('systemMessage', 'Need at least 2 players to start.');
      return;
    }

    room.state = 'playing';
    room.currentRound = 0;
    room.players.forEach(p => (p.score = 0));
    io.to(room.code).emit('gameStarted');
    startRound(room);
  });

  // ── Word Selected by Drawer ──
  socket.on('wordSelected', (word) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    room.currentWord = word;
    room.wordChoices = null;

    // Send hint to everyone except drawer
    const hint = generateHint(word, []);
    socket.to(room.code).emit('wordHint', hint);
    io.to(drawer.id).emit('wordSelected_ack', word);

    startDrawingTimer(room);
  });

  // ── Drawing Events ──
  socket.on('draw', (data) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    room.drawingData.push(data);
    socket.to(room.code).emit('draw', data);
  });

  socket.on('clearCanvas', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    room.drawingData = [];
    socket.to(room.code).emit('clearCanvas');
  });

  socket.on('undoStroke', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    // Remove last stroke group
    const lastBeginIdx = room.drawingData.map(d => d.type).lastIndexOf('begin');
    if (lastBeginIdx >= 0) {
      room.drawingData = room.drawingData.slice(0, lastBeginIdx);
    }
    // Replay all strokes
    io.to(room.code).emit('replayCanvas', room.drawingData);
  });

  socket.on('fill', (data) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    const drawer = room.players[room.currentDrawerIndex];
    if (!drawer || drawer.id !== socket.id) return;

    room.drawingData.push({ type: 'fill', ...data });
    socket.to(room.code).emit('fill', data);
  });

  // ── Chat / Guess ──
  socket.on('chatMessage', (msg) => {
    const room = getRoomByPlayer(socket.id);
    if (!room) return;
    const player = getPlayer(room, socket.id);
    if (!player) return;

    const trimmed = msg.trim();
    if (!trimmed) return;

    // If game isn't playing, just broadcast chat
    if (room.state !== 'playing' || !room.currentWord) {
      io.to(room.code).emit('chatMessage', {
        playerId: player.id,
        playerName: player.name,
        message: trimmed,
        type: 'chat',
      });
      return;
    }

    // Drawer can't guess
    if (player.isDrawing) {
      io.to(socket.id).emit('chatMessage', {
        playerId: 'system',
        playerName: 'System',
        message: "You can't chat while drawing!",
        type: 'system',
      });
      return;
    }

    // Check if correct guess
    if (!room.guessedPlayers.has(socket.id) && trimmed.toLowerCase() === room.currentWord.toLowerCase()) {
      room.guessedPlayers.add(socket.id);

      // Score for guesser
      const points = calculatePoints(room.timeLeft, room.roundTime);
      player.score += points;

      // Score for drawer (bonus)
      const drawer = room.players[room.currentDrawerIndex];
      if (drawer) drawer.score += Math.round(points * 0.5);

      io.to(room.code).emit('correctGuess', {
        playerId: player.id,
        playerName: player.name,
        points,
      });

      io.to(room.code).emit('updatePlayers', room.players.map(sanitizePlayer));

      // Check if everyone guessed
      const nonDrawers = room.players.filter(p => !p.isDrawing);
      if (room.guessedPlayers.size >= nonDrawers.length) {
        clearInterval(room.timer);
        io.to(room.code).emit('turnEnd', {
          word: room.currentWord,
          reason: 'allGuessed',
        });
        setTimeout(() => nextTurn(room), 3500);
      }
      return;
    }

    // Close guess?
    if (!room.guessedPlayers.has(socket.id) && isCloseGuess(trimmed, room.currentWord)) {
      io.to(socket.id).emit('chatMessage', {
        playerId: 'system',
        playerName: 'System',
        message: "That's close! 🔥",
        type: 'close',
      });
      // Fall through to broadcast as normal chat
    }

    // Normal chat message
    const msgType = room.guessedPlayers.has(socket.id) ? 'guessed-chat' : 'chat';
    io.to(room.code).emit('chatMessage', {
      playerId: player.id,
      playerName: player.name,
      message: trimmed,
      type: msgType,
    });
  });

  socket.on('reaction', (type) => {
    const room = getRoomByPlayer(socket.id);
    if (!room || room.state !== 'playing') return;
    const player = getPlayer(room, socket.id);
    if (!player) return;

    io.to(room.code).emit('reaction', {
      type, // 'like' or 'dislike'
      senderId: socket.id,
      senderName: player.name
    });
  });

  // ── Play Again ──
  socket.on('playAgain', () => {
    const room = getRoomByPlayer(socket.id);
    if (!room || room.hostId !== socket.id) return;

    room.state = 'lobby';
    room.currentRound = 0;
    room.currentDrawerIndex = -1;
    room.currentWord = null;
    room.guessedPlayers = new Set();
    room.drawingData = [];
    room.players.forEach(p => {
      p.score = 0;
      p.isDrawing = false;
    });

    io.to(room.code).emit('backToLobby');
    io.to(room.code).emit('updatePlayers', room.players.map(sanitizePlayer));
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    console.log(`❌ Disconnected: ${socket.id}`);
    const room = getRoomByPlayer(socket.id);
    if (!room) return;

    const player = getPlayer(room, socket.id);
    const wasDrawing = player?.isDrawing;
    const playerName = player?.name || 'A player';

    removePlayer(room, socket.id);

    if (room.players.length === 0) {
      if (room.timer) clearInterval(room.timer);
      rooms.delete(room.code);
      return;
    }

    // Transfer host if needed
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
      io.to(room.hostId).emit('systemMessage', 'You are now the room host.');
    }

    io.to(room.code).emit('systemMessage', `${playerName} left the room.`);
    io.to(room.code).emit('updatePlayers', room.players.map(sanitizePlayer));

    // If drawer left mid-game, skip turn
    if (room.state === 'playing' && wasDrawing) {
      clearInterval(room.timer);
      io.to(room.code).emit('turnEnd', {
        word: room.currentWord,
        reason: 'drawerLeft',
      });
      // Adjust drawer index since a player was removed
      if (room.currentDrawerIndex >= room.players.length) {
        room.currentDrawerIndex = room.players.length - 1;
      } else {
        room.currentDrawerIndex--;
      }
      setTimeout(() => nextTurn(room), 2000);
    }

    // End game if less than 2 players
    if (room.state === 'playing' && room.players.length < 2) {
      endGame(room);
    }
  });
});

// ─── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎨 GuessMyMess server running on port ${PORT}\n`);
});
