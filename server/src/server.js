require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/database");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json());

// ---------- DATABASE ----------
connectDB();

// ---------- HTTP + SOCKET SERVER ----------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory room store
// {
//   roomId: [ { id, name } ]
// }
const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ---------- JOIN ROOM ----------
  socket.on("join-room", ({ roomId, user }) => {
    socket.roomId = roomId;   // 🔥 store room
    socket.userName = user.name;

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    const newUser = {
      id: socket.id,
      name: user.name
    };

    rooms[roomId].push(newUser);
    socket.join(roomId);

      // send existing users to new user
      socket.emit("existing-users", rooms[roomId]);

      // notify others
      socket.to(roomId).emit("user-joined", newUser);
    });

    // 🔥 HANDLE LEAVE HERE
    socket.on("disconnect", () => {

      const roomId = socket.roomId;

      if (!roomId || !rooms[roomId]) return;

      rooms[roomId] = rooms[roomId].filter(
        u => u.id !== socket.id
      );

      socket.to(roomId).emit("user-left", socket.id);

      console.log("User left:", socket.id);
    });



  // ---------- SIGNALING ----------
  socket.on("offer", (data) => {
    socket.to(data.roomId).emit("offer", data);
  });

  socket.on("answer", (data) => {
    socket.to(data.roomId).emit("answer", data);
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.roomId).emit("ice-candidate", data);
  });
});

// ---------- ROUTES ----------
app.use("/api/test", require("./routes/testRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/rooms", require("./routes/roomRoutes"));

app.get("/", (req, res) => {
  res.send("VisionTeach Backend Running");
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
