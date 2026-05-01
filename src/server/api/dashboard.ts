import { Hono } from "hono";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { lucia } from "../../lib/auth";
import {
    cuentasBancarias,
    cuentasPendientes,
    categorias,
    db,
    empresas,
    grupos,
    movimientos,
    proyectos,
} from "../../db/index";

const dashboardRoutes = new Hono();

const MESES_SHORT = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

async function validateSession(cookieHeader: string) {
    const sessionId = lucia.readSessionCookie(cookieHeader);
    if (!sessionId) return null;
    const { session, user } = await lucia.validateSession(sessionId);
    return session ? user : null;
}

async function resolveEmpresaId(nombre: string | undefined | null) {
    if (!nombre || nombre === "TODAS") return null;
    const [row] = await db.select({ id: empresas.id }).from(empresas).where(eq(empresas.nombre, nombre));
    return row?.id ?? null;
}

// GET /api/dashboard/periodos
dashboardRoutes.get("/periodos", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ periodos: [] }, 401);

    const rows = await db
        .selectDistinct({ anio: movimientos.anio, mes: movimientos.mes })
        .from(movimientos)
        .where(eq(movimientos.activo, true))
        .orderBy(desc(movimientos.anio), desc(movimientos.mes));

    return c.json({ periodos: rows });
});

// GET /api/dashboard/kpis?anio=&mes=&empresa=
dashboardRoutes.get("/kpis", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({}, 401);

    const anio = Number(c.req.query("anio"));
    const mes = Number(c.req.query("mes"));
    const empresaId = await resolveEmpresaId(c.req.query("empresa"));

    const conds: SQL[] = [eq(movimientos.activo, true)];
    if (anio) conds.push(eq(movimientos.anio, anio));
    if (mes) conds.push(eq(movimientos.mes, mes));
    if (empresaId) conds.push(eq(movimientos.empresaId, empresaId));

    const [row] = await db
        .select({
            ingresos: sql<string>`COALESCE(SUM(CASE WHEN ${movimientos.tipo} = 'INGRESO' THEN ${movimientos.monto}::numeric ELSE 0 END), 0)`,
            salidas: sql<string>`COALESCE(SUM(CASE WHEN ${movimientos.tipo} = 'SALIDA' THEN ${movimientos.monto}::numeric ELSE 0 END), 0)`,
            conteoIngresos: sql<string>`COUNT(CASE WHEN ${movimientos.tipo} = 'INGRESO' THEN 1 END)`,
            conteoSalidas: sql<string>`COUNT(CASE WHEN ${movimientos.tipo} = 'SALIDA' THEN 1 END)`,
        })
        .from(movimientos)
        .where(and(...conds));

    const ingresos = Number(row?.ingresos ?? 0);
    const salidas = Number(row?.salidas ?? 0);
    const resultado = ingresos - salidas;

    return c.json({
        ingresos,
        salidas,
        resultado,
        margen: ingresos > 0 ? Math.round((resultado / ingresos) * 10000) / 100 : 0,
        conteoIngresos: Number(row?.conteoIngresos ?? 0),
        conteoSalidas: Number(row?.conteoSalidas ?? 0),
    });
});

// GET /api/dashboard/flujo?anioDesde=&anioHasta=&empresa=
dashboardRoutes.get("/flujo", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ flujo: [] }, 401);

    const anioDesde = Number(c.req.query("anioDesde") ?? new Date().getFullYear() - 2);
    const anioHasta = c.req.query("anioHasta") ? Number(c.req.query("anioHasta")) : null;
    const empresaId = await resolveEmpresaId(c.req.query("empresa"));

    const conds: SQL[] = [eq(movimientos.activo, true), gte(movimientos.anio, anioDesde)];
    if (anioHasta) conds.push(lte(movimientos.anio, anioHasta));
    if (empresaId) conds.push(eq(movimientos.empresaId, empresaId));

    const rows = await db
        .select({
            anio: movimientos.anio,
            mes: movimientos.mes,
            ingresos: sql<string>`COALESCE(SUM(CASE WHEN ${movimientos.tipo} = 'INGRESO' THEN ${movimientos.monto}::numeric ELSE 0 END), 0)`,
            salidas: sql<string>`COALESCE(SUM(CASE WHEN ${movimientos.tipo} = 'SALIDA' THEN ${movimientos.monto}::numeric ELSE 0 END), 0)`,
        })
        .from(movimientos)
        .where(and(...conds))
        .groupBy(movimientos.anio, movimientos.mes)
        .orderBy(movimientos.anio, movimientos.mes);

    let balance = 0;
    // When anioHasta is specified (Flujo page), return all rows; otherwise last 12 (Dashboard)
    const data = anioHasta ? rows : rows.slice(-12);
    const flujo = data.map((r) => {
        const ing = Number(r.ingresos);
        const sal = Number(r.salidas);
        balance += ing - sal;
        return { periodo: `${MESES_SHORT[r.mes]} ${r.anio}`, anio: r.anio, mes: r.mes, ingresos: ing, salidas: sal, balance };
    });

    return c.json({ flujo });
});

// GET /api/dashboard/categorias?anio=&mes=&empresa=&limite=8
dashboardRoutes.get("/categorias", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ categorias: [] }, 401);

    const anio = Number(c.req.query("anio"));
    const mes = Number(c.req.query("mes"));
    const limite = Number(c.req.query("limite") ?? 8);
    const empresaId = await resolveEmpresaId(c.req.query("empresa"));

    const conds: SQL[] = [eq(movimientos.activo, true), eq(movimientos.tipo, "SALIDA")];
    if (anio) conds.push(eq(movimientos.anio, anio));
    if (mes) conds.push(eq(movimientos.mes, mes));
    if (empresaId) conds.push(eq(movimientos.empresaId, empresaId));

    const rows = await db
        .select({
            categoria: categorias.nombre,
            total: sql<string>`SUM(${movimientos.monto}::numeric)`,
        })
        .from(movimientos)
        .leftJoin(categorias, eq(movimientos.categoriaId, categorias.id))
        .where(and(...conds))
        .groupBy(categorias.nombre)
        .orderBy(desc(sql`SUM(${movimientos.monto}::numeric)`))
        .limit(limite);

    return c.json({
        categorias: rows.map((r) => ({ categoria: r.categoria ?? "Sin categoría", total: Number(r.total) })),
    });
});

// GET /api/dashboard/recientes?empresa=
dashboardRoutes.get("/recientes", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ movimientos: [] }, 401);

    const empresaId = await resolveEmpresaId(c.req.query("empresa"));

    const conds: SQL[] = [eq(movimientos.activo, true)];
    if (empresaId) conds.push(eq(movimientos.empresaId, empresaId));

    const rows = await db
        .select({
            id: movimientos.id,
            fecha: movimientos.fecha,
            empresa: empresas.nombre,
            tipo: movimientos.tipo,
            categoria: categorias.nombre,
            concepto: movimientos.concepto,
            monto: movimientos.monto,
        })
        .from(movimientos)
        .leftJoin(empresas, eq(movimientos.empresaId, empresas.id))
        .leftJoin(categorias, eq(movimientos.categoriaId, categorias.id))
        .where(and(...conds))
        .orderBy(desc(movimientos.fecha))
        .limit(15);

    return c.json({ movimientos: rows });
});

// GET /api/dashboard/cuentas?empresa=
dashboardRoutes.get("/cuentas", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ cxc: 0, cxp: 0 }, 401);

    const empresaId = await resolveEmpresaId(c.req.query("empresa"));

    const conds: SQL[] = [eq(cuentasPendientes.pagado, false)];
    if (empresaId) conds.push(eq(cuentasPendientes.empresaId, empresaId));

    const rows = await db
        .select({
            tipo: cuentasPendientes.tipo,
            total: sql<string>`COALESCE(SUM(${cuentasPendientes.monto}::numeric), 0)`,
        })
        .from(cuentasPendientes)
        .where(and(...conds))
        .groupBy(cuentasPendientes.tipo);

    return c.json({
        cxc: Number(rows.find((r) => r.tipo === "CXC")?.total ?? 0),
        cxp: Number(rows.find((r) => r.tipo === "CXP")?.total ?? 0),
    });
});

// GET /api/dashboard/proyectos?empresa=
dashboardRoutes.get("/proyectos", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ proyectos: [] }, 401);

    const empresaId = await resolveEmpresaId(c.req.query("empresa"));
    const conds: SQL[] = [eq(movimientos.activo, true)];
    if (empresaId) conds.push(eq(movimientos.empresaId, empresaId));

    const rows = await db
        .select({
            proyecto: proyectos.nombre,
            empresa: empresas.nombre,
            registros: sql<string>`COUNT(${movimientos.id})`,
            flujo: sql<string>`SUM(CASE WHEN ${movimientos.tipo} = 'INGRESO' THEN ${movimientos.monto}::numeric ELSE -${movimientos.monto}::numeric END)`,
            fechaMin: sql<string>`MIN(${movimientos.fecha})`,
            fechaMax: sql<string>`MAX(${movimientos.fecha})`,
        })
        .from(movimientos)
        .innerJoin(proyectos, eq(movimientos.proyectoId, proyectos.id))
        .leftJoin(empresas, eq(movimientos.empresaId, empresas.id))
        .where(and(...conds))
        .groupBy(proyectos.id, proyectos.nombre, empresas.nombre)
        .orderBy(desc(sql`COUNT(${movimientos.id})`));

    return c.json({
        proyectos: rows.map((r) => ({
            proyecto: r.proyecto,
            empresa: r.empresa ?? "—",
            registros: Number(r.registros),
            flujo: Number(r.flujo ?? 0),
            fechaMin: r.fechaMin,
            fechaMax: r.fechaMax,
        })),
    });
});

// GET /api/dashboard/cuentas-saldo?empresa=
dashboardRoutes.get("/cuentas-saldo", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ cuentas: [] }, 401);

    const empresaId = await resolveEmpresaId(c.req.query("empresa"));
    const conds: SQL[] = [eq(movimientos.activo, true)];
    if (empresaId) conds.push(eq(movimientos.empresaId, empresaId));

    const rows = await db
        .select({
            cuenta: cuentasBancarias.nombre,
            saldo: sql<string>`SUM(CASE WHEN ${movimientos.tipo} = 'INGRESO' THEN ${movimientos.monto}::numeric ELSE -${movimientos.monto}::numeric END)`,
            count: sql<string>`COUNT(${movimientos.id})`,
        })
        .from(movimientos)
        .innerJoin(cuentasBancarias, eq(movimientos.cuentaId, cuentasBancarias.id))
        .where(and(...conds))
        .groupBy(cuentasBancarias.id, cuentasBancarias.nombre)
        .orderBy(desc(sql`COUNT(${movimientos.id})`));

    return c.json({
        cuentas: rows.map((r) => ({
            cuenta: r.cuenta,
            saldo: Number(r.saldo ?? 0),
            count: Number(r.count),
        })),
    });
});

// GET /api/dashboard/movimiento/:id
dashboardRoutes.get("/movimiento/:id", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ mov: null }, 401);

    const [row] = await db
        .select({
            id: movimientos.id,
            fecha: movimientos.fecha,
            empresa: empresas.nombre,
            tipo: movimientos.tipo,
            monto: movimientos.monto,
            concepto: movimientos.concepto,
            categoria: categorias.nombre,
            grupo: grupos.nombre,
            nombre: movimientos.nombre,
            cuenta: cuentasBancarias.nombre,
            proyecto: proyectos.nombre,
            comentario: movimientos.comentario,
            fuente: movimientos.fuente,
            createdAt: movimientos.createdAt,
            updatedAt: movimientos.updatedAt,
        })
        .from(movimientos)
        .leftJoin(empresas, eq(movimientos.empresaId, empresas.id))
        .leftJoin(categorias, eq(movimientos.categoriaId, categorias.id))
        .leftJoin(grupos, eq(movimientos.grupoId, grupos.id))
        .leftJoin(cuentasBancarias, eq(movimientos.cuentaId, cuentasBancarias.id))
        .leftJoin(proyectos, eq(movimientos.proyectoId, proyectos.id))
        .where(eq(movimientos.id, c.req.param("id")));

    if (!row) return c.json({ mov: null }, 404);
    return c.json({ mov: row });
});

export default dashboardRoutes;
