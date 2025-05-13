import express, { Request, Response, NextFunction } from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { Server, Socket } from "socket.io";
import crypto from "crypto";

// TODO: Add private messaging.
// TODO: Add multiple rooms.

type User = {
  id: string;
  username: string;
};
type Message = {
  msg: string;
  name: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

let users: User[] = [];

async function getUserById(id: string): Promise<User | undefined> {
  return users.find((user) => user.id === id);
}

async function removeUser(userId: string): Promise<void> {
  const userIndex: number = users.findIndex((user) => {
    return userId === user.id;
  });
  console.log("userIndex", userIndex);
  if (userIndex !== -1) {
    users.splice(userIndex, 1);
  }
  console.log(users);
}

app.get("/", (req: Request, res: Response) => {
  try {
    const filePath = path.join(__dirname, "/../../public/index.html");
    res.sendFile(filePath);
  } catch (error: any) {
    throw new Error("Error in GET / route: " + error);
  }
});

app.post("/", (req: Request, res: Response) => {
  try {
    const { username }: { username: string } = req.body;

    if (!username || typeof username !== "string" || username.trim() === "") {
      res
        .status(400)
        .send("Username is required and must be a non-empty string");
      return;
    }

    const id: string = crypto.randomUUID();
    const user: User = { username, id };
    users.push(user);
    console.log(users);
    res.redirect(`/chat?id=${id}`);
  } catch (e: any) {
    throw new Error("Error in POST / route: " + e);
  }
});

app.get("/chat", async (req: Request, res: Response) => {
  try {
    const { id }: { id?: string } = req.query;
    console.log("id", id);
    if (
      id === undefined ||
      typeof id !== "string" ||
      !(await getUserById(id))
    ) {
      res.status(400).send("Invalid user ID");
      return;
    }
    const filePath = path.join(__dirname, "/../../public/chat.html");

    res.sendFile(filePath);
  } catch (e: any) {
    console.error("Error in GET /chat route:", e);
  }
});

io.on("connection", async (socket: Socket) => {
  const userId = socket.handshake.query.id as string | undefined;
  if (!userId || typeof userId !== "string") {
    socket.emit("error", "No user ID provided");
    socket.disconnect();
    return;
  }
  const user: User | undefined = await getUserById(userId);
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

  socket.on("chat message", (msg: Message) => {
    socket.broadcast.emit("typing", {
      msg: null,
      name: msg.name,
    });
    socket.broadcast.emit("chat message", msg);
  });

  socket.on("user id", async (id: string) => {
    const user: User | undefined = await getUserById(id);

    if (user) {
      socket.emit("user name", user.username);
    } else {
      console.log("User not found");
      socket.disconnect();
    }
  });

  let typingTimeout: NodeJS.Timeout;

  socket.on("typing", async (id: string) => {
    const user: User | undefined = await getUserById(id);
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
      }, 2000);
    } else {
      console.log("User not found");
      socket.emit("user name", "User not found");
    }
  });

  socket.on("get-online-users", () => {
    const onlineUsers: string[] = users.map((user) => user.username);
    console.log("Online users:", onlineUsers);
    socket.emit("online-users", onlineUsers);
  });
});

app.get("/users", (req: Request, res: Response) => {
  res.send(users);
});

interface ServerError extends Error {
  status?: number;
}

app.use(
  (err: ServerError, req: Request, res: Response, next: NextFunction): void => {
    console.log(err);
    res.status(500).send("Internal Server Error");
  },
);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
