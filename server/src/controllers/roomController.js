const Room = require("../models/Rooms");

// Generate random room code
const generateRoomId = () => {
  return Math.random().toString(36).substring(2, 11);
};

// CREATE ROOM
exports.createRoom = async (req, res) => {
  try {
    const roomId = generateRoomId();

    const room = await Room.create({
      roomId,
      host: req.user.id
    });

    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ message: "Failed to create room" });
  }
};

// JOIN ROOM
exports.joinRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });
    if (!room)
      return res.status(404).json({ message: "Room not found" });

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: "Failed to join room" });
  }
};
