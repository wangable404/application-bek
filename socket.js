const { Server } = require("socket.io");

module.exports = function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", socket => {
    console.log("Socket connected:", socket.id);

    socket.on("join_chat", applicationId => {
      socket.join(`chat_${applicationId}`);
      console.log("Joined chat:", applicationId);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  });

  return io;
};
