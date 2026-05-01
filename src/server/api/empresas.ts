import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import { lucia } from "../../lib/auth";
import { db, empresas, profiles, userRoles } from "../../db/index";

const empresasRoutes = new Hono();

empresasRoutes.get("/", async (c) => {
    const sessionId = lucia.readSessionCookie(c.req.header("Cookie") ?? "");
    if (!sessionId) return c.json({ empresas: [] }, 401);
    const { session, user: luciaUser } = await lucia.validateSession(sessionId);
    if (!session) return c.json({ empresas: [] }, 401);

    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, luciaUser.id));
    const roleRows = await db.select().from(userRoles).where(eq(userRoles.userId, luciaUser.id));
    const roles = roleRows.map((r) => r.role);

    const isSuperAdmin = roles.includes("SUPER_ADMIN_DEV") || roles.includes("SUPER_ADMIN");
    const permitidas = profile?.empresasPermitidas ?? [];

    let rows;
    if (isSuperAdmin || permitidas.length === 0) {
        rows = await db
            .select({ id: empresas.id, nombre: empresas.nombre })
            .from(empresas)
            .where(eq(empresas.activo, true));
    } else {
        rows = await db
            .select({ id: empresas.id, nombre: empresas.nombre })
            .from(empresas)
            .where(inArray(empresas.id, permitidas));
    }

    return c.json({ empresas: rows });
});

export default empresasRoutes;
