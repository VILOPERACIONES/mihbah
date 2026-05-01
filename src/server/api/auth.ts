import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { Scrypt } from "oslo/password";
import { generateId } from "lucia";
import { lucia } from "../../lib/auth";
import { db, users, profiles, userRoles, roleModuleAccess } from "../../db/index";

const scrypt = new Scrypt();

const authRoutes = new Hono();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    nombre: z.string().min(1),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "VIEWER"]),
    empresaIds: z.array(z.string().uuid()).default([]),
});

async function getValidatedSession(cookieHeader: string) {
    const sessionId = lucia.readSessionCookie(cookieHeader);
    if (!sessionId) return null;
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) return null;
    return { session, luciaUser: user };
}

async function buildUserPayload(userId: string, email: string) {
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    const roleRows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));

    const roleList = roleRows.map((r) => r.role);
    const topRole = roleList.includes("SUPER_ADMIN_DEV")
        ? "SUPER_ADMIN_DEV"
        : roleList.includes("SUPER_ADMIN")
        ? "SUPER_ADMIN"
        : roleList.includes("ADMIN")
        ? "ADMIN"
        : "VIEWER";

    const moduleRows = await db
        .select()
        .from(roleModuleAccess)
        .where(eq(roleModuleAccess.role, topRole as "SUPER_ADMIN_DEV" | "SUPER_ADMIN" | "ADMIN" | "VIEWER"));

    const roleAllowed = moduleRows.filter((m) => m.allowed).map((m) => m.module);

    const overrides = profile?.modulosOverride as Record<string, boolean> | null;
    let finalModules = roleAllowed;
    if (overrides) {
        finalModules = moduleRows.map((m) => m.module).filter((mod) => {
            const ov = overrides[mod];
            return ov !== undefined ? ov : roleAllowed.includes(mod);
        });
    }

    return {
        id: userId,
        email,
        nombre: profile?.nombre ?? "",
        rol: topRole,
        empresas: profile?.empresasPermitidas ?? [],
        modules: finalModules,
    };
}

// POST /api/auth/login
authRoutes.post("/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);

    const { email, password } = parsed.data;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return c.json({ error: "Credenciales incorrectas" }, 401);

    const valid = await scrypt.verify(user.passwordHash, password);
    if (!valid) return c.json({ error: "Credenciales incorrectas" }, 401);

    const session = await lucia.createSession(user.id, {});
    c.header("Set-Cookie", lucia.createSessionCookie(session.id).serialize());

    const payload = await buildUserPayload(user.id, user.email);
    return c.json({ user: payload });
});

// GET /api/auth/me
authRoutes.get("/me", async (c) => {
    const result = await getValidatedSession(c.req.header("Cookie") ?? "");
    if (!result) return c.json({ user: null }, 401);

    const [user] = await db.select().from(users).where(eq(users.id, result.luciaUser.id));
    if (!user) return c.json({ user: null }, 401);

    const payload = await buildUserPayload(user.id, user.email);
    return c.json({ user: payload });
});

// POST /api/auth/logout
authRoutes.post("/logout", async (c) => {
    const sessionId = lucia.readSessionCookie(c.req.header("Cookie") ?? "");
    if (sessionId) await lucia.invalidateSession(sessionId);
    c.header("Set-Cookie", lucia.createBlankSessionCookie().serialize());
    return c.json({ ok: true });
});

// POST /api/auth/register — SUPER_ADMIN+ solo
authRoutes.post("/register", async (c) => {
    const result = await getValidatedSession(c.req.header("Cookie") ?? "");
    if (!result) return c.json({ error: "No autenticado" }, 401);

    const roleRows = await db.select().from(userRoles).where(eq(userRoles.userId, result.luciaUser.id));
    const roles = roleRows.map((r) => r.role);
    if (!roles.some((r) => r === "SUPER_ADMIN_DEV" || r === "SUPER_ADMIN")) {
        return c.json({ error: "Sin permisos" }, 403);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Datos inválidos" }, 400);

    const { email, password, nombre, role, empresaIds } = parsed.data;

    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) return c.json({ error: "Email ya registrado" }, 409);

    const userId = generateId(15);
    const passwordHash = await scrypt.hash(password);

    await db.insert(users).values({ id: userId, email, passwordHash });
    await db.insert(profiles).values({ userId, nombre, empresasPermitidas: empresaIds });
    await db.insert(userRoles).values({ userId, role });

    return c.json({ ok: true, userId });
});

export default authRoutes;
