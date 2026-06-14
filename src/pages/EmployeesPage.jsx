// ============================================================
// ChronosWork — Página de Gestión de Empleados
// Con EmployeeForm v3 (wizard 8 pasos) + Bulk Import
// ============================================================

import { useState, useMemo } from 'react';
import { useEmployees } from '../hooks/useEmployees';
import { useAreas } from '../hooks/useAreas';
import {
  MdAdd, MdEdit, MdDelete, MdClose, MdPeople, MdSearch,
  MdStar, MdDomain, MdInfo, MdUpload, MdFileDownload, MdWarning,
} from 'react-icons/md';
import { formatCOP } from '../core/validators';
import EmployeeForm from '../components/EmployeeForm';
import BulkImportModal from '../components/BulkImportModal';

// ─── Página principal ─────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { employees, loading, error, createEmployee, updateEmployee, deleteEmployee, fetchEmployees } = useEmployees();
  const { areas, assignEmployee } = useAreas();
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [filterArea, setFilterArea] = useState('all');
  const [filterContrato, setFilterContrato] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filtered = useMemo(() => {
    let result = employees;
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(e =>
        e.nombre?.toLowerCase().includes(term) ||
        e.cedula?.includes(term) ||
        e.cargo?.toLowerCase().includes(term)
      );
    }
    if (filterArea !== 'all') {
      const area = areas.find(a => a.id === filterArea);
      if (area) {
        const empIds = new Set(area.area_employees?.map(ae => ae.employee_id) || []);
        result = result.filter(e => empIds.has(e.id));
      }
    }
    if (filterContrato !== 'all') {
      result = result.filter(e => e.tipo_contrato === filterContrato);
    }
    return result;
  }, [employees, search, filterArea, filterContrato, areas]);

  const getEmployeeArea = (empId) =>
    areas.find(a => a.area_employees?.some(ae => ae.employee_id === empId));

  const handleEdit = (emp) => {
    setSelectedEmployee(emp);
    setShowModal(true);
  };

  const handleNew = () => {
    setSelectedEmployee(null);
    setShowModal(true);
  };

  // El EmployeeForm v3 espera (employeeData, areaId)
  // y maneja internamente la asignación al área
  const handleSave = async (employeeData, areaId) => {
    let savedEmp;
    if (selectedEmployee) {
      savedEmp = await updateEmployee(selectedEmployee.id, employeeData);
    } else {
      savedEmp = await createEmployee(employeeData);
    }
    if (areaId && savedEmp?.id) {
      await assignEmployee(areaId, savedEmp.id);
    }
    return savedEmp;
  };

  const handleDelete = async (id) => {
    await deleteEmployee(id);
    setDeleteConfirm(null);
  };

  // ── Estadísticas rápidas ──────────────────────────────────────────────
  const stats = useMemo(() => {
    return {
      total: employees.length,
      conArea: employees.filter(e => areas.some(a => a.area_employees?.some(ae => ae.employee_id === e.id))).length,
      sinArea: employees.filter(e => !areas.some(a => a.area_employees?.some(ae => ae.employee_id === e.id))).length,
      indefinidos: employees.filter(e => e.tipo_contrato === 'INDEFINIDO').length,
      porHoras: employees.filter(e => e.tipo_contrato === 'POR_HORAS').length,
      temporales: employees.filter(e => ['TERMINO_FIJO', 'OBRA_LABOR', 'TEMPORAL', 'APRENDIZAJE'].includes(e.tipo_contrato)).length,
    };
  }, [employees, areas]);

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">👥 Gestión de Personal</h1>
          <p className="page-subtitle">
            Colaboradores, áreas, contratos y seguridad social · CST Colombia 2026
          </p>
        </div>
        <div className="page-header__actions">
          <button
            id="btn-bulk-import-employees"
            className="cw-btn cw-btn--secondary"
            onClick={() => setShowBulkModal(true)}
            title="Importar empleados desde Excel/CSV"
          >
            <MdUpload /> Importar Excel
          </button>
          <button
            id="btn-new-employee"
            className="cw-btn cw-btn--primary"
            onClick={handleNew}
          >
            <MdAdd /> Nuevo Colaborador
          </button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      {employees.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <StatCard label="Total" value={stats.total} color="#6366f1" />
          <StatCard label="Con área" value={stats.conArea} color="#10b981" />
          {stats.sinArea > 0 && <StatCard label="Sin área" value={stats.sinArea} color="#f59e0b" />}
          <StatCard label="Indefinidos" value={stats.indefinidos} color="#3b82f6" />
          <StatCard label="Por horas" value={stats.porHoras} color="#8b5cf6" />
          {stats.temporales > 0 && <StatCard label="Temporales/Fijos" value={stats.temporales} color="#ec4899" />}
        </div>
      )}

      {/* Filtros */}
      <div className="cw-card mb-3">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <MdSearch style={{
              position: 'absolute', left: '0.875rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.2rem',
            }} />
            <input
              type="text"
              className="cw-input"
              placeholder="Buscar por nombre, cédula o cargo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>
          <select className="cw-input" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
            <option value="all">🏢 Todas las áreas</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>● {a.nombre}</option>
            ))}
          </select>
          <select className="cw-input" value={filterContrato} onChange={e => setFilterContrato(e.target.value)}>
            <option value="all">📋 Todos los contratos</option>
            <option value="INDEFINIDO">♾️ Indefinido</option>
            <option value="TERMINO_FIJO">📅 Término fijo</option>
            <option value="OBRA_LABOR">🔨 Obra o labor</option>
            <option value="POR_HORAS">⏰ Por horas</option>
            <option value="SALARIO_FIJO">💵 Salario fijo</option>
            <option value="PRESTACION_SERVICIOS">🤝 Prestación servicios</option>
            <option value="APRENDIZAJE">🎓 Aprendiz SENA</option>
            <option value="OCASIONAL">⚡ Ocasional</option>
            <option value="TEMPORAL">🔁 Temporal</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="cw-card">
        <div className="cw-card__header">
          <h3 className="cw-card__title">
            <MdPeople style={{ marginRight: '0.5rem' }} />
            Colaboradores registrados
          </h3>
          <span className="cw-badge cw-badge--blue">{filtered.length} de {employees.length}</span>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="cw-spinner"></div><span>Cargando...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            <div className="empty-state__title">
              {search || filterArea !== 'all' || filterContrato !== 'all' ? 'Sin resultados' : 'No hay empleados registrados'}
            </div>
            <div className="empty-state__desc">
              {search || filterArea !== 'all' || filterContrato !== 'all'
                ? 'Intente con otros filtros.'
                : 'Registra el primer colaborador de tu empresa. Solo necesitas cédula, nombre y área.'}
            </div>
            {!search && filterArea === 'all' && filterContrato === 'all' && (
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="cw-btn cw-btn--secondary" onClick={() => setShowBulkModal(true)}>
                  <MdUpload /> Importar desde Excel
                </button>
                <button className="cw-btn cw-btn--primary" onClick={handleNew}>
                  <MdAdd /> Registrar primer colaborador
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="cw-table-wrapper">
            <table className="cw-table">
              <thead>
                <tr>
                  <th>Cédula</th>
                  <th>Nombre Completo</th>
                  <th>Cargo</th>
                  <th>Área</th>
                  <th>Tipo Contrato</th>
                  <th>Valor / Hora</th>
                  <th>Ingreso</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  const empArea = getEmployeeArea(emp.id);
                  const esEspecial = empArea && parseFloat(empArea.valor_hora_default) !== parseFloat(emp.valor_hora);
                  const contrato = getContratoLabel(emp.tipo_contrato);
                  return (
                    <tr key={emp.id}>
                      <td>
                        <code className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {emp.tipo_documento && emp.tipo_documento !== 'CC' ? emp.tipo_documento + ' ' : ''}
                          {emp.cedula}
                        </code>
                      </td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{emp.nombre}</td>
                      <td>{emp.cargo}</td>
                      <td>
                        {empArea ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: empArea.color, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{empArea.nombre}</span>
                          </div>
                        ) : (
                          <span className="cw-badge cw-badge--gray">Sin área</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {contrato.icono} {contrato.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{
                            fontWeight: 600, color: 'var(--cw-success)',
                            fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
                          }}>
                            {formatCOP(emp.valor_hora)}
                          </span>
                          {esEspecial && (
                            <span title="Salario personalizado" style={{
                              fontSize: '0.68rem', color: '#fcd34d',
                              background: 'rgba(245,158,11,0.12)', padding: '0.1rem 0.4rem',
                              borderRadius: 100, border: '1px solid rgba(245,158,11,0.25)',
                            }}>
                              ★ Especial
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {emp.fecha_ingreso ? formatFechaCorta(emp.fecha_ingreso) : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="cw-badge cw-badge--green">● Activo</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button className="cw-btn cw-btn--secondary cw-btn--sm cw-btn--icon"
                            onClick={() => handleEdit(emp)} title="Editar">
                            <MdEdit />
                          </button>
                          <button className="cw-btn cw-btn--danger cw-btn--sm cw-btn--icon"
                            onClick={() => setDeleteConfirm(emp)} title="Eliminar">
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

      {/* Employee Modal con el NUEVO wizard */}
      {showModal && (
        <EmployeeForm
          employee={selectedEmployee}
          areas={areas}
          onClose={async (refresh) => {
            setShowModal(false);
            setSelectedEmployee(null);
            if (refresh) await fetchEmployees();
          }}
          onSave={handleSave}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <BulkImportModal
          areas={areas}
          onClose={async (refresh) => {
            setShowBulkModal(false);
            if (refresh) await fetchEmployees();
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="cw-modal-overlay">
          <div className="cw-modal animate-slide-up" style={{ maxWidth: 400 }}>
            <div className="cw-modal__header">
              <h3 className="cw-modal__title">⚠️ Confirmar eliminación</h3>
              <button className="cw-modal__close" onClick={() => setDeleteConfirm(null)}><MdClose /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '0 0.25rem' }}>
              ¿Está seguro que desea eliminar al colaborador{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{deleteConfirm.nombre}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="cw-modal__footer">
              <button className="cw-btn cw-btn--secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className="cw-btn cw-btn--danger" onClick={() => handleDelete(deleteConfirm.id)}>
                <MdDelete /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── StatCard auxiliar ───────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--bg-glass)', border: `1px solid ${color}30`,
      borderRadius: 10, padding: '0.4rem 0.75rem', minWidth: 110,
      display: 'flex', flexDirection: 'column',
    }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getContratoLabel(value) {
  const map = {
    INDEFINIDO: { icono: '♾️', label: 'Indefinido' },
    TERMINO_FIJO: { icono: '📅', label: 'Término fijo' },
    OBRA_LABOR: { icono: '🔨', label: 'Obra/Labor' },
    POR_HORAS: { icono: '⏰', label: 'Por horas' },
    SALARIO_FIJO: { icono: '💵', label: 'Salario fijo' },
    PRESTACION_SERVICIOS: { icono: '🤝', label: 'Prestación' },
    APRENDIZAJE: { icono: '🎓', label: 'Aprendiz' },
    OCASIONAL: { icono: '⚡', label: 'Ocasional' },
    TEMPORAL: { icono: '🔁', label: 'Temporal' },
  };
  return map[value] || { icono: '📄', label: value };
}

function formatFechaCorta(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
