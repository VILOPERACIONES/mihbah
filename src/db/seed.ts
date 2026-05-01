import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { Scrypt } from "oslo/password";
import { generateId } from "lucia";
import {
    cuentasBancarias,
    categorias,
    db,
    empresas,
    grupos,
    profiles,
    proyectos,
    roleModuleAccess,
    userRoles,
    users,
} from "./index";

const scrypt = new Scrypt();

const MODULES = [
    "dashboard",
    "flujo_caja",
    "proyectos",
    "cuentas",
    "reportes",
    "cargas_excel",
    "sincronizacion_monday",
] as const;

type AppRole = "SUPER_ADMIN_DEV" | "SUPER_ADMIN" | "ADMIN" | "VIEWER";

const ROLE_MODULE_MAP: Record<AppRole, Set<string>> = {
    SUPER_ADMIN_DEV: new Set(MODULES),
    SUPER_ADMIN: new Set(MODULES),
    ADMIN: new Set(["dashboard", "flujo_caja", "proyectos", "cuentas", "reportes", "cargas_excel"]),
    VIEWER: new Set(["dashboard", "flujo_caja", "proyectos", "cuentas", "reportes"]),
};

async function main() {
    // 0. Verify connection
    const connCheck = await db.execute(sql`SELECT NOW() AS now`);
    console.log("DB OK:", connCheck[0]);

    // 1. Empresas
    await db.insert(empresas).values([
        { nombre: "MIHBAH", tipo: "GENERADORA", fuenteDatos: "EXCEL" },
        { nombre: "YCDI", tipo: "GENERADORA", fuenteDatos: "EXCEL" },
        { nombre: "BM CORP", tipo: "GENERADORA", fuenteDatos: "MONDAY" },
    ]).onConflictDoNothing();
    console.log("Empresas OK");

    const [mihbah] = await db.select().from(empresas).where(eq(empresas.nombre, "MIHBAH"));
    console.log("MIHBAH id:", mihbah.id);

    // 2. Proyectos (todos asociados a MIHBAH)
    await db.insert(proyectos).values([
        "KOOBEN",
        "MIHBAH",
        "OTOCH",
        "KASA BONITA",
        "HUUNAL",
        "OBSERVATORIO",
        "GLORIETA CENTRAL",
        "ESCUELA",
        "CABAÑAS",
        "ACTIVACIONES CP",
        "LIMPIEZA",
        "MIHBAH-ACTIVOS",
    ].map((nombre) => ({ nombre, empresaId: mihbah.id }))).onConflictDoNothing();
    console.log("Proyectos OK");

    // 3. Cuenta bancaria
    await db.insert(cuentasBancarias).values({
        nombre: "BBVA Mihbah",
        banco: "BBVA",
        empresaId: mihbah.id,
    }).onConflictDoNothing();
    console.log("Cuentas bancarias OK");

    // 4. Categorías (defaults para empresa de obras)
    await db.insert(categorias).values([
        "MATERIALES DE CONSTRUCCION",
        "MANO DE OBRA",
        "SUBCONTRATOS",
        "EQUIPO Y MAQUINARIA",
        "HERRAMIENTA",
        "TRANSPORTE Y FLETE",
        "COMBUSTIBLE Y LUBRICANTES",
        "ALIMENTACION",
        "HOSPEDAJE",
        "SERVICIOS PROFESIONALES",
        "HONORARIOS",
        "PERMISOS Y LICENCIAS",
        "SEGUROS",
        "NOMINA ADMINISTRATIVA",
        "PRESTACIONES SOCIALES",
        "GASTOS FINANCIEROS",
        "IMPUESTOS Y DERECHOS",
        "MARKETING Y PUBLICIDAD",
        "TECNOLOGIA Y SOFTWARE",
        "IMPREVISTOS",
    ].map((nombre) => ({ nombre }))).onConflictDoNothing();
    console.log("Categorías OK");

    // 5. Grupos (defaults para empresa de obras)
    await db.insert(grupos).values([
        "COSTO DIRECTO",
        "COSTO INDIRECTO",
        "GASTOS ADMINISTRATIVOS",
        "GASTOS FINANCIEROS",
        "GASTOS COMERCIALES",
        "RECURSOS HUMANOS",
        "LOGISTICA",
        "LEGAL",
        "PROVEEDORES",
        "CLIENTES",
        "BANCOS",
        "SOCIOS",
        "GOBIERNO",
        "OPERACIONES",
        "INFRAESTRUCTURA",
        "MANTENIMIENTO",
        "SEGURIDAD",
        "PROYECTOS ACTIVOS",
        "GASTOS GENERALES",
        "CAPITAL",
    ].map((nombre) => ({ nombre }))).onConflictDoNothing();
    console.log("Grupos OK");

    // 6. Role module access (4 roles × 7 módulos = 28 filas)
    const roles: AppRole[] = ["SUPER_ADMIN_DEV", "SUPER_ADMIN", "ADMIN", "VIEWER"];
    const rmaValues = roles.flatMap((role) =>
        MODULES.map((module) => ({
            role,
            module,
            allowed: ROLE_MODULE_MAP[role].has(module),
        }))
    );
    await db.insert(roleModuleAccess).values(rmaValues).onConflictDoNothing();
    console.log("Role module access OK");

    // 7. Usuario SUPER_ADMIN_DEV (dev@mihbah.mx / Admin1234!)
    const DEV_EMAIL = "dev@mihbah.mx";
    const existing = await db.select().from(users).where(eq(users.email, DEV_EMAIL));
    if (existing.length === 0) {
        const userId = generateId(15);
        const passwordHash = await scrypt.hash("Admin1234!");
        await db.insert(users).values({ id: userId, email: DEV_EMAIL, passwordHash });
        await db.insert(profiles).values({ userId, nombre: "Dev Admin" });
        await db.insert(userRoles).values({ userId, role: "SUPER_ADMIN_DEV" });
        console.log("Usuario dev creado:", DEV_EMAIL);
    } else {
        console.log("Usuario dev ya existe:", DEV_EMAIL);
    }

    // 8. Verificación final
    const counts = await db.execute(sql`
        SELECT
            (SELECT COUNT(*) FROM empresas)          AS empresas,
            (SELECT COUNT(*) FROM proyectos)          AS proyectos,
            (SELECT COUNT(*) FROM cuentas_bancarias)  AS cuentas_bancarias,
            (SELECT COUNT(*) FROM categorias)         AS categorias,
            (SELECT COUNT(*) FROM grupos)             AS grupos,
            (SELECT COUNT(*) FROM role_module_access) AS role_module_access,
            (SELECT COUNT(*) FROM users)              AS users
    `);
    console.table(counts[0]);
}

main()
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exit(1);
    })
    .finally(() => process.exit(0));
