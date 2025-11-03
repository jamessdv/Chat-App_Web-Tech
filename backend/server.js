const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const rooms = {};
const userSocketMap = {};

//display user list
const broadcastUserList = (roomName) => {
  if (rooms[roomName]) {
    io.to(roomName).emit("update_user_list", rooms[roomName].users);
  }
};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  //room creation
  socket.on("createRoom", ({ username, roomName, password }) => {
    if (!rooms[roomName]) {
      rooms[roomName] = { password, users: [username] };
      userSocketMap[socket.id] = { roomName, username };
      socket.join(roomName);
      socket.emit("room_success", `Room ${roomName} created successfully.`);
      broadcastUserList(roomName); //user list
      console.log(`Room ${roomName} created by ${username}.`);
    } else {
      socket.emit("room_error", "Room name already exists.");
    }
  });

  //room joining
  socket.on("join_room", ({ formType, username, roomName, password }) => {
    if (rooms[roomName]) {
      if (rooms[roomName].password === password) {
        socket.join(roomName);
        if (!rooms[roomName].users.includes(username)) {
          rooms[roomName].users.push(username);
        }
        userSocketMap[socket.id] = { roomName, username };
        socket.emit("room_success", `Welcome ${username} to room ${roomName}!`);
        socket.to(roomName).emit("receive_message", {
          username: "System",
          message: `${username} has joined the room.`,
        });
        broadcastUserList(roomName); //updated user list
        console.log(`${username} joined room ${roomName}`);
      } else {
        socket.emit("room_error", "Incorrect password.");
      }
    } else {
      socket.emit("room_error", "Room does not exist.");
    }
  });

  //handling messages
  socket.on("send_message", ({ roomName, username, message }) => {
    const messageData = { username, message };
    console.log(`Message from ${username} in room ${roomName}: ${message}`);
    io.to(roomName).emit("receive_message", messageData);
  });

  //handling files
  socket.on("send_file", ({ roomName, username, fileName }, file) => {
    console.log(`File "${fileName}" sent by ${username} in room ${roomName}`);

    //display(broadcast) file to all users
    socket.to(roomName).emit("receive_file", { username, fileName }, file);

    //sent file notification 
    io.to(roomName).emit("receive_message", {
      username: "System",
      message: `${username} sent a file: ${fileName}`,
    });
  });

  //handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    const userData = userSocketMap[socket.id];
    if (userData) {
      const { roomName, username } = userData;
      if (rooms[roomName]) {
        rooms[roomName].users = rooms[roomName].users.filter(
          (user) => user !== username
        );
        socket.to(roomName).emit("receive_message", {
          username: "System",
          message: `${username} has left the room.`,
        });
        broadcastUserList(roomName); //update user list
        
        //delete empty room
        if (rooms[roomName].users.length === 0) {
          delete rooms[roomName];
          console.log(`Room ${roomName} deleted as all users left.`);
        }
      }
      delete userSocketMap[socket.id];
    }
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

});
