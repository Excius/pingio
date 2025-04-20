import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import crypto from "crypto";

// TODO: Add private messaging.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

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

app.get("/chat", async (req, res) => {
  console.log("chat route");
  const { id } = req.query;
  console.log("id", id);
  if (id === undefined || !(await getUserById(id))) {
    res.status(400).send("Invalid user ID");
  }
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
    socket.broadcast.emit("typing", {
      msg: null,
      name: msg.name,
    });
    socket.broadcast.emit("chat message", msg);
  });

  socket.on("user id", async (id) => {
    const user = await getUserById(id);

    if (user) {
      socket.emit("user name", user.username);
    } else {
      console.log("User not found");
      socket.disconnect();
    }
  });

  let typingTimeout;

  socket.on("typing", async (id) => {
    const user = await getUserById(id);
    if (user) {
      socket.broadcast.emit("typing", {
        msg: `${user.username} is typing...`,
        name: user.username,
      });

      // Clear previous timeout if exists
      if (typingTimeout) clearTimeout(typingTimeout);

      // Set a new timeout to emit "typing" with null msg after 2 seconds of inactivity
      typingTimeout = setTimeout(() => {
        socket.broadcast.emit("typing", {
          msg: null,
          name: user.username,
        });
      }, 2500);
    } else {
      console.log("User not found");
      socket.emit("user name", "User not found");
    }
  });

  socket.on("get-online-users", () => {
    const onlineUsers = users.map((user) => user.username);
    console.log("Online users:", onlineUsers);
    socket.emit("online-users", onlineUsers);
  });
});

app.get("/users", (req, res) => {
  res.send(users);
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server is running on port 3000");
});
