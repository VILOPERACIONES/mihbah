import { sql } from "drizzle-orm";

import {
    boolean,
    date,
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    vector,
} from "drizzle-orm/pg-core";

// ─── ENUMS ────────────────────────────────────────────────────────────────

export const appRoleEnum = pgEnum("app_role", [
    "SUPER_ADMIN_DEV",
    "SUPER_ADMIN",
    "ADMIN",
    "VIEWER",
]);

export const tipoMovEnum = pgEnum("tipo_mov", [
    "INGRESO",
    "SALIDA",
    "INTERNO",
    "PRESTAMO",
]);

export const empresaTipoEnum = pgEnum("empresa_tipo", [
    "GENERADORA",
    "SERVICIO",
]);

export const fuenteDatosEnum = pgEnum("fuente_datos", [
    "EXCEL",
    "MONDAY",
    "MANUAL",
]);

export const estadoVentaEnum = pgEnum("estado_venta", [
    "ACTIVA",
    "FINALIZADA",
    "CANCELADA",
    "VENCIDA",
]);

export const estadoCuentaEnum = pgEnum("estado_cuenta", [
    "AL_CORRIENTE",
    "VENCIDO",
    "PROXIMO_PAGO",
    "FINALIZADA",
]);

// ─── EMPRESAS ─────────────────────────────────────────────────────────────

export const empresas = pgTable("empresas", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull().unique(),
    razonSocial: text("razon_social"),
    rfc: text("rfc"),
    tipo: empresaTipoEnum("tipo").notNull().default("GENERADORA"),
    fuenteDatos: fuenteDatosEnum("fuente_datos").notNull().default("EXCEL"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── PROYECTOS (normalizados) ─────────────────────────────────────────────

export const proyectos = pgTable("proyectos", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull().unique(),
    descripcion: text("descripcion"),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── CUENTAS BANCARIAS ────────────────────────────────────────────────────

export const cuentasBancarias = pgTable("cuentas_bancarias", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull().unique(),
    banco: text("banco"),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── CATÁLOGOS ────────────────────────────────────────────────────────────

export const categorias = pgTable("categorias", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull().unique(),
    activo: boolean("activo").notNull().default(true),
});

export const grupos = pgTable("grupos", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull().unique(),
    activo: boolean("activo").notNull().default(true),
});

// ─── USERS + AUTH (Lucia) ─────────────────────────────────────────────────

export const users = pgTable("users", {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ─── PROFILES ─────────────────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
    nombre: text("nombre").notNull().default(""),
    empresasPermitidas: uuid("empresas_permitidas").array().notNull().default(sql`ARRAY[]::uuid[]`),
    modulosOverride: jsonb("modulos_override"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── ROLES ────────────────────────────────────────────────────────────────

export const userRoles = pgTable("user_roles", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull().default("VIEWER"),
}, (t) => ({
    userRoleUnique: uniqueIndex("user_role_unique").on(t.userId, t.role),
}));

export const roleModuleAccess = pgTable("role_module_access", {
    id: uuid("id").primaryKey().defaultRandom(),
    role: appRoleEnum("role").notNull(),
    module: text("module").notNull(),
    allowed: boolean("allowed").notNull().default(true),
}, (t) => ({
    roleModuleUnique: uniqueIndex("role_module_unique").on(t.role, t.module),
}));

// ─── EXCEL UPLOADS ────────────────────────────────────────────────────────

export const excelUploads = pgTable("excel_uploads", {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
    nombreArchivo: text("nombre_archivo").notNull(),
    totalFilas: integer("total_filas").notNull().default(0),
    filasImportadas: integer("filas_importadas").notNull().default(0),
    filasError: integer("filas_error").notNull().default(0),
    erroresDetalle: jsonb("errores_detalle"),
    subidoPorId: text("subido_por_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── MOVIMIENTOS (tabla central — movimientos financieros) ────────────────

export const movimientos = pgTable("movimientos", {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull().references(() => empresas.id, { onDelete: "restrict" }),
    proyectoId: uuid("proyecto_id").references(() => proyectos.id, { onDelete: "set null" }),
    cuentaId: uuid("cuenta_id").references(() => cuentasBancarias.id, { onDelete: "set null" }),
    categoriaId: uuid("categoria_id").references(() => categorias.id, { onDelete: "set null" }),
    grupoId: uuid("grupo_id").references(() => grupos.id, { onDelete: "set null" }),
    anio: integer("anio").notNull(),
    mes: integer("mes").notNull(),
    fecha: date("fecha").notNull(),
    tipo: tipoMovEnum("tipo").notNull(),
    nombre: text("nombre"),
    concepto: text("concepto").notNull(),
    monto: numeric("monto", { precision: 15, scale: 2 }).notNull(),
    comentario: text("comentario"),
    fuente: fuenteDatosEnum("fuente").notNull().default("EXCEL"),
    activo: boolean("activo").notNull().default(true),
    uploadId: uuid("upload_id").references(() => excelUploads.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
    empresaIdx: index("movimientos_empresa_idx").on(t.empresaId),
    fechaIdx: index("movimientos_fecha_idx").on(t.fecha),
    tipoIdx: index("movimientos_tipo_idx").on(t.tipo),
}));

// ─── CUENTAS PENDIENTES (CXC y CXP) ───────────────────────────────────────

export const cuentasPendientes = pgTable("cuentas_pendientes", {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").notNull().references(() => empresas.id, { onDelete: "restrict" }),
    tipo: text("tipo").notNull(),
    descripcion: text("descripcion").notNull().default(""),
    monto: numeric("monto", { precision: 15, scale: 2 }).notNull(),
    referencia: text("referencia"),
    fechaEmision: date("fecha_emision").notNull().defaultNow(),
    fechaVencimiento: date("fecha_vencimiento"),
    fechaPago: date("fecha_pago"),
    pagado: boolean("pagado").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── YCDI: Accionistas y aportaciones ─────────────────────────────────────

export const accionistas = pgTable("accionistas", {
    id: uuid("id").primaryKey().defaultRandom(),
    codigo: text("codigo").unique(),
    nombre: text("nombre").notNull(),
    copropietario: text("copropietario"),
    email: text("email"),
    telefono: text("telefono"),
    direccion: text("direccion"),
    nacionalidad: text("nacionalidad"),
    asesor: text("asesor"),
    tipoAccionista: text("tipo_accionista"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const acuerdosAportacion = pgTable("acuerdos_aportacion", {
    id: uuid("id").primaryKey().defaultRandom(),
    accionistaId: uuid("accionista_id").notNull().references(() => accionistas.id, { onDelete: "cascade" }),
    proyectoId: uuid("proyecto_id").notNull().references(() => proyectos.id, { onDelete: "restrict" }),
    paquete: text("paquete"),
    ticket: text("ticket"),
    numeroAcciones: numeric("numero_acciones", { precision: 12, scale: 2 }).notNull(),
    precioPorAccion: numeric("precio_por_accion", { precision: 15, scale: 2 }).notNull(),
    montoTotal: numeric("monto_total", { precision: 15, scale: 2 }).notNull(),
    enganche: numeric("enganche", { precision: 15, scale: 2 }).notNull().default("0"),
    porcentajeEnganche: numeric("porcentaje_enganche", { precision: 5, scale: 4 }),
    numeroMensualidades: integer("numero_mensualidades").notNull(),
    mensualidad: numeric("mensualidad", { precision: 15, scale: 2 }),
    fechaApertura: date("fecha_apertura"),
    fechaInicio: date("fecha_inicio"),
    fechaContrato: date("fecha_contrato"),
    estado: estadoVentaEnum("estado").notNull().default("ACTIVA"),
    comentarios: text("comentarios"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pagosAportacion = pgTable("pagos_aportacion", {
    id: uuid("id").primaryKey().defaultRandom(),
    acuerdoId: uuid("acuerdo_id").notNull().references(() => acuerdosAportacion.id, { onDelete: "cascade" }),
    numeroPago: integer("numero_pago").notNull(),
    fechaProgramada: date("fecha_programada").notNull(),
    fechaPago: date("fecha_pago"),
    montoEsperado: numeric("monto_esperado", { precision: 15, scale: 2 }).notNull(),
    montoPagado: numeric("monto_pagado", { precision: 15, scale: 2 }).notNull().default("0"),
    estado: estadoCuentaEnum("estado").notNull().default("PROXIMO_PAGO"),
    comentarios: text("comentarios"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
    acuerdoIdx: index("pagos_acuerdo_idx").on(t.acuerdoId),
    fechaIdx: index("pagos_fecha_idx").on(t.fechaProgramada),
}));

// ─── BM CORP — preparado para Monday (al final) ───────────────────────────

export const alianzas = pgTable("alianzas", {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull().unique(),
    contacto: text("contacto"),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ventasBmcorp = pgTable("ventas_bmcorp", {
    id: uuid("id").primaryKey().defaultRandom(),
    alianzaId: uuid("alianza_id").references(() => alianzas.id, { onDelete: "set null" }),
    proyectoId: uuid("proyecto_id").references(() => proyectos.id, { onDelete: "set null" }),
    cliente: text("cliente"),
    monto: numeric("monto", { precision: 15, scale: 2 }).notNull(),
    fechaVenta: date("fecha_venta").notNull(),
    estado: estadoVentaEnum("estado").notNull().default("ACTIVA"),
    mondayId: text("monday_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repartosBmcorp = pgTable("repartos_bmcorp", {
    id: uuid("id").primaryKey().defaultRandom(),
    alianzaId: uuid("alianza_id").references(() => alianzas.id, { onDelete: "set null" }),
    ventaId: uuid("venta_id").references(() => ventasBmcorp.id, { onDelete: "set null" }),
    monto: numeric("monto", { precision: 15, scale: 2 }).notNull(),
    estado: text("estado").notNull().default("PENDIENTE"),
    fechaProgramada: date("fecha_programada"),
    fechaPagado: date("fecha_pagado"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sincronizacionesMonday = pgTable("sincronizaciones_monday", {
    id: uuid("id").primaryKey().defaultRandom(),
    estado: text("estado").notNull(),
    registrosImportados: integer("registros_importados").notNull().default(0),
    errores: jsonb("errores"),
    iniciadaEn: timestamp("iniciada_en", { withTimezone: true }).notNull().defaultNow(),
    finalizadaEn: timestamp("finalizada_en", { withTimezone: true }),
});

// ─── IA: Conversaciones, providers, skills ────────────────────────────────

export const conversaciones = pgTable("conversaciones", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "set null" }),
    mensajes: jsonb("mensajes").notNull().default(sql`'[]'::jsonb`),
    tokens: integer("tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const llmProviders = pgTable("llm_providers", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    baseUrl: text("base_url").notNull().default(""),
    apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
    models: text("models").array().notNull().default(sql`ARRAY[]::text[]`),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentSkills = pgTable("agent_skills", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    description: text("description").notNull().default(""),
    systemPrompt: text("system_prompt").notNull().default(""),
    model: text("model").notNull().default("claude-sonnet-4-20250514"),
    providerId: uuid("provider_id").references(() => llmProviders.id, { onDelete: "set null" }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── RAG Semántico ────────────────────────────────────────────────────────

export const knowledgeChunks = pgTable("knowledge_chunks", {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull(),
    category: text("category").notNull(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1024 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
    empresaIdx: index("knowledge_empresa_idx").on(t.empresaId),
    categoryIdx: index("knowledge_category_idx").on(t.category),
}));