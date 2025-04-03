import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "/../public/index.html");
  res.sendFile(filePath);
});

io.on("connection", (socket) => {
  console.log("A user connected");
  socket.broadcast.emit("hi");
  socket.on("disconnect", () => {
    console.log("A user disconnected");
  });
  socket.on("chat message", (msg) => {
    io.emit("chat message", msg);
    console.log("Message: " + msg);
  });
});

// io.emit("some event", {
//   someProperty: "some value",
//   otherProperty: "other value",
// });

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
