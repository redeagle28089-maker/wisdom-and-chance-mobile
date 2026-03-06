import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

const BACKEND_URL = "https://wisdom-and-chance.replit.app";

export async function registerRoutes(app: Express): Promise<Server> {
  app.all("/api/{*path}", async (req: Request, res: Response) => {
    try {
      const targetUrl = `${BACKEND_URL}${req.originalUrl}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (req.headers.authorization) {
        headers["Authorization"] = req.headers.authorization as string;
      }
      if (req.headers.cookie) {
        headers["Cookie"] = req.headers.cookie as string;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const response = await fetch(targetUrl, fetchOptions);
      const contentType = response.headers.get("content-type") || "";

      res.status(response.status);

      const setCookies = response.headers.getSetCookie?.();
      if (setCookies) {
        setCookies.forEach((cookie: string) => res.appendHeader("Set-Cookie", cookie));
      }

      if (contentType.includes("application/json")) {
        const data = await response.json();
        res.json(data);
      } else {
        const text = await response.text();
        res.send(text);
      }
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(502).json({ error: "Failed to proxy request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
