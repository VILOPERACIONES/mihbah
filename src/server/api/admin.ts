import { Hono } from "hono";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { lucia } from "../../lib/auth";
import {
    db, users, profiles, userRoles, roleModuleAccess,
    empresas, llmProviders, agentSkills, movimientos, excelUploads,
} from "../../db/index";

const adminRoutes = new Hono();

// ── Auth helpers ───────────────────────────────────────────────────────────

async function getUser(cookieHeader: string) {
    const sessionId = lucia.readSessionCookie(cookieHeader);
    if (!sessionId) return null;
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) return null;
    const roleRows = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
    const roles = roleRows.map((r) => r.role);
    const topRole = roles.includes("SUPER_ADMIN_DEV") ? "SUPER_ADMIN_DEV"
        : roles.includes("SUPER_ADMIN") ? "SUPER_ADMIN"
        : roles.includes("ADMIN") ? "ADMIN" : "VIEWER";
    return { id: user.id, topRole };
}

function requireSuperAdmin(role: string) {
    return role === "SUPER_ADMIN_DEV" || role === "SUPER_ADMIN";
}

// ── GET /api/admin/users ────────────────────────────────────────────────────
adminRoutes.get("/users", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || !requireSuperAdmin(caller.topRole)) {
        if (!caller || (caller.topRole !== "ADMIN")) return c.json({ users: [] }, 403);
    }

    const profileRows = await db
        .select({
            id: profiles.id,
            userId: profiles.userId,
            nombre: profiles.nombre,
            empresasPermitidas: profiles.empresasPermitidas,
            modulosOverride: profiles.modulosOverride,
            activo: profiles.activo,
            createdAt: profiles.createdAt,
        })
        .from(profiles)
        .orderBy(profiles.createdAt);

    const userIds = profileRows.map((p) => p.userId);
    const [userRows, roleRows, allEmpresas] = await Promise.all([
        userIds.length > 0
            ? db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, userIds))
            : Promise.resolve([]),
        userIds.length > 0
            ? db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles).where(inArray(userRoles.userId, userIds))
            : Promise.resolve([]),
        db.select({ id: empresas.id, nombre: empresas.nombre }).from(empresas),
    ]);

    const emailMap = new Map(userRows.map((u) => [u.id, u.email]));
    const roleMap = new Map<string, string>();
    roleRows.forEach((r) => {
        const cur = roleMap.get(r.userId);
        const priority: Record<string, number> = { SUPER_ADMIN_DEV: 4, SUPER_ADMIN: 3, ADMIN: 2, VIEWER: 1 };
        if (!cur || (priority[r.role] ?? 0) > (priority[cur] ?? 0)) {
            roleMap.set(r.userId, r.role);
        }
    });
    const empresaIdToName = new Map(allEmpresas.map((e) => [e.id, e.nombre]));

    let result = profileRows.map((p) => ({
        id: p.id,
        user_id: p.userId,
        nombre: p.nombre,
        email: emailMap.get(p.userId) ?? "",
        rol: roleMap.get(p.userId) ?? "VIEWER",
        empresas: (p.empresasPermitidas ?? []).map((uid) => empresaIdToName.get(uid) ?? uid),
        modulos_override: p.modulosOverride,
        activo: p.activo,
        created_at: p.createdAt,
    }));

    if (caller.topRole !== "SUPER_ADMIN_DEV") {
        result = result.filter((u) => u.rol !== "SUPER_ADMIN_DEV");
    }

    return c.json({ users: result });
});

// ── PATCH /api/admin/users/:id/role ─────────────────────────────────────────
adminRoutes.patch("/users/:id/role", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || !requireSuperAdmin(caller.topRole)) return c.json({ ok: false }, 403);

    const userId = c.req.param("id");
    const { role } = await c.req.json<{ role: string }>();
    const validRoles = ["SUPER_ADMIN_DEV", "SUPER_ADMIN", "ADMIN", "VIEWER"];
    if (!validRoles.includes(role)) return c.json({ ok: false, error: "Rol inválido" }, 400);
    if (role === "SUPER_ADMIN_DEV" && caller.topRole !== "SUPER_ADMIN_DEV") {
        return c.json({ ok: false, error: "Sin permisos" }, 403);
    }

    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    await db.insert(userRoles).values({ userId, role: role as "SUPER_ADMIN_DEV" | "SUPER_ADMIN" | "ADMIN" | "VIEWER" });
    return c.json({ ok: true });
});

// ── PATCH /api/admin/users/:id/activo ───────────────────────────────────────
adminRoutes.patch("/users/:id/activo", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || !requireSuperAdmin(caller.topRole)) return c.json({ ok: false }, 403);

    const userId = c.req.param("id");
    const { activo } = await c.req.json<{ activo: boolean }>();
    await db.update(profiles).set({ activo }).where(eq(profiles.userId, userId));
    return c.json({ ok: true });
});

// ── PATCH /api/admin/users/:id/empresas ─────────────────────────────────────
adminRoutes.patch("/users/:id/empresas", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || !requireSuperAdmin(caller.topRole)) return c.json({ ok: false }, 403);

    const userId = c.req.param("id");
    const { empresas: empresaNames } = await c.req.json<{ empresas: string[] }>();

    let empresaIds: string[] = [];
    if (!empresaNames.includes("*") && empresaNames.length > 0) {
        const rows = await db
            .select({ id: empresas.id, nombre: empresas.nombre })
            .from(empresas)
            .where(inArray(empresas.nombre, empresaNames));
        empresaIds = rows.map((r) => r.id);
    }

    await db.update(profiles).set({ empresasPermitidas: empresaIds }).where(eq(profiles.userId, userId));
    return c.json({ ok: true });
});

// ── PATCH /api/admin/users/:id/modulos ──────────────────────────────────────
adminRoutes.patch("/users/:id/modulos", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || !requireSuperAdmin(caller.topRole)) return c.json({ ok: false }, 403);

    const userId = c.req.param("id");
    const { modulos_override } = await c.req.json<{ modulos_override: Record<string, boolean> | null }>();
    await db.update(profiles).set({ modulosOverride: modulos_override }).where(eq(profiles.userId, userId));
    return c.json({ ok: true });
});

// ── GET /api/admin/modules ───────────────────────────────────────────────────
adminRoutes.get("/modules", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || !requireSuperAdmin(caller.topRole)) return c.json({ modules: [] }, 403);

    const rows = await db.select().from(roleModuleAccess);
    return c.json({ modules: rows });
});

// ── PUT /api/admin/modules ───────────────────────────────────────────────────
adminRoutes.put("/modules", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || !requireSuperAdmin(caller.topRole)) return c.json({ ok: false }, 403);

    const { entries } = await c.req.json<{
        entries: Array<{ role: string; module: string; allowed: boolean }>;
    }>();

    for (const entry of entries) {
        await db
            .update(roleModuleAccess)
            .set({ allowed: entry.allowed })
            .where(and(eq(roleModuleAccess.role, entry.role as "SUPER_ADMIN_DEV" | "SUPER_ADMIN" | "ADMIN" | "VIEWER"), eq(roleModuleAccess.module, entry.module)));
    }

    return c.json({ ok: true });
});

// ── GET /api/admin/llm ───────────────────────────────────────────────────────
adminRoutes.get("/llm", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ providers: [] }, 403);

    const rows = await db.select().from(llmProviders).orderBy(llmProviders.createdAt);
    return c.json({ providers: rows });
});

// ── POST /api/admin/llm ──────────────────────────────────────────────────────
adminRoutes.post("/llm", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ ok: false }, 403);

    const [row] = await db.insert(llmProviders).values({
        name: "Nuevo Proveedor",
        baseUrl: "",
        apiKeyEncrypted: "",
        models: [],
        isDefault: false,
    }).returning();

    return c.json({ ok: true, provider: row });
});

// ── PATCH /api/admin/llm/:id ─────────────────────────────────────────────────
adminRoutes.patch("/llm/:id", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ ok: false }, 403);

    const id = c.req.param("id");
    const body = await c.req.json<{
        name?: string; baseUrl?: string; apiKeyEncrypted?: string;
        models?: string[]; isDefault?: boolean;
    }>();

    await db.update(llmProviders).set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.baseUrl !== undefined && { baseUrl: body.baseUrl }),
        ...(body.apiKeyEncrypted !== undefined && { apiKeyEncrypted: body.apiKeyEncrypted }),
        ...(body.models !== undefined && { models: body.models }),
        ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
    }).where(eq(llmProviders.id, id));

    return c.json({ ok: true });
});

// ── DELETE /api/admin/llm/:id ────────────────────────────────────────────────
adminRoutes.delete("/llm/:id", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ ok: false }, 403);

    await db.delete(llmProviders).where(eq(llmProviders.id, c.req.param("id")));
    return c.json({ ok: true });
});

// ── POST /api/admin/llm/list-models ─────────────────────────────────────────
adminRoutes.post("/llm/list-models", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ models: [] }, 403);

    const { base_url, api_key } = await c.req.json<{ base_url: string; api_key: string }>();
    try {
        const res = await fetch(`${base_url}/models`, {
            headers: { Authorization: `Bearer ${api_key}`, "anthropic-version": "2023-06-01", "x-api-key": api_key },
        });
        const data = await res.json() as { data?: Array<{ id: string }>; models?: Array<{ id: string }> };
        const models = (data.data ?? data.models ?? []).map((m) => m.id);
        return c.json({ models });
    } catch {
        return c.json({ models: [], error: "No se pudo conectar al proveedor" });
    }
});

// ── GET /api/admin/skills ────────────────────────────────────────────────────
adminRoutes.get("/skills", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ skills: [] }, 403);

    const rows = await db.select().from(agentSkills).orderBy(agentSkills.createdAt);
    return c.json({ skills: rows });
});

// ── POST /api/admin/skills ───────────────────────────────────────────────────
adminRoutes.post("/skills", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ ok: false }, 403);

    const body = await c.req.json<{
        name: string; description: string; systemPrompt: string;
        model: string; providerId: string | null; enabled: boolean;
    }>();

    const [row] = await db.insert(agentSkills).values({
        name: body.name,
        description: body.description,
        systemPrompt: body.systemPrompt,
        model: body.model,
        providerId: body.providerId,
        enabled: body.enabled,
    }).returning();

    return c.json({ ok: true, skill: row });
});

// ── PATCH /api/admin/skills/:id ──────────────────────────────────────────────
adminRoutes.patch("/skills/:id", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ ok: false }, 403);

    const id = c.req.param("id");
    const body = await c.req.json<{
        name?: string; description?: string; systemPrompt?: string;
        model?: string; providerId?: string | null; enabled?: boolean;
    }>();

    await db.update(agentSkills).set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.systemPrompt !== undefined && { systemPrompt: body.systemPrompt }),
        ...(body.model !== undefined && { model: body.model }),
        ...(body.providerId !== undefined && { providerId: body.providerId }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
    }).where(eq(agentSkills.id, id));

    return c.json({ ok: true });
});

// ── DELETE /api/admin/skills/:id ─────────────────────────────────────────────
adminRoutes.delete("/skills/:id", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ ok: false }, 403);

    await db.delete(agentSkills).where(eq(agentSkills.id, c.req.param("id")));
    return c.json({ ok: true });
});

// ── POST /api/admin/wipe ─────────────────────────────────────────────────────
adminRoutes.post("/wipe", async (c) => {
    const caller = await getUser(c.req.header("Cookie") ?? "");
    if (!caller || caller.topRole !== "SUPER_ADMIN_DEV") return c.json({ ok: false }, 403);

    await db.delete(movimientos);
    await db.delete(excelUploads);
    return c.json({ ok: true });
});

export default adminRoutes;
