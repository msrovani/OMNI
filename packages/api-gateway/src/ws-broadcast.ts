import type { WebSocket } from "ws";

export class WsBroadcast {
  private clients = new Set<WebSocket>();

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on("close", () => this.removeClient(ws));
    ws.on("error", () => this.removeClient(ws));
  }

  removeClient(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  broadcastTelemetry(deviceId: string, data: any): void {
    const msg = JSON.stringify({ event: "telemetry", deviceId, data });
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(msg);
      }
    }
  }

  broadcastDispatch(dispatch: any): void {
    const msg = JSON.stringify({ event: "dispatch", data: dispatch });
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(msg);
      }
    }
  }

  broadcastMarketPrice(price: any): void {
    const msg = JSON.stringify({ event: "marketPrice", data: price });
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(msg);
      }
    }
  }
}
