import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const app = express();
const server = http.createServer(app);

// Render will provide PORT. Locally it falls back to 3000.
const PORT = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
  res.status(200).send("GODOT WEBSOCKET SERVER ONLINE");
});

const wss = new WebSocketServer({
  server: server,
  path: "/"
});

let waitingPlayer: WebSocket | null = null;
const rooms = new Map<WebSocket, WebSocket>();

function send(ws: WebSocket, data: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function createMatch(player1: WebSocket, player2: WebSocket): void {
  rooms.set(player1, player2);
  rooms.set(player2, player1);

  const player1IsDrawer = Math.random() < 0.5;

  send(player1, {
    type: "matched",
    role: player1IsDrawer ? "drawer" : "guesser"
  });

  send(player2, {
    type: "matched",
    role: player1IsDrawer ? "guesser" : "drawer"
  });

  console.log("MATCH CREATED");
}

function removePlayer(ws: WebSocket): void {
  if (waitingPlayer === ws) {
    waitingPlayer = null;
  }

  const opponent = rooms.get(ws);

  if (opponent) {
    rooms.delete(ws);
    rooms.delete(opponent);

    send(opponent, {
      type: "opponent_left",
      message: "اللاعب الآخر خرج من اللعبة."
    });
  }
}

wss.on("connection", (ws: WebSocket, request) => {
  console.log("PLAYER CONNECTED:", request.url);

  send(ws, {
    type: "connected",
    message: "Connected to Godot server"
  });

  ws.on("message", (rawMessage) => {
    try {
      const data = JSON.parse(rawMessage.toString());
      const action = String(data.action || "");

      if (action === "find_match") {
        if (rooms.has(ws) || waitingPlayer === ws) {
          return;
        }

        if (waitingPlayer === null) {
          waitingPlayer = ws;

          send(ws, {
            type: "waiting",
            message: "في انتظار لاعب آخر..."
          });

          console.log("PLAYER WAITING");
        } else {
          const player2 = waitingPlayer;
          waitingPlayer = null;
          createMatch(player2, ws);
        }

        return;
      }

      const opponent = rooms.get(ws);

      if (!opponent) {
        send(ws, {
          type: "error",
          message: "أنت مش داخل مباراة."
        });
        return;
      }

      if (action === "stroke_start") {
        send(opponent, {
          action: "stroke_start",
          color: data.color,
          width: data.width
        });
        return;
      }

      if (action === "stroke_points") {
        send(opponent, {
          action: "stroke_points",
          points: data.points
        });
        return;
      }

      if (action === "draw_shape") {
        send(opponent, {
          action: "draw_shape",
          points: data.points,
          color: data.color,
          width: data.width
        });
        return;
      }

      if (action === "clear") {
        send(opponent, { action: "clear" });
        return;
      }

      if (action === "undo") {
        send(opponent, { action: "undo" });
        return;
      }

      if (action === "fill") {
        send(opponent, {
          action: "fill",
          color: data.color
        });
        return;
      }

      if (action === "start_guessing") {
        send(opponent, { action: "start_guessing" });
        return;
      }

      if (action === "guess") {
        send(opponent, {
          action: "guess",
          text: data.text
        });
        return;
      }

      if (action === "result") {
        send(opponent, {
          action: "result",
          is_correct: Boolean(data.is_correct)
        });
        return;
      }

      if (action === "finish_game") {
        send(opponent, {
          action: "finish_game",
          msg: data.msg
        });
        return;
      }

      console.log("UNKNOWN ACTION:", action);

    } catch (error) {
      console.error("MESSAGE ERROR:", error);

      send(ws, {
        type: "error",
        message: "Invalid JSON message"
      });
    }
  });

  ws.on("close", () => {
    console.log("PLAYER DISCONNECTED");
    removePlayer(ws);
  });

  ws.on("error", (error) => {
    console.error("WEBSOCKET ERROR:", error);
    removePlayer(ws);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log("GODOT DRAWING SERVER STARTED");
  console.log("PORT:", PORT);
  console.log("=================================");
});
