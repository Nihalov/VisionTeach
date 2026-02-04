const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { createRoom, joinRoom } = require("../controllers/roomController");

router.post("/create", protect, createRoom);
router.get("/join/:roomId", protect, joinRoom);

module.exports = router;
