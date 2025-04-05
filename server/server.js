import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import crypto from "crypto";

// TODO: Add “{user} is typing” functionality.
// TODO: Show who’s online.
// TODO: Add private messaging.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.urlencoded({ extended: true }));

let users = [];

async function getUserById(id) {
  return users.find((user) => user.id === id);
}

async function removeUser(userId) {
  const userIndex = users.findIndex((user) => {
    return userId === user.id;
  });

  console.log("userIndex", userIndex);

  users.splice(userIndex, 1);

  console.log(users);
}

app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "/../public/index.html");
  res.sendFile(filePath);
});

app.post("/", (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== "string" || username.trim() === "") {
    return res
      .status(400)
      .send("Username is required and must be a non-empty string");
  }

  const id = crypto.randomUUID();
  const user = { username, id };
  users.push(user);
  console.log(users);
  return res.redirect(`/chat?id=${id}`);
});

app.get("/chat", (req, res) => {
  const { id } = req.query;
  const filePath = path.join(__dirname, "/../public/chat.html");

  res.sendFile(filePath);
});

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.id;
  if (!userId) {
    socket.emit("error", "No user ID provided");
    socket.disconnect();
    return;
  }
  const user = await getUserById(userId);
  if (!user) {
    socket.emit("error", "Invalid user ID");
    socket.disconnect();
    return;
  }

  console.log(user.username, "connected");

  socket.broadcast.emit("chat message", {
    msg: `${user.username} joined the chat`,
    name: null,
  });

  socket.on("disconnect", async () => {
    socket.broadcast.emit("chat message", {
      msg: `${user.username} left the chat`,
      name: null,
    });

    await removeUser(userId);

    console.log(user.username, " disconnected");
  });

  socket.on("chat message", (msg) => {
    socket.broadcast.emit("chat message", msg);
    console.log("Message: " + msg);
  });

  socket.on("user id", async (id) => {
    const user = await getUserById(id);
    console.log(user);

    if (user) {
      socket.emit("user name", user.username);
    } else {
      console.log("User not found");
      socket.emit("user name", "User not found");
    }
  });
});

app.get("/users", (req, res) => {
  res.send(users);
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
