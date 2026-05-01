import { Hono } from "hono";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { lucia } from "../../lib/auth";
import {
    db,
    movimientos,
    empresas,
    categorias,
    grupos,
    cuentasBancarias,
    proyectos,
    excelUploads,
} from "../../db/index";

const movimientosRoutes = new Hono();

async function validateSession(cookieHeader: string) {
    const sessionId = lucia.readSessionCookie(cookieHeader);
    if (!sessionId) return null;
    const { session, user } = await lucia.validateSession(sessionId);
    return session ? user : null;
}

async function resolveEmpresaId(nombre: string | undefined | null): Promise<string | null> {
    if (!nombre || nombre === "TODAS") return null;
    const [row] = await db.select({ id: empresas.id }).from(empresas).where(eq(empresas.nombre, nombre));
    return row?.id ?? null;
}

// GET /api/movimientos?empresa=&tipo=&busqueda=&page=&upload_id=&anio=&mes=
movimientosRoutes.get("/", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ movimientos: [], total: 0 }, 401);

    const empresaId = await resolveEmpresaId(c.req.query("empresa"));
    const tipo = c.req.query("tipo");
    const busqueda = c.req.query("busqueda");
    const uploadId = c.req.query("upload_id");
    const page = Number(c.req.query("page") ?? 0);
    const anio = c.req.query("anio") ? Number(c.req.query("anio")) : null;
    const mes = c.req.query("mes") ? Number(c.req.query("mes")) : null;
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 50;
    const categoriasParam = c.req.query("categorias"); // comma-separated nombres

    const conds: SQL[] = [eq(movimientos.activo, true)];
    if (empresaId) conds.push(eq(movimientos.empresaId, empresaId));
    if (tipo && tipo !== "all") conds.push(eq(movimientos.tipo, tipo as "INGRESO" | "SALIDA" | "INTERNO" | "PRESTAMO"));
    if (busqueda) conds.push(ilike(movimientos.concepto, `%${busqueda}%`));
    if (uploadId) conds.push(eq(movimientos.uploadId, uploadId));
    if (anio) conds.push(eq(movimientos.anio, anio));
    if (mes) conds.push(eq(movimientos.mes, mes));
    if (categoriasParam) {
        const catNames = categoriasParam.split(",").filter(Boolean);
        if (catNames.length > 0) {
            const catRows = await db
                .select({ id: categorias.id })
                .from(categorias)
                .where(inArray(categorias.nombre, catNames));
            const catIds = catRows.map((r) => r.id);
            if (catIds.length > 0) {
                conds.push(inArray(movimientos.categoriaId, catIds));
            } else {
                conds.push(sql`1 = 0`);
            }
        }
    }

    const [countRow] = await db
        .select({ total: sql<string>`COUNT(*)` })
        .from(movimientos)
        .where(and(...conds));

    const rows = await db
        .select({
            id: movimientos.id,
            fecha: movimientos.fecha,
            empresa: empresas.nombre,
            tipo: movimientos.tipo,
            categoria: categorias.nombre,
            grupo: grupos.nombre,
            concepto: movimientos.concepto,
            nombre: movimientos.nombre,
            monto: movimientos.monto,
            cuenta: cuentasBancarias.nombre,
            proyecto: proyectos.nombre,
        })
        .from(movimientos)
        .leftJoin(empresas, eq(movimientos.empresaId, empresas.id))
        .leftJoin(categorias, eq(movimientos.categoriaId, categorias.id))
        .leftJoin(grupos, eq(movimientos.grupoId, grupos.id))
        .leftJoin(cuentasBancarias, eq(movimientos.cuentaId, cuentasBancarias.id))
        .leftJoin(proyectos, eq(movimientos.proyectoId, proyectos.id))
        .where(and(...conds))
        .orderBy(desc(movimientos.fecha))
        .limit(limit)
        .offset(page * limit);

    return c.json({ movimientos: rows, total: Number(countRow?.total ?? 0) });
});

// GET /api/movimientos/cards?empresa=
movimientosRoutes.get("/cards", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ ventas: 0, ventasCount: 0, inversion: 0, inversionCount: 0 }, 401);

    const empresaId = await resolveEmpresaId(c.req.query("empresa"));
    const anio = c.req.query("anio") ? Number(c.req.query("anio")) : null;

    const baseConds: SQL[] = [eq(movimientos.activo, true), eq(movimientos.tipo, "INGRESO")];
    if (empresaId) baseConds.push(eq(movimientos.empresaId, empresaId));
    if (anio) baseConds.push(eq(movimientos.anio, anio));

    const CATS_VENTAS = ["CLIENTES"];
    const CATS_INVERSION = ["ACCIONISTAS", "SOCIOS", "EMPRESA"];

    const [ventasRow] = await db
        .select({
            total: sql<string>`COALESCE(SUM(${movimientos.monto}::numeric), 0)`,
            count: sql<string>`COUNT(*)`,
        })
        .from(movimientos)
        .innerJoin(
            categorias,
            and(eq(movimientos.categoriaId, categorias.id), inArray(categorias.nombre, CATS_VENTAS))
        )
        .where(and(...baseConds));

    const [inversionRow] = await db
        .select({
            total: sql<string>`COALESCE(SUM(${movimientos.monto}::numeric), 0)`,
            count: sql<string>`COUNT(*)`,
        })
        .from(movimientos)
        .innerJoin(
            categorias,
            and(eq(movimientos.categoriaId, categorias.id), inArray(categorias.nombre, CATS_INVERSION))
        )
        .where(and(...baseConds));

    return c.json({
        ventas: Number(ventasRow?.total ?? 0),
        ventasCount: Number(ventasRow?.count ?? 0),
        inversion: Number(inversionRow?.total ?? 0),
        inversionCount: Number(inversionRow?.count ?? 0),
    });
});

// GET /api/movimientos/cargas
movimientosRoutes.get("/cargas", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ cargas: [] }, 401);

    const rows = await db
        .select({
            id: excelUploads.id,
            nombreArchivo: excelUploads.nombreArchivo,
            totalFilas: excelUploads.totalFilas,
            filasImportadas: excelUploads.filasImportadas,
            filasError: excelUploads.filasError,
            createdAt: excelUploads.createdAt,
        })
        .from(excelUploads)
        .orderBy(desc(excelUploads.createdAt));

    const uploadIds = rows.map((r) => r.id);
    const statsMap: Record<string, { movCount: number; totalMonto: number; empresas: string[] }> = {};

    if (uploadIds.length > 0) {
        const stats = await db
            .select({
                uploadId: movimientos.uploadId,
                empresa: empresas.nombre,
                monto: movimientos.monto,
            })
            .from(movimientos)
            .leftJoin(empresas, eq(movimientos.empresaId, empresas.id))
            .where(and(eq(movimientos.activo, true), inArray(movimientos.uploadId, uploadIds)));

        for (const s of stats) {
            if (!s.uploadId) continue;
            if (!statsMap[s.uploadId]) statsMap[s.uploadId] = { movCount: 0, totalMonto: 0, empresas: [] };
            statsMap[s.uploadId].movCount++;
            statsMap[s.uploadId].totalMonto += Math.abs(Number(s.monto));
            if (s.empresa && !statsMap[s.uploadId].empresas.includes(s.empresa)) {
                statsMap[s.uploadId].empresas.push(s.empresa);
            }
        }
    }

    return c.json({
        cargas: rows.map((r) => ({
            ...r,
            stats: statsMap[r.id] ?? { movCount: 0, totalMonto: 0, empresas: [] },
        })),
    });
});

// GET /api/movimientos/cargas/:id
movimientosRoutes.get("/cargas/:id", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ carga: null }, 401);

    const id = c.req.param("id");
    const [row] = await db
        .select({
            id: excelUploads.id,
            nombreArchivo: excelUploads.nombreArchivo,
            totalFilas: excelUploads.totalFilas,
            filasImportadas: excelUploads.filasImportadas,
            filasError: excelUploads.filasError,
            createdAt: excelUploads.createdAt,
        })
        .from(excelUploads)
        .where(eq(excelUploads.id, id));

    return c.json({ carga: row ?? null });
});

// DELETE /api/movimientos/cargas/:id
movimientosRoutes.delete("/cargas/:id", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ ok: false }, 401);

    const id = c.req.param("id");
    await db.update(movimientos).set({ activo: false }).where(eq(movimientos.uploadId, id));
    await db.delete(excelUploads).where(eq(excelUploads.id, id));

    return c.json({ ok: true });
});

// POST /api/movimientos/upload
movimientosRoutes.post("/upload", async (c) => {
    const user = await validateSession(c.req.header("Cookie") ?? "");
    if (!user) return c.json({ error: "No autorizado" }, 401);

    const body = await c.req.json<{
        nombreArchivo: string;
        totalRaw: number;
        errores?: Array<{ fila: number; error: string }>;
        filas: Array<{
            empresa: string;
            anio: number;
            mes: number;
            fecha: string;
            tipo: string;
            categoria: string | null;
            grupo: string | null;
            nombre: string | null;
            concepto: string;
            monto: number;
            cuenta: string | null;
            proyecto: string | null;
            comentario: string | null;
        }>;
    }>();

    const empresaNames = [...new Set(body.filas.map((f) => f.empresa).filter(Boolean))];
    const catNames = [...new Set(body.filas.map((f) => f.categoria).filter((x): x is string => !!x))];
    const grupoNames = [...new Set(body.filas.map((f) => f.grupo).filter((x): x is string => !!x))];
    const proyectoNames = [...new Set(body.filas.map((f) => f.proyecto).filter((x): x is string => !!x))];
    const cuentaNames = [...new Set(body.filas.map((f) => f.cuenta).filter((x): x is string => !!x))];

    // Resolve empresas
    const empresaMap = new Map<string, string>();
    if (empresaNames.length > 0) {
        await db.insert(empresas).values(empresaNames.map((n) => ({ nombre: n }))).onConflictDoNothing();
        const rows = await db.select({ id: empresas.id, nombre: empresas.nombre }).from(empresas).where(inArray(empresas.nombre, empresaNames));
        rows.forEach((r) => empresaMap.set(r.nombre, r.id));
    }

    // Resolve categorias
    const catMap = new Map<string, string>();
    if (catNames.length > 0) {
        await db.insert(categorias).values(catNames.map((n) => ({ nombre: n }))).onConflictDoNothing();
        const rows = await db.select({ id: categorias.id, nombre: categorias.nombre }).from(categorias).where(inArray(categorias.nombre, catNames));
        rows.forEach((r) => catMap.set(r.nombre, r.id));
    }

    // Resolve grupos
    const grupoMap = new Map<string, string>();
    if (grupoNames.length > 0) {
        await db.insert(grupos).values(grupoNames.map((n) => ({ nombre: n }))).onConflictDoNothing();
        const rows = await db.select({ id: grupos.id, nombre: grupos.nombre }).from(grupos).where(inArray(grupos.nombre, grupoNames));
        rows.forEach((r) => grupoMap.set(r.nombre, r.id));
    }

    // Resolve proyectos
    const proyectoMap = new Map<string, string>();
    if (proyectoNames.length > 0) {
        await db.insert(proyectos).values(proyectoNames.map((n) => ({ nombre: n }))).onConflictDoNothing();
        const rows = await db.select({ id: proyectos.id, nombre: proyectos.nombre }).from(proyectos).where(inArray(proyectos.nombre, proyectoNames));
        rows.forEach((r) => proyectoMap.set(r.nombre, r.id));
    }

    // Resolve cuentas
    const cuentaMap = new Map<string, string>();
    if (cuentaNames.length > 0) {
        await db.insert(cuentasBancarias).values(cuentaNames.map((n) => ({ nombre: n }))).onConflictDoNothing();
        const rows = await db.select({ id: cuentasBancarias.id, nombre: cuentasBancarias.nombre }).from(cuentasBancarias).where(inArray(cuentasBancarias.nombre, cuentaNames));
        rows.forEach((r) => cuentaMap.set(r.nombre, r.id));
    }

    // Create upload record
    const [uploadRecord] = await db
        .insert(excelUploads)
        .values({
            nombreArchivo: body.nombreArchivo,
            totalFilas: body.totalRaw,
            filasImportadas: 0,
            filasError: 0,
            subidoPorId: user.id,
        })
        .returning({ id: excelUploads.id });

    if (!uploadRecord) return c.json({ error: "No se pudo crear registro de carga" }, 500);
    const uploadId = uploadRecord.id;

    let imported = 0;
    let failed = 0;
    const BATCH = 250;

    for (let i = 0; i < body.filas.length; i += BATCH) {
        const batch = body.filas.slice(i, i + BATCH);
        const rowsToInsert: Array<{
            empresaId: string;
            anio: number;
            mes: number;
            fecha: string;
            tipo: "INGRESO" | "SALIDA" | "INTERNO" | "PRESTAMO";
            categoriaId: string | null;
            grupoId: string | null;
            proyectoId: string | null;
            cuentaId: string | null;
            nombre: string | null;
            concepto: string;
            monto: string;
            comentario: string | null;
            fuente: "EXCEL";
            uploadId: string;
        }> = [];

        for (const f of batch) {
            const empresaId = empresaMap.get(f.empresa);
            if (!empresaId) { failed++; continue; }
            rowsToInsert.push({
                empresaId,
                anio: f.anio,
                mes: f.mes,
                fecha: f.fecha.split("T")[0],
                tipo: f.tipo as "INGRESO" | "SALIDA" | "INTERNO" | "PRESTAMO",
                categoriaId: f.categoria ? (catMap.get(f.categoria) ?? null) : null,
                grupoId: f.grupo ? (grupoMap.get(f.grupo) ?? null) : null,
                proyectoId: f.proyecto ? (proyectoMap.get(f.proyecto) ?? null) : null,
                cuentaId: f.cuenta ? (cuentaMap.get(f.cuenta) ?? null) : null,
                nombre: f.nombre,
                concepto: f.concepto,
                monto: String(f.monto),
                comentario: f.comentario,
                fuente: "EXCEL",
                uploadId,
            });
        }

        if (rowsToInsert.length > 0) {
            await db.insert(movimientos).values(rowsToInsert);
            imported += rowsToInsert.length;
        }
    }

    const totalFailed = failed + (body.errores?.length ?? 0);
    await db
        .update(excelUploads)
        .set({
            filasImportadas: imported,
            filasError: totalFailed,
            erroresDetalle: totalFailed > 0 ? (body.errores ?? []) : null,
        })
        .where(eq(excelUploads.id, uploadId));

    return c.json({ ok: true, imported, failed: totalFailed, uploadId });
});

export default movimientosRoutes;
