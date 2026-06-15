"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Users, Plus, Pencil, Trash2, Loader2, Save, X, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/auth/types";

interface AppUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UserFormState {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  active: boolean;
}

const EMPTY_FORM: UserFormState = {
  email: "",
  name: "",
  password: "",
  role: "viewer",
  active: true,
};

export function UsersManagementSettings() {
  const [users, setUsers] = useState<AppUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);

  const showBanner = (tone: "ok" | "err", text: string) => {
    setBanner({ tone, text });
    setTimeout(() => setBanner(null), 5000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.status === 403 || res.status === 401) {
        setForbidden(true);
        setUsers([]);
        return;
      }
      if (!res.ok) throw new Error("No se pudo cargar usuarios");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
      setForbidden(false);
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowCreate(true);
  };

  const startEdit = (user: AppUserDto) => {
    setShowCreate(false);
    setEditingId(user.id);
    setForm({
      email: user.email,
      name: user.name,
      password: "",
      role: user.role,
      active: user.active,
    });
  };

  const cancelForm = () => {
    setEditingId(null);
    setShowCreate(false);
    setForm(EMPTY_FORM);
  };

  const saveForm = async () => {
    setSaving(true);
    try {
      const isCreate = showCreate && !editingId;
      const res = await fetch("/api/users", {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isCreate
            ? form
            : {
                id: editingId,
                email: form.email,
                name: form.name,
                role: form.role,
                active: form.active,
                ...(form.password.trim() ? { password: form.password } : {}),
              },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      await fetchUsers();
      cancelForm();
      showBanner("ok", isCreate ? "Usuario creado." : "Usuario actualizado.");
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (id: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar");
      await fetchUsers();
      showBanner("ok", "Usuario eliminado.");
    } catch (e) {
      showBanner("err", e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  if (forbidden) return null;

  return (
    <section id="usuarios" className="border rounded-xl p-4 sm:p-6 scroll-mt-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-600" />
          Gestión de usuarios
        </h3>
        <Button variant="outline" size="sm" onClick={startCreate} className="gap-1 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Nuevo usuario
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Usuarios almacenados en PostgreSQL. Roles: <strong>admin</strong> (todo),{" "}
        <strong>analyst</strong> (operación completa sin gestión de usuarios),{" "}
        <strong>viewer</strong> (solo lectura en dashboards).
      </p>

      {banner && (
        <p
          className={cn(
            "text-sm font-medium mb-4",
            banner.tone === "ok" ? "text-emerald-600" : "text-red-600",
          )}
        >
          {banner.text}
        </p>
      )}

      {(showCreate || editingId) && (
        <div className="mb-4 border rounded-lg p-4 bg-muted/20 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            {showCreate ? "Crear usuario" : "Editar usuario"}
          </h4>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Correo</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Contraseña {editingId ? "(dejar vacío para no cambiar)" : ""}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg bg-background"
              >
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Usuario activo
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveForm} disabled={saving} className="gap-1 bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar
            </Button>
            <Button size="sm" variant="outline" onClick={cancelForm} className="gap-1">
              <X className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Correo</th>
                <th className="py-2 pr-3">Rol</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Último acceso</th>
                <th className="py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{u.name}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{u.email}</td>
                  <td className="py-2.5 pr-3">{ROLE_LABELS[u.role]}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        u.active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("es-PE") : "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(u)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        onClick={() => removeUser(u.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No hay usuarios registrados.</p>
          )}
        </div>
      )}
    </section>
  );
}
