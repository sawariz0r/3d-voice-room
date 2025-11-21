
const { Server } = require("socket.io");

const io = new Server(3000, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Map: RoomID -> Set<SocketID>
const rooms = new Map();
// Map: SocketID -> UserData { id, color, name }
const users = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, user }) => {
    socket.join(roomId);
    
    // Store user data
    users.set(socket.id, { ...user, id: socket.id });

    // Get other users in the room
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    const otherUsers = clients
        .filter(id => id !== socket.id)
        .map(id => users.get(id));

    // Tell the joining user who is already here
    socket.emit("existing-users", otherUsers);

    // Tell others a new user joined
    socket.to(roomId).emit("user-joined", { 
        id: socket.id, 
        ...user 
    });

    console.log(`${user.name} joined ${roomId}`);
  });

  // WebRTC Signaling (Offer, Answer, ICE Candidates)
  socket.on("signal", (payload) => {
    io.to(payload.target).emit("signal", {
      sender: socket.id,
      signal: payload.signal
    });
  });

  socket.on("disconnecting", () => {
    const userRooms = socket.rooms;
    userRooms.forEach(room => {
        socket.to(room).emit("user-left", socket.id);
    });
  });

  socket.on("disconnect", () => {
    users.delete(socket.id);
    console.log("User disconnected:", socket.id);
  });
});

console.log("Signaling server running on port 3000");
