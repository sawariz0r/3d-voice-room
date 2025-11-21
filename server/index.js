const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// State: Map roomId -> { info: RoomInfo, users: User[] }
const rooms = {};

const getRandomColor = () => '#' + Math.floor(Math.random()*16777215).toString(16);
const getAudiencePosition = () => ({ x: (Math.random() - 0.5) * 8, y: 0, z: (Math.random() * 4) + 2 });
const getStagePosition = () => ({ x: (Math.random() - 0.5) * 4, y: 0, z: (Math.random() - 0.5) * 2 - 2 });

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Lobby: List rooms
  socket.on('get-rooms', () => {
    const roomList = Object.values(rooms).map(r => r.info);
    socket.emit('room-list', roomList);
  });

  // Create Room
  socket.on('create-room', ({ title, language, topic, username }) => {
    const roomId = Math.random().toString(36).substring(2, 9);
    
    rooms[roomId] = {
      info: {
        id: roomId,
        title,
        language,
        topic,
        hostId: socket.id,
        userCount: 0,
        speakerCount: 0
      },
      users: []
    };

    // Host joins immediately as speaker
    socket.emit('room-created', roomId);
  });

  // Join Room
  socket.on('join-room', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    socket.join(roomId);
    
    const isHost = room.info.hostId === socket.id;
    const isSpeaker = isHost; 

    const user = {
      id: socket.id,
      username,
      isSpeaker,
      isHost,
      handRaised: false,
      position: isSpeaker ? getStagePosition() : getAudiencePosition(),
      color: getRandomColor(),
      micActive: false
    };

    room.users.push(user);
    
    // Update counts
    room.info.userCount = room.users.length;
    room.info.speakerCount = room.users.filter(u => u.isSpeaker).length;

    // Send state to new user
    socket.emit('room-state', { info: room.info, users: room.users });
    
    // Notify others
    socket.to(roomId).emit('user-joined', user);
    socket.to(roomId).emit('room-info-update', room.info);
  });

  // Chat
  socket.on('send-message', ({ roomId, message }) => {
    io.to(roomId).emit('new-message', {
      userId: socket.id,
      text: message,
      timestamp: Date.now()
    });
  });

  // Voice Activity (Visualizer)
  socket.on('voice-activity', ({ roomId, volume }) => {
    socket.to(roomId).emit('user-voice-activity', {
      userId: socket.id,
      volume
    });
  });

  // --- WebRTC Signaling ---
  socket.on('signal', ({ userToSignal, signal, callerId }) => {
    io.to(userToSignal).emit('signal', { signal, callerId });
  });

  // --- Stage Management ---

  // Audience requests to speak
  socket.on('raise-hand', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const user = room.users.find(u => u.id === socket.id);
    if (user && !user.isSpeaker) {
      user.handRaised = !user.handRaised; // Toggle
      io.to(roomId).emit('user-updated', user);
    }
  });

  // Host accepts speaker
  socket.on('promote-user', ({ roomId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    if (room.info.hostId !== socket.id) return;

    const user = room.users.find(u => u.id === userId);
    if (user) {
      user.isSpeaker = true;
      user.handRaised = false;
      user.position = getStagePosition();
      
      room.info.speakerCount = room.users.filter(u => u.isSpeaker).length;

      io.to(roomId).emit('user-updated', user);
      io.to(roomId).emit('room-info-update', room.info);
    }
  });

  // Move back to audience
  socket.on('move-to-audience', ({ roomId, userId }) => {
    const room = rooms[roomId];
    if (!room) return;
    
    if (room.info.hostId !== socket.id && socket.id !== userId) return;

    const user = room.users.find(u => u.id === userId);
    if (user && user.id !== room.info.hostId) {
      user.isSpeaker = false;
      user.handRaised = false;
      user.position = getAudiencePosition();
      
      room.info.speakerCount = room.users.filter(u => u.isSpeaker).length;

      io.to(roomId).emit('user-updated', user);
      io.to(roomId).emit('room-info-update', room.info);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.users.findIndex(u => u.id === socket.id);
      if (index !== -1) {
        const wasHost = room.info.hostId === socket.id;
        room.users.splice(index, 1);
        room.info.userCount = room.users.length;
        room.info.speakerCount = room.users.filter(u => u.isSpeaker).length;

        io.to(roomId).emit('user-left', socket.id);
        io.to(roomId).emit('room-info-update', room.info);

        if (room.users.length === 0) {
          delete rooms[roomId];
        } else if (wasHost) {
             room.info.hostId = room.users[0].id;
             room.users[0].isHost = true;
             room.users[0].isSpeaker = true;
             room.users[0].position = getStagePosition();
             io.to(roomId).emit('user-updated', room.users[0]);
             io.to(roomId).emit('room-info-update', room.info);
        }
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
