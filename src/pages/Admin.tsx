import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Users, Bot, Sparkles, Plus, Trash2, Save, Eye, EyeOff, Pencil, Shield, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────
interface UserRow {
  id: string;
  user_id: string;
  nombre: string;
  empresas: string[];
  activo: boolean;
  created_at: string;
  email?: string;
  rol?: string;
}

interface LLMProvider {
  id: string;
  name: string;
  base_url: string;
  api_key_encrypted: string;
  models: string[];
  is_default: boolean;
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  enabled: boolean;
  provider_id: string | null;
  model: string;
}

const EMPRESAS_OPTIONS = ["BM CORP", "MIHBAH", "YCDI"];
const ROL_OPTIONS = ["SUPER_ADMIN_DEV", "SUPER_ADMIN", "ADMIN", "VIEWER"] as const;

// ── Main Component ──────────────────────────────────────────
export default function AdminPage() {
  const { user } = useAuth();
  const isDevAdmin = user?.rol === "SUPER_ADMIN_DEV";
  const isSuperAdmin = user?.rol === "SUPER_ADMIN" || isDevAdmin;

  if (!isSuperAdmin) {
    return <EmptyState icon={Settings} title="Acceso denegado" description="Solo administradores pueden acceder a esta sección." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Administración</h1>
          <p className="text-sm text-muted-foreground">
            {isDevAdmin ? "Usuarios, IA y configuración del sistema" : "Gestión de usuarios"}
          </p>
        </div>
        {isDevAdmin && (
          <Badge className="ml-auto bg-primary/20 text-primary border-primary/30 gap-1">
            <ShieldCheck className="h-3 w-3" /> DEV ADMIN
          </Badge>
        )}
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Users className="h-4 w-4" /> Usuarios
          </TabsTrigger>
          {isDevAdmin && (
            <>
              <TabsTrigger value="llm" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                <Bot className="h-4 w-4" /> Conexiones LLM
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                <Sparkles className="h-4 w-4" /> Skills del Agente
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        {isDevAdmin && (
          <>
            <TabsContent value="llm"><LLMTab /></TabsContent>
            <TabsContent value="skills"><SkillsTab /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

// ── Users Tab ───────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("*");

    const rolesMap = new Map<string, string>();
    roles?.forEach((r) => rolesMap.set(r.user_id, r.role));

    const mapped = (profiles ?? []).map((p) => ({
      ...p,
      rol: rolesMap.get(p.user_id) ?? "VIEWER",
    }));
    setUsers(mapped);
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} usuarios registrados</p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Crear nuevo usuario</DialogTitle>
            </DialogHeader>
            <CreateUserForm onSuccess={() => { setShowCreate(false); fetchUsers(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border" style={{ background: "hsl(var(--bg-surface))" }}>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresas</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={5} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-border hover:bg-card/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">{u.nombre.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="font-medium">{u.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={cn(
                      "text-xs",
                      u.rol === "SUPER_ADMIN_DEV" && "bg-warning/20 text-warning border-warning/30",
                      u.rol === "SUPER_ADMIN" && "bg-primary/20 text-primary border-primary/30",
                      u.rol === "ADMIN" && "bg-turquesa/20 text-turquesa border-turquesa/30",
                      u.rol === "VIEWER" && "bg-muted text-muted-foreground"
                    )}>
                      {u.rol === "SUPER_ADMIN_DEV" && <ShieldCheck className="h-3 w-3 mr-1" />}
                      {u.rol === "SUPER_ADMIN" && <Shield className="h-3 w-3 mr-1" />}
                      {u.rol}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {u.empresas.includes("*") ? (
                        <Badge variant="outline" className="text-xs">Todas</Badge>
                      ) : u.empresas.map((e) => (
                        <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium", u.activo ? "text-positive" : "text-negative")}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(u.created_at).toLocaleDateString("es-MX")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Create User Form ────────────────────────────────────────
function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<string>("VIEWER");
  const [empresas, setEmpresas] = useState<string[]>(["*"]);
  const [loading, setLoading] = useState(false);

  // Only SUPER_ADMIN_DEV can create other SUPER_ADMIN_DEV users
  const availableRoles = user?.rol === "SUPER_ADMIN_DEV" 
    ? ROL_OPTIONS 
    : (["SUPER_ADMIN", "ADMIN", "VIEWER"] as const);

  function toggleEmpresa(emp: string) {
    if (empresas.includes("*")) {
      setEmpresas([emp]);
    } else if (empresas.includes(emp)) {
      const next = empresas.filter((e) => e !== emp);
      setEmpresas(next.length === 0 ? ["*"] : next);
    } else {
      const next = [...empresas, emp];
      setEmpresas(next.length === 3 ? ["*"] : next);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ email, password, nombre, rol, empresas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear usuario");

      toast.success("Usuario creado exitosamente");
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" required className="bg-background" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@empresa.mx" required className="bg-background" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Contraseña temporal</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 caracteres" required className="bg-background" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Rol</Label>
          <Select value={rol} onValueChange={setRol}>
            <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableRoles.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Empresas asignadas</Label>
        <div className="flex gap-2 flex-wrap">
          {EMPRESAS_OPTIONS.map((emp) => (
            <label key={emp} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={empresas.includes("*") || empresas.includes(emp)}
                onCheckedChange={() => toggleEmpresa(emp)}
              />
              <span className="text-sm">{emp}</span>
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando..." : "Crear usuario"}
      </Button>
    </form>
  );
}

// ── LLM Connections Tab (DB-backed) ─────────────────────────
function LLMTab() {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newModel, setNewModel] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("llm_providers").select("*").order("created_at");
    setProviders((data as unknown as LLMProvider[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  async function saveProvider(provider: LLMProvider) {
    setSaving((prev) => ({ ...prev, [provider.id]: true }));
    const { error } = await supabase.from("llm_providers").upsert({
      id: provider.id,
      name: provider.name,
      base_url: provider.base_url,
      api_key_encrypted: provider.api_key_encrypted,
      models: provider.models,
      is_default: provider.is_default,
    } as any);
    setSaving((prev) => ({ ...prev, [provider.id]: false }));
    if (error) {
      toast.error("Error al guardar: " + error.message);
    } else {
      toast.success(`${provider.name} guardado`);
      fetchProviders();
    }
  }

  function updateLocal(id: string, patch: Partial<LLMProvider>) {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function setDefault(id: string) {
    // Unset all, then set this one
    const updated = providers.map((p) => ({ ...p, is_default: p.id === id }));
    setProviders(updated);
    for (const p of updated) {
      await supabase.from("llm_providers").update({ is_default: p.is_default } as any).eq("id", p.id);
    }
    toast.success("Proveedor por defecto actualizado");
    fetchProviders();
  }

  async function addProvider() {
    const newProv: any = {
      name: "Nuevo Proveedor",
      base_url: "",
      api_key_encrypted: "",
      models: [],
      is_default: false,
    };
    const { data, error } = await supabase.from("llm_providers").insert(newProv).select().single();
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Proveedor creado");
      fetchProviders();
    }
  }

  async function deleteProvider(id: string) {
    const { error } = await supabase.from("llm_providers").delete().eq("id", id);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Proveedor eliminado");
      fetchProviders();
    }
  }

  function addModel(providerId: string) {
    const model = newModel[providerId]?.trim();
    if (!model) return;
    const prov = providers.find((p) => p.id === providerId);
    if (!prov || prov.models.includes(model)) return;
    const updated = { ...prov, models: [...prov.models, model] };
    updateLocal(providerId, { models: updated.models });
    setNewModel((prev) => ({ ...prev, [providerId]: "" }));
  }

  function removeModel(providerId: string, model: string) {
    const prov = providers.find((p) => p.id === providerId);
    if (!prov) return;
    updateLocal(providerId, { models: prov.models.filter((m) => m !== model) });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configura las conexiones a proveedores de IA. Guarda los cambios con el botón de cada proveedor.
        </p>
        <Button size="sm" className="gap-2" onClick={addProvider}>
          <Plus className="h-4 w-4" /> Agregar Proveedor
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="p-4 border-border">
              <div className="h-20 bg-muted rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : providers.length === 0 ? (
        <EmptyState icon={Bot} title="Sin proveedores" description="Agrega tu primer proveedor LLM para comenzar." />
      ) : (
        <div className="grid gap-4">
          {providers.map((prov) => (
            <Card key={prov.id} className={cn("p-4 border-border transition-colors", prov.is_default && "border-primary/50 bg-primary/5")}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold bg-primary/20 text-primary">
                    {prov.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <Input
                      value={prov.name}
                      onChange={(e) => updateLocal(prov.id, { name: e.target.value })}
                      className="bg-transparent border-none p-0 h-auto font-medium text-sm focus-visible:ring-0"
                    />
                    <Input
                      value={prov.base_url}
                      onChange={(e) => updateLocal(prov.id, { base_url: e.target.value })}
                      placeholder="https://api.provider.com/v1"
                      className="bg-transparent border-none p-0 h-auto text-xs text-muted-foreground focus-visible:ring-0"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {prov.is_default && <Badge className="bg-primary/20 text-primary text-xs">Default</Badge>}
                  {!prov.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => setDefault(prov.id)} className="text-xs">
                      Usar como default
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    disabled={saving[prov.id]}
                    onClick={() => saveProvider(prov)}
                  >
                    <Save className="h-3 w-3" />
                    {saving[prov.id] ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-negative" onClick={() => deleteProvider(prov.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">API Key</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type={showKeys[prov.id] ? "text" : "password"}
                      value={prov.api_key_encrypted}
                      onChange={(e) => updateLocal(prov.id, { api_key_encrypted: e.target.value })}
                      placeholder="sk-..."
                      className="bg-background flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowKeys((prev) => ({ ...prev, [prov.id]: !prev[prov.id] }))}
                    >
                      {showKeys[prov.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Modelos disponibles</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {prov.models.map((m) => (
                      <Badge key={m} variant="outline" className="text-xs gap-1">
                        {m}
                        <button onClick={() => removeModel(prov.id, m)} className="ml-1 hover:text-negative">×</button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={newModel[prov.id] ?? ""}
                      onChange={(e) => setNewModel((prev) => ({ ...prev, [prov.id]: e.target.value }))}
                      placeholder="Agregar modelo..."
                      className="bg-background text-xs h-8"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addModel(prov.id))}
                    />
                    <Button size="sm" variant="outline" onClick={() => addModel(prov.id)} className="h-8 text-xs">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Agent Skills Tab (DB-backed) ────────────────────────────
function SkillsTab() {
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: skillsData }, { data: provsData }] = await Promise.all([
      supabase.from("agent_skills").select("*").order("created_at"),
      supabase.from("llm_providers").select("*").order("created_at"),
    ]);
    setSkills((skillsData as unknown as AgentSkill[]) ?? []);
    setProviders((provsData as unknown as LLMProvider[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleSkill(id: string) {
    const skill = skills.find((s) => s.id === id);
    if (!skill) return;
    await supabase.from("agent_skills").update({ enabled: !skill.enabled } as any).eq("id", id);
    fetchData();
  }

  async function deleteSkill(id: string) {
    await supabase.from("agent_skills").delete().eq("id", id);
    if (editingId === id) setEditingId(null);
    fetchData();
    toast.success("Skill eliminado");
  }

  async function saveSkill(id: string, patch: Partial<AgentSkill>) {
    await supabase.from("agent_skills").update(patch as any).eq("id", id);
    setEditingId(null);
    fetchData();
    toast.success("Skill guardado");
  }

  async function createSkill(skill: Omit<AgentSkill, "id">) {
    const { error } = await supabase.from("agent_skills").insert(skill as any);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Skill creado");
      setShowCreate(false);
      fetchData();
    }
  }

  const allModels = providers.flatMap((p) =>
    p.models.map((m) => ({ provider_id: p.id, providerName: p.name, model: m }))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define las habilidades del agente IA (Jade AI) con prompts personalizados
        </p>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Skill
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle>Crear nuevo skill</DialogTitle>
            </DialogHeader>
            <SkillForm
              allModels={allModels}
              onSubmit={createSkill}
              onCancel={() => setShowCreate(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="p-4 border-border">
              <div className="h-16 bg-muted rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : skills.length === 0 ? (
        <EmptyState icon={Sparkles} title="Sin skills" description="Crea tu primer skill para personalizar a Jade AI." />
      ) : (
        <div className="grid gap-3">
          {skills.map((skill) => {
            const prov = providers.find((p) => p.id === skill.provider_id);
            return (
              <Card key={skill.id} className={cn(
                "border-border transition-all",
                skill.enabled ? "border-primary/30" : "opacity-60"
              )}>
                {editingId === skill.id ? (
                  <div className="p-4">
                    <SkillForm
                      initial={skill}
                      allModels={allModels}
                      onSubmit={(updated) => saveSkill(skill.id, updated)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <div className="p-4 flex items-start gap-4">
                    <button
                      onClick={() => toggleSkill(skill.id)}
                      className={cn(
                        "mt-0.5 h-5 w-9 rounded-full transition-colors relative shrink-0",
                        skill.enabled ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                        skill.enabled ? "translate-x-4" : "translate-x-0.5"
                      )} />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">{skill.name}</h3>
                        <Badge variant="outline" className="text-[10px]">
                          {prov?.name ?? "Sin proveedor"} / {skill.model}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{skill.description}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
                        "{skill.system_prompt.slice(0, 120)}..."
                      </p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(skill.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-negative" onClick={() => deleteSkill(skill.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Skill Form ──────────────────────────────────────────────
function SkillForm({
  initial,
  allModels,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<AgentSkill>;
  allModels: { provider_id: string; providerName: string; model: string }[];
  onSubmit: (skill: Omit<AgentSkill, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(initial?.system_prompt ?? "");
  const [selectedModel, setSelectedModel] = useState(
    initial?.provider_id && initial?.model
      ? `${initial.provider_id}/${initial.model}`
      : allModels[0] ? `${allModels[0].provider_id}/${allModels[0].model}` : ""
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const slashIdx = selectedModel.indexOf("/");
    const provider_id = selectedModel.slice(0, slashIdx);
    const model = selectedModel.slice(slashIdx + 1);
    onSubmit({
      name,
      description,
      system_prompt: systemPrompt,
      enabled: initial?.enabled ?? true,
      provider_id,
      model,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nombre</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CFO Virtual" required className="bg-background" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Proveedor / Modelo</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="Seleccionar modelo" /></SelectTrigger>
            <SelectContent>
              {allModels.map((m) => (
                <SelectItem key={`${m.provider_id}/${m.model}`} value={`${m.provider_id}/${m.model}`}>
                  {m.providerName} — {m.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Descripción</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué hace este skill..." className="bg-background" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">System Prompt</Label>
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Eres un asistente que..."
          rows={6}
          className="bg-background font-mono text-xs"
          required
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" className="gap-2"><Save className="h-3.5 w-3.5" /> Guardar</Button>
      </div>
    </form>
  );
}
