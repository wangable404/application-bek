const { Server } = require("socket.io");

module.exports = function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    // Присоединение к чату
    socket.on("join_chat", (applicationId, userId) => {
      socket.join(`chat_${applicationId}`);
      console.log(`✅ User ${userId} joined chat: chat_${applicationId}`);
    });

    // Отсоединение от чата
    socket.on("leave_chat", (applicationId) => {
      socket.leave(`chat_${applicationId}`);
      console.log(`❌ Socket left chat: chat_${applicationId}`);
    });

    // Typing indicator
    socket.on("typing", ({ applicationId, userId, isTyping }) => {
      socket.to(`chat_${applicationId}`).emit("user_typing", {
        userId,
        isTyping,
        applicationId
      });
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", socket.id, "Reason:", reason);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  console.log("✅ Socket.io initialized");
  return io;
};