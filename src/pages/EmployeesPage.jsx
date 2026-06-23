// ============================================================
// ChronosWork — Página de Empleados
// Lista todos los empleados con JOIN a area_employees y areas
// para mostrar el nombre del área en la columna "ÁREA".
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useAreas } from '../hooks/useAreas';
import EmployeeForm from '../components/EmployeeForm';
import BulkImportModal from '../components/BulkImportModal';
import {
  MdAdd, MdUpload, MdEdit, MdDelete, MdSearch,
  MdRefresh, MdPeople, MdPersonAdd, MdCheckCircle, MdContentCopy,
} from 'react-icons/md';

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

              <div className="cw-alert" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                ℹ️ Se creará una cuenta de acceso con correo institucional y contraseña temporal.
                El colaborador podrá cambiar su contraseña al ingresar por primera vez.
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
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Entregue estas credenciales físicamente al colaborador.</p>
              </div>

              <div className="cw-alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '1.25rem', fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>
                ⚠️ Esta información solo se mostrará UNA VEZ. Cópiela antes de cerrar.
              </div>

              {[['Correo', 'email'], ['Contraseña', 'password']].map(([label, field]) => (
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

export default function EmployeesPage() {
  const { tenant } = useAuth();
  const { areas, assignEmployee, removeEmployee } = useAreas();

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
  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este empleado?')) return;
    const { error } = await supabase
      .from('employees')
      .update({ activo: false })
      .eq('id', id);
    if (error) {
      alert('Error al eliminar: ' + error.message);
      return;
    }
    await fetchEmployees();
  };

  // ─── Helpers para UI ──────────────────────────────────────────────────
  const formatMoney = (n) =>
    n ? `$${Number(n).toLocaleString('es-CO')}` : '—';

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

  return (
    <div className="cw-page">
      {/* Header */}
      <div className="cw-page__header">
        <div>
          <h2 className="cw-page__title">
            <MdPeople style={{ marginRight: 8, color: '#10b981' }} />
            Colaboradores registrados
          </h2>
          <p className="cw-page__subtitle">
            Gestión de personal, contratos y seguridad social
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
            className="cw-btn cw-btn--primary"
            onClick={() => { setEditingEmployee(null); setShowForm(true); }}
            disabled={areas.length === 0}
            title={areas.length === 0 ? 'Crea áreas primero' : 'Crear nuevo empleado'}
          >
            <MdAdd /> Nuevo empleado
          </button>
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
          <div style={{ overflowX: 'auto' }}>
            <table className="cw-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 90 }}>CÉDULA</th>
                  <th>NOMBRE COMPLETO</th>
                  <th>CARGO</th>
                  <th>ÁREA</th>
                  <th>TIPO CONTRATO</th>
                  <th style={{ textAlign: 'right' }}>VALOR / HORA</th>
                  <th>INGRESO</th>
                  <th>ESTADO</th>
                  <th>CUENTA</th>
                  <th style={{ width: 100 }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  const area = getArea(emp);
                  return (
                    <tr key={emp.id}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {emp.cedula}
                      </td>
                      <td style={{ fontWeight: 600 }}>{emp.nombre}</td>
                      <td>{emp.cargo || '—'}</td>
                      <td>
                        {area ? (
                          <span
                            style={{
                              background: (area.color || '#6366f1') + '20',
                              color: area.color || '#6366f1',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 4,
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ● {area.nombre}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
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
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                        {formatMoney(emp.valor_hora)}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {formatDate(emp.fecha_ingreso)}
                      </td>
                      <td>
                        {emp.activo ? (
                          <span className="cw-badge cw-badge--success">● Activo</span>
                        ) : (
                          <span className="cw-badge cw-badge--muted">Inactivo</span>
                        )}
                      </td>
                      <td>
                        {emp.auth_user_id ? (
                          <span style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MdCheckCircle /> Vinculada
                          </span>
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
                            onClick={() => handleDelete(emp.id)}
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

      {provisioningEmployee && (
        <ProvisionAccountModal
          employee={provisioningEmployee}
          onClose={() => { setProvisioningEmployee(null); fetchEmployees(); }}
        />
      )}
    </div>
  );
}


