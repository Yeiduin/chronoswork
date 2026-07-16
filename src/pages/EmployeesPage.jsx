// ============================================================
// ChronosWork — Página de Empleados
// ============================================================
import { useDragScroll } from '../hooks/useDragScroll';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useAreas } from '../hooks/useAreas';
import { useShifts } from '../hooks/useShifts';
import { useAbsences } from '../hooks/useAbsences';
import { getPeriodoActual } from '../core/dateUtils';
import { formatCOP } from '../core/validators';
import EmployeeForm from '../components/EmployeeForm';
import BulkImportModal from '../components/BulkImportModal';
import {
  MdAdd, MdUpload, MdEdit, MdDelete, MdSearch,
  MdRefresh, MdPeople, MdPersonAdd, MdCheckCircle, MdContentCopy, MdClose, MdVpnKey,
  MdArrowUpward, MdArrowDownward, MdDownload, MdWarningAmber,
} from 'react-icons/md';

const JORNADA_MAP = {
  DIURNA: { emoji: '☀️', text: 'Diurna' },
  NOCTURNA: { emoji: '🌙', text: 'Nocturna' },
  MIXTA: { emoji: '🌓', text: 'Mixta' },
  CUALQUIERA: { emoji: '🔄', text: 'Cualquiera' },
};

function getAbsenceBadge(tipo) {
  if (!tipo) return null;
  const t = tipo.toLowerCase();
  if (t.startsWith('incapacidad')) return { label: 'Incapacidad', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (t === 'vacaciones') return { label: 'Vacaciones', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  if (t.startsWith('permiso')) return { label: 'Permiso', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return { label: 'Novedad', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
}

// ── Modal de provisión de cuenta de empleado ─────────────────────────────────
function ProvisionAccountModal({ employee, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState({});

  const handleProvision = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No hay sesión activa.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/provision-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id: employee.id,
          cedula:      employee.cedula,
          nombre:      employee.nombre,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.detail || `Error HTTP: ${res.status}`);
      }
      setCredentials(json.credentials);
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (field, value) => {
    await navigator.clipboard.writeText(value);
    setCopied(p => ({ ...p, [field]: true }));
    setTimeout(() => setCopied(p => ({ ...p, [field]: false })), 2000);
  };

  return (
    <div className="cw-modal-overlay" onClick={(e) => e.target === e.currentTarget && !credentials && onClose()}>
      <div className="cw-modal" style={{ maxWidth: 460 }}>
        <div className="cw-modal__header">
          <div className="cw-modal__title">
            <MdPersonAdd /> Crear cuenta de acceso
          </div>
          <button className="cw-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="cw-modal__body">
          {!credentials ? (
            <>
              <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: 'var(--surface-2)', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{employee.nombre}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>C.C. {employee.cedula} · {employee.cargo}</div>
              </div>

              <div className="cw-alert cw-alert--info" style={{ borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem' }}>
                ℹ️ Se creará una cuenta de acceso con correo institucional basado en el nombre del colaborador.
                La contraseña inicial será su número de cédula. Podrá ingresar con el correo o con su cédula.
              </div>

              {error && <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>🚫 {error}</div>}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="cw-btn cw-btn--secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
                <button
                  id={`btn-provision-${employee.id}`}
                  type="button"
                  className="cw-btn cw-btn--primary"
                  style={{ flex: 2 }}
                  onClick={handleProvision}
                  disabled={loading}
                >
                  {loading ? <><span className="cw-spinner cw-spinner--sm"></span> Creando cuenta...</> : '🔑 Crear cuenta de acceso'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                <MdCheckCircle style={{ fontSize: '3rem', color: '#22c55e' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>¡Cuenta creada exitosamente!</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Entregue estas credenciales físicamente al colaborador. Puede ingresar con su correo o su número de cédula.</p>
              </div>

              <div className="cw-alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                ⚠️ La contraseña inicial es el número de cédula del colaborador. Se recomienda que la cambie al primer ingreso.
              </div>

              {[['Correo institucional', 'email'], ['Contraseña (cédula)', 'password']].map(([label, field]) => (
                <div key={field} className="cw-form-group">
                  <label className="cw-label">{label}</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="cw-input"
                      readOnly
                      value={credentials[field]}
                      style={{ fontFamily: 'monospace', flex: 1 }}
                    />
                    <button
                      type="button"
                      className="cw-btn cw-btn--secondary"
                      onClick={() => copyToClipboard(field, credentials[field])}
                      style={{ flexShrink: 0, minWidth: 80, fontSize: '0.78rem' }}
                    >
                      {copied[field] ? <><MdCheckCircle /> Copiado</> : <><MdContentCopy /> Copiar</>}
                    </button>
                  </div>
                </div>
              ))}

              <div className="cw-alert cw-alert--info" style={{ borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                📌 <strong>Login del colaborador:</strong> Puede ingresar con el correo de arriba <strong>o</strong> con su número de cédula como usuario.
              </div>

              <button
                type="button"
                className="cw-btn cw-btn--primary"
                onClick={onClose}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                ✓ Listo, ya entregué las credenciales
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal para ver credenciales (Email y Cédula) ────────────────────────────
function ViewCredentialsModal({ employee, onClose }) {
  const [copied, setCopied] = useState({ email: false, password: false });

  const copyToClipboard = (field, text) => {
    navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [field]: true }));
    setTimeout(() => setCopied(prev => ({ ...prev, [field]: false })), 2000);
  };

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal" style={{ maxWidth: 450 }}>
        <div className="cw-modal__header">
          <h2 className="cw-modal__title">Credenciales de Acceso</h2>
          <button className="cw-modal__close" onClick={onClose} aria-label="Cerrar modal"><MdClose /></button>
        </div>
        <div className="cw-modal__body">
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <MdVpnKey style={{ fontSize: '3rem', color: 'var(--cw-accent)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {employee.nombre}
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              El colaborador puede usar cualquiera de estos datos para iniciar sesión.
            </p>
          </div>

          {[['Correo institucional', employee.email_institucional, 'email'], ['Cédula (usuario/contraseña)', employee.cedula, 'password']].map(([label, value, field]) => (
            <div key={field} className="cw-form-group">
              <label className="cw-label">{label}</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="cw-input"
                  readOnly
                  value={value || 'No disponible'}
                  style={{ fontFamily: 'monospace', flex: 1, color: value ? 'inherit' : 'var(--text-muted)' }}
                />
                {value && (
                  <button
                    type="button"
                    className="cw-btn cw-btn--secondary"
                    onClick={() => copyToClipboard(field, value)}
                    style={{ flexShrink: 0, minWidth: 80, fontSize: '0.78rem' }}
                  >
                    {copied[field] ? <><MdCheckCircle /> Copiado</> : <><MdContentCopy /> Copiar</>}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="cw-alert cw-alert--info" style={{ borderRadius: 8, padding: '0.6rem 0.9rem', marginTop: '1rem', fontSize: '0.75rem' }}>
            📌 <strong>Nota:</strong> Si el empleado cambió su contraseña inicial, la nueva contraseña no será visible aquí por seguridad. En caso de pérdida, deberá usar la opción de recuperación por correo.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const { tenant } = useAuth();
  const { areas, assignEmployee, removeEmployee } = useAreas();
  const { ref: tableRef, handlers, style: dragStyle } = useDragScroll();
  const { shifts } = useShifts(getPeriodoActual());
  const { getNovedad } = useAbsences();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterEstado, setFilterEstado] = useState('activos');

  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [provisioningEmployee, setProvisioningEmployee] = useState(null);
  const [viewCredentialsEmployee, setViewCredentialsEmployee] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortCol, setSortCol] = useState('nombre');
  const [sortDir, setSortDir] = useState('asc');
  const [inlineAreaEdit, setInlineAreaEdit] = useState(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const shiftEmployeeIds = useMemo(() => new Set(shifts.map(s => s.employee_id)), [shifts]);

  // ─── Cargar empleados con su área asignada (vía JOIN) ─────────────────
  const fetchEmployees = async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          area_employees!left(
            id,
            area_id,
            areas!left(id, nombre, color, sector)
          )
        `)
        .eq('tenant_id', tenant.id)
        .order('nombre');
      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  // ─── Guardar (crear o actualizar) empleado ─────────────────────────────
  const handleSave = async (formData, selectedAreaId) => {
    let savedEmployee;
    if (editingEmployee) {
      // Actualizar
      const { data, error } = await supabase
        .from('employees')
        .update({ ...formData, tenant_id: tenant.id })
        .eq('id', editingEmployee.id)
        .select()
        .single();
      if (error) throw error;
      savedEmployee = data;
    } else {
      // Crear
      const { data, error } = await supabase
        .from('employees')
        .insert([{ ...formData, tenant_id: tenant.id }])
        .select()
        .single();
      if (error) throw error;
      savedEmployee = data;
    }

    // Asignar al área (tabla pivote)
    if (selectedAreaId && savedEmployee?.id) {
      await assignEmployee(selectedAreaId, savedEmployee.id);
    }

    await fetchEmployees();
    setShowForm(false);
    setEditingEmployee(null);
    return savedEmployee;
  };

  // ─── Eliminar empleado (soft delete) ──────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    const { error } = await supabase
      .from('employees')
      .update({ activo: false })
      .eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
      setDeleteConfirm(null);
      return;
    }
    setDeleteConfirm(null);
    await fetchEmployees();
  };

  // ─── Helpers para UI ──────────────────────────────────────────────────
  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
    });
  };

  // El JOIN puede traer varios registros en area_employees; nos quedamos
  // con el primero que tenga un área válida.
  const getArea = (emp) => {
    const rels = emp.area_employees;
    if (!rels) return null;
    if (Array.isArray(rels)) {
      for (const r of rels) {
        if (r.areas) return r.areas;
      }
      return null;
    }
    return rels.areas || null;
  };

  // ─── Ordenamiento ────────────────────────────────────────────────────
  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const renderTh = (col, label, style) => (
    <th
      style={{ cursor: 'pointer', userSelect: 'none', ...style }}
      onClick={() => handleSort(col)}
    >
      {label}{' '}
      {sortCol === col && (sortDir === 'asc'
        ? <MdArrowUpward style={{ fontSize: '0.8rem', verticalAlign: 'middle' }} />
        : <MdArrowDownward style={{ fontSize: '0.8rem', verticalAlign: 'middle' }} />)}
    </th>
  );

  // ─── KPIs ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total: employees.length,
    activos: employees.filter(e => e.activo).length,
    sinArea: employees.filter(e => !getArea(e)).length,
    sinTurno: employees.filter(e => e.activo && !shiftEmployeeIds.has(e.id)).length,
  }), [employees, shiftEmployeeIds]);

  // ─── Filtrado ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return employees.filter(emp => {
      if (filterEstado === 'activos' && !emp.activo) return false;
      if (filterEstado === 'inactivos' && emp.activo) return false;

      if (filterArea) {
        const a = getArea(emp);
        if (!a || a.id !== filterArea) return false;
      }

      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const hay = (
          String(emp.nombre || '').toLowerCase().includes(s) ||
          String(emp.cedula || '').toLowerCase().includes(s) ||
          String(emp.cargo || '').toLowerCase().includes(s)
        );
        if (!hay) return false;
      }
      return true;
    });
  }, [employees, searchTerm, filterArea, filterEstado]);

  // ─── Ordenamiento del filtrado ─────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let valA, valB;
      switch (sortCol) {
        case 'nombre':
          valA = (a.nombre || '').toLowerCase();
          valB = (b.nombre || '').toLowerCase();
          break;
        case 'cargo':
          valA = (a.cargo || '').toLowerCase();
          valB = (b.cargo || '').toLowerCase();
          break;
        case 'valor_hora':
          valA = a.valor_hora || 0;
          valB = b.valor_hora || 0;
          break;
        case 'fecha_ingreso':
          valA = a.fecha_ingreso || '';
          valB = b.fecha_ingreso || '';
          break;
        default:
          return 0;
      }
      let cmp;
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB;
      } else {
        cmp = String(valA).localeCompare(String(valB), 'es');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortCol, sortDir]);

  // ─── Exportar CSV ──────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Cedula', 'Nombre', 'Cargo', 'Area', 'TipoContrato', 'Jornada', 'ValorHora', 'SalarioMensual', 'HorasSemanales', 'FechaIngreso', 'Estado'];
    const rows = sorted.map(emp => {
      const area = getArea(emp);
      return [
        emp.cedula || '',
        emp.nombre || '',
        emp.cargo || '',
        area?.nombre || '',
        emp.tipo_contrato || '',
        emp.jornada_preferida || '',
        emp.valor_hora || '',
        emp.salario_mensual || '',
        emp.horas_semanales_contrato || '',
        emp.fecha_ingreso || '',
        emp.activo ? 'Activo' : 'Inactivo',
      ];
    });
    const escapeCSV = (field) => {
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const csv = [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `empleados_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-wrapper animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">
            <MdPeople style={{ marginRight: 8, color: '#10b981' }} />
            Colaboradores registrados
          </h1>
          <p className="page-subtitle">
            Gestión de personal, contratos y seguridad social
          </p>
        </div>
        <div className="page-header__actions">
          <button
            className="cw-btn cw-btn--secondary"
            onClick={fetchEmployees}
            disabled={loading}
            title="Refrescar lista"
          >
            <MdRefresh /> {loading ? 'Cargando...' : 'Refrescar'}
          </button>
          <button
            className="cw-btn cw-btn--secondary"
            onClick={() => setShowImport(true)}
            disabled={areas.length === 0}
            title={areas.length === 0 ? 'Crea áreas primero' : 'Importar empleados desde Excel'}
          >
            <MdUpload /> Importar Excel
          </button>
          <button
            className="cw-btn cw-btn--secondary"
            onClick={exportCSV}
            disabled={sorted.length === 0}
            title="Exportar empleados a CSV"
          >
            <MdDownload /> Exportar CSV
          </button>
          <button
            className="cw-btn cw-btn--primary"
            onClick={() => { setEditingEmployee(null); setShowForm(true); }}
            disabled={areas.length === 0}
            title={areas.length === 0 ? 'Crea áreas primero' : 'Crear nuevo empleado'}
          >
            <MdAdd /> Nuevo empleado
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="cw-card" style={{ flex: 1, padding: '0.75rem 1rem', minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total empleados</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--cw-accent)' }}>{kpis.total}</div>
        </div>
        <div className="cw-card" style={{ flex: 1, padding: '0.75rem 1rem', minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Activos</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e' }}>{kpis.activos}</div>
        </div>
        <div className="cw-card" style={{ flex: 1, padding: '0.75rem 1rem', minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Sin área</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{kpis.sinArea}</div>
        </div>
        <div className="cw-card" style={{ flex: 1, padding: '0.75rem 1rem', minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Sin turno</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{kpis.sinTurno}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="cw-card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <MdSearch style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)',
            }} />
            <input
              type="text"
              className="cw-input"
              placeholder="Buscar por nombre, cédula o cargo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>
          <select
            className="cw-input"
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
          >
            <option value="">Todas las áreas</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
          <select
            className="cw-input"
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
          >
            <option value="activos">Solo activos</option>
            <option value="inactivos">Solo inactivos</option>
            <option value="todos">Todos</option>
          </select>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            <strong style={{ color: 'var(--cw-accent)' }}>{filtered.length}</strong> de {employees.length}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>🚫 {error}</div>}

      {/* Tabla */}
      <div className="cw-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && employees.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="cw-spinner" style={{ margin: '0 auto 0.75rem' }}></div>
            Cargando empleados...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {employees.length === 0
              ? '👤 No hay empleados registrados. Crea el primero con "Nuevo empleado".'
              : '🔍 Ningún empleado coincide con los filtros.'}
          </div>
        ) : (
          <div ref={tableRef} {...handlers} style={dragStyle}>
            <table className="cw-table cw-table--striped" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 90 }}>CÉDULA</th>
                  {renderTh('nombre', 'NOMBRE COMPLETO')}
                  {renderTh('cargo', 'CARGO')}
                  <th>JORNADA</th>
                  <th style={{ textAlign: 'center' }}>HORAS/SEM</th>
                  <th>ÁREA</th>
                  <th>TIPO CONTRATO</th>
                  {renderTh('valor_hora', 'SALARIO / MES', { textAlign: 'right' })}
                  {renderTh('fecha_ingreso', 'INGRESO')}
                  <th>ESTADO</th>
                  <th>CUENTA</th>
                  <th style={{ width: 100 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(emp => {
                  const area = getArea(emp);
                  const jornada = JORNADA_MAP[emp.jornada_preferida] || JORNADA_MAP.CUALQUIERA;
                  const novedad = getNovedad(emp.id, todayStr);
                  const novedadBadge = novedad ? getAbsenceBadge(novedad.tipo) : null;
                  const sinTurno = emp.activo && !shiftEmployeeIds.has(emp.id);
                  return (
                    <tr key={emp.id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {emp.cedula}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {emp.nombre}
                        {sinTurno && (
                          <MdWarningAmber
                            style={{ color: '#f59e0b', fontSize: '1rem', marginLeft: '0.3rem', verticalAlign: 'middle' }}
                            title="Sin turnos en el período actual"
                          />
                        )}
                      </td>
                      <td>{emp.cargo || '—'}</td>
                      <td>
                        <span style={{ fontSize: '0.78rem' }}>
                          {jornada.emoji} {jornada.text}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        {emp.horas_semanales_contrato ? `${emp.horas_semanales_contrato}h` : '—'}
                      </td>
                      <td>
                        {inlineAreaEdit === emp.id ? (
                          <select
                            className="cw-input"
                            autoFocus
                            defaultValue={area?.id || ''}
                            onChange={async (e) => {
                              const newAreaId = e.target.value;
                              setInlineAreaEdit(null);
                              if (newAreaId === (area?.id || '')) return;
                              try {
                                if (newAreaId) {
                                  await assignEmployee(newAreaId, emp.id);
                                } else {
                                  await removeEmployee(emp.id);
                                }
                                await fetchEmployees();
                              } catch (err) {
                                alert('Error al cambiar área: ' + err.message);
                              }
                            }}
                            onBlur={() => setInlineAreaEdit(null)}
                            style={{ fontSize: '0.75rem', padding: '0.15rem 0.3rem', width: 'auto' }}
                          >
                            <option value="">Sin área</option>
                            {areas.map(a => (
                              <option key={a.id} value={a.id}>{a.nombre}</option>
                            ))}
                          </select>
                        ) : area ? (
                          <span
                            style={{
                              background: (area.color || '#6366f1') + '20',
                              color: area.color || '#6366f1',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 4,
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                            onClick={() => setInlineAreaEdit(emp.id)}
                            title="Click para cambiar de área"
                          >
                            ● {area.nombre}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: 'var(--text-muted)',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              textDecoration: 'underline dotted',
                            }}
                            onClick={() => setInlineAreaEdit(emp.id)}
                            title="Click para asignar un área"
                          >
                            Sin área
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem' }}>
                          {emp.tipo_contrato === 'INDEFINIDO' && '♾️ '}
                          {emp.tipo_contrato === 'TERMINO_FIJO' && '📅 '}
                          {emp.tipo_contrato === 'OBRA_LABOR' && '🔨 '}
                          {emp.tipo_contrato === 'POR_HORAS' && '⏰ '}
                          {emp.tipo_contrato === 'PRESTACION_SERVICIOS' && '📄 '}
                          {emp.tipo_contrato || '—'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ color: '#10b981', fontWeight: 600 }}>
                          {emp.salario_mensual ? formatCOP(emp.salario_mensual) : '—'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          /h: {emp.valor_hora ? formatCOP(emp.valor_hora) : '—'}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {formatDate(emp.fecha_ingreso)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          {emp.activo ? (
                            <span className="cw-badge cw-badge--success">● Activo</span>
                          ) : (
                            <span className="cw-badge cw-badge--muted">Inactivo</span>
                          )}
                          {novedadBadge && (
                            <span
                              title={novedad ? (novedad.tipo || 'Novedad activa') : undefined}
                              style={{
                                background: novedadBadge.bg,
                                color: novedadBadge.color,
                                padding: '0.1rem 0.4rem',
                                borderRadius: 4,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                width: 'fit-content',
                              }}
                            >
                              {novedadBadge.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {emp.auth_user_id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MdCheckCircle /> Vinculada
                            </span>
                            <button
                              type="button"
                              className="cw-btn cw-btn--secondary"
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.65rem', borderRadius: 4 }}
                              onClick={() => setViewCredentialsEmployee(emp)}
                            >
                              <MdVpnKey /> Credenciales
                            </button>
                          </div>
                        ) : emp.activo ? (
                          <button
                            id={`btn-provision-emp-${emp.id}`}
                            className="cw-btn cw-btn--secondary cw-btn--sm"
                            onClick={() => setProvisioningEmployee(emp)}
                            title="Crear cuenta de acceso para este empleado"
                            style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, padding: '0.25rem 0.6rem' }}
                          >
                            <MdPersonAdd /> Crear cuenta
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="cw-btn cw-btn--icon"
                            onClick={() => { setEditingEmployee(emp); setShowForm(true); }}
                            title="Editar"
                          >
                            <MdEdit />
                          </button>
                          <button
                            className="cw-btn cw-btn--icon cw-btn--danger"
                            onClick={() => setDeleteConfirm({ id: emp.id, nombre: emp.nombre })}
                            title="Eliminar"
                          >
                            <MdDelete />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {showForm && (
        <EmployeeForm
          employee={editingEmployee}
          areas={areas}
          onClose={() => { setShowForm(false); setEditingEmployee(null); }}
          onSave={handleSave}
        />
      )}

      {showImport && (
        <BulkImportModal
          areas={areas}
          onClose={(refresh) => {
            setShowImport(false);
            if (refresh) fetchEmployees();
          }}
          onBulkSave={async (employeeData) => {
            const { data, error } = await supabase
              .from('employees')
              .insert([{ ...employeeData, tenant_id: tenant.id }])
              .select()
              .single();
            if (error) throw error;
            return data;
          }}
        />
      )}

      {/* Modal de provisión de cuenta */}
      {provisioningEmployee && (
        <ProvisionAccountModal
          employee={provisioningEmployee}
          onClose={(shouldRefresh) => {
            setProvisioningEmployee(null);
            if (shouldRefresh === true) fetchEmployees();
          }}
        />
      )}

      {/* Modal para ver credenciales */}
      {viewCredentialsEmployee && (
        <ViewCredentialsModal
          employee={viewCredentialsEmployee}
          onClose={() => setViewCredentialsEmployee(null)}
        />
      )}

      {/* Confirmar eliminación de empleado */}
      {deleteConfirm && (
        <div className="cw-modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="cw-modal animate-slide-up" style={{ maxWidth: 420 }}>
            <div className="cw-modal__header">
              <h3 className="cw-modal__title">🗑️ Eliminar colaborador</h3>
              <button className="cw-modal__close" onClick={() => setDeleteConfirm(null)}><MdClose /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0 1.25rem', marginBottom: '1.25rem' }}>
              ¿Eliminar a <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.nombre}</strong>?
              El colaborador se marcará como inactivo. Esta acción se puede revertir desde la base de datos.
            </p>
            <div className="cw-modal__footer">
              <button className="cw-btn cw-btn--secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="cw-btn cw-btn--danger" onClick={handleDelete}>
                <MdDelete /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
