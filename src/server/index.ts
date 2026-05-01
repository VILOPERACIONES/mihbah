import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import authRoutes from "./api/auth";
import empresasRoutes from "./api/empresas";
import dashboardRoutes from "./api/dashboard";
import movimientosRoutes from "./api/movimientos";
import adminRoutes from "./api/admin";

const app = new Hono();

app.use(
    "/api/*",
    cors({
        origin: process.env.VITE_APP_URL ?? "http://localhost:8080",
        credentials: true,
    }),
);

app.route("/api/auth", authRoutes);
app.route("/api/empresas", empresasRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/movimientos", movimientosRoutes);
app.route("/api/admin", adminRoutes);

app.get("/healthz", (c) => c.json({ ok: true }));

const PORT = Number(process.env.SERVER_PORT ?? 3001);

serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`API server → http://localhost:${PORT}`);
});
