import { useState, useEffect } from 'react';
import { useEmployees } from '../hooks/useEmployees';
import { useAreas } from '../hooks/useAreas';
import { supabase } from '../config/supabaseClient';
import { validarCedula, validarValorHora, formatCOP } from '../core/validators';
import {
  MdAdd, MdEdit, MdDelete, MdClose, MdPeople, MdSearch,
  MdStar, MdDomain, MdInfo,
} from 'react-icons/md';

// ─── Modal crear/editar Empleado ─────────────────────────────────────────────
function EmployeeModal({ employee, areas, onClose, onSave }) {
  const isEdit = !!employee;

  // Determinar si el empleado existente es especial
  const detectaEspecial = () => {
    if (!isEdit) return false;
    return !!employee.es_especial;
  };

  const [form, setForm] = useState({
    cedula: employee?.cedula || '',
    nombre: employee?.nombre || '',
    cargo: employee?.cargo || '',
    valor_hora: employee?.valor_hora?.toString() || '',
    tipo_contrato: employee?.tipo_contrato || 'POR_HORAS',
    dias_descanso_semana: employee?.dias_descanso_semana || 1,
    turno_predeterminado_id: employee?.turno_predeterminado_id || '',
  });
  const [selectedAreaId, setSelectedAreaId] = useState(() => {
    if (!isEdit) return '';
    const areaEmp = areas.find(a =>
      a.area_employees?.some(ae => ae.employee_id === employee.id)
    );
    return areaEmp?.id || '';
  });
  const [initialAreaId] = useState(selectedAreaId);
  const [esEspecial, setEsEspecial] = useState(detectaEspecial);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Auto-llenar campos al seleccionar área (si no es especial)
  useEffect(() => {
    if (!selectedAreaId) return;
    const area = areas.find(a => a.id === selectedAreaId);
    if (!area) return;

    // Si estamos editando y el área seleccionada es la inicial, NO sobrescribir los valores propios del empleado
    const isInitialAreaInEdit = isEdit && selectedAreaId === initialAreaId;

    setForm(prev => {
      const updates = {};

      // Salario: solo si no es especial y no es el área inicial al editar
      if (!esEspecial && !isInitialAreaInEdit && area.valor_hora_default) {
        updates.valor_hora = area.valor_hora_default.toString();
      }

      // Tipo de contrato y días de descanso: solo si no es el área inicial al editar
      if (!isInitialAreaInEdit) {
        if (area.tipo_contrato_default) {
          updates.tipo_contrato = area.tipo_contrato_default;
          // Si el tipo de contrato cambia, limpiar turno predeterminado
          if (area.tipo_contrato_default !== prev.tipo_contrato) {
            updates.turno_predeterminado_id = '';
          }
        }
        if (area.dias_descanso_default !== undefined && area.dias_descanso_default !== null) {
          updates.dias_descanso_semana = area.dias_descanso_default;
        }
      }

      return { ...prev, ...updates };
    });

    if (!isInitialAreaInEdit) {
      setErrors(prev => ({ ...prev, valor_hora: '' }));
    }
  }, [selectedAreaId, esEspecial, areas, isEdit, initialAreaId]);

  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    async function loadTemplates() {
      if (!selectedAreaId) {
        setTemplates([]);
        return;
      }
      const { data } = await supabase
        .from('shift_templates')
        .select('*')
        .eq('area_id', selectedAreaId)
        .eq('activo', true);
      setTemplates(data || []);
    }
    loadTemplates();
  }, [selectedAreaId]);

  // Al marcar especial, limpiar el salario para que lo ingrese manualmente
  const handleToggleEspecial = (checked) => {
    setEsEspecial(checked);
    if (checked) {
      setForm(prev => ({ ...prev, valor_hora: '' }));
    } else if (selectedAreaId) {
      const area = areas.find(a => a.id === selectedAreaId);
      if (area) {
        const isInitialAreaInEdit = isEdit && selectedAreaId === initialAreaId;
        const targetValorHora = isInitialAreaInEdit
          ? (employee?.valor_hora?.toString() || '')
          : (area.valor_hora_default ? area.valor_hora_default.toString() : '');

        setForm(prev => ({
          ...prev,
          valor_hora: targetValorHora,
          ...(!isInitialAreaInEdit ? {
            ...(area.tipo_contrato_default ? { tipo_contrato: area.tipo_contrato_default } : {}),
            ...(area.dias_descanso_default != null ? { dias_descanso_semana: area.dias_descanso_default } : {}),
          } : {})
        }));
      }
    }
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    const cedV = validarCedula(form.cedula);
    if (!cedV.valid) newErrors.cedula = cedV.message;
    if (!form.nombre.trim()) newErrors.nombre = 'El nombre es obligatorio.';
    if (!form.cargo.trim()) newErrors.cargo = 'El cargo es obligatorio.';
    if (!selectedAreaId) newErrors.area = 'Seleccione un área de trabajo.';
    const horaV = validarValorHora(form.valor_hora);
    if (!horaV.valid) newErrors.valor_hora = horaV.message;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const dataToSave = { ...form, valor_hora: parseFloat(form.valor_hora) };
      if (dataToSave.tipo_contrato !== 'SALARIO_FIJO' || !dataToSave.turno_predeterminado_id) {
        dataToSave.turno_predeterminado_id = null;
      }

      await onSave({
        employeeData: dataToSave,
        areaId: selectedAreaId,
        esEspecial,
      });
      onClose();
    } catch (err) {
      setErrors({ api: err.message });
    } finally {
      setLoading(false);
    }
  };

  const selectedArea = areas.find(a => a.id === selectedAreaId);

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 520 }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">
            {isEdit ? '✏️ Editar Colaborador' : '👤 Registrar Nuevo Colaborador'}
          </h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        {errors.api && <div className="cw-alert cw-alert--error">🚫 {errors.api}</div>}

        <form onSubmit={handleSubmit} id="employee-form">
          {/* Cédula */}
          <div className="cw-form-group">
            <label className="cw-label" htmlFor="cedula">
              Cédula de Identidad <span className="required">*</span>
            </label>
            <input id="cedula" name="cedula" type="text"
              className={`cw-input${errors.cedula ? ' error' : ''}`}
              placeholder="1234567890"
              value={form.cedula} onChange={handleChange}
              disabled={isEdit}
            />
            {errors.cedula && <span className="cw-input-error">⚠ {errors.cedula}</span>}
          </div>

          {/* Nombre */}
          <div className="cw-form-group">
            <label className="cw-label" htmlFor="nombre">
              Nombre Completo <span className="required">*</span>
            </label>
            <input id="nombre" name="nombre" type="text"
              className={`cw-input${errors.nombre ? ' error' : ''}`}
              placeholder="Juan Carlos Pérez Gómez"
              value={form.nombre} onChange={handleChange}
            />
            {errors.nombre && <span className="cw-input-error">⚠ {errors.nombre}</span>}
          </div>

          {/* Cargo */}
          <div className="cw-form-group">
            <label className="cw-label" htmlFor="cargo">
              Cargo Operativo <span className="required">*</span>
            </label>
            <input id="cargo" name="cargo" type="text"
              className={`cw-input${errors.cargo ? ' error' : ''}`}
              placeholder="Operario de Producción"
              value={form.cargo} onChange={handleChange}
            />
            {errors.cargo && <span className="cw-input-error">⚠ {errors.cargo}</span>}
          </div>

          {/* Área de trabajo */}
          <div className="cw-form-group">
            <label className="cw-label" htmlFor="area-select">
              <MdDomain style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Área de Trabajo <span className="required">*</span>
            </label>
            {areas.length === 0 ? (
              <div style={{
                padding: '0.75rem', background: 'var(--bg-glass)', borderRadius: 8,
                fontSize: '0.82rem', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)',
              }}>
                ℹ️ No hay áreas creadas.{' '}
                <a href="/areas" style={{ color: 'var(--cw-accent)' }}>Créalas primero en Áreas y Turnos →</a>
              </div>
            ) : (
              <select
                id="area-select"
                className={`cw-input${errors.area ? ' error' : ''}`}
                value={selectedAreaId}
                onChange={e => { setSelectedAreaId(e.target.value); setErrors(p => ({ ...p, area: '' })); }}
              >
                <option value="">— Seleccionar área —</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                    {a.valor_hora_default ? ` · ${formatCOP(a.valor_hora_default)}/h` : ''}
                  </option>
                ))}
              </select>
            )}
            {errors.area && <span className="cw-input-error">⚠ {errors.area}</span>}

            {/* Selector de Contrato y Descansos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div className="cw-form-group" style={{ marginBottom: 0 }}>
                <label className="cw-label">Tipo de Contrato</label>
                <select
                  className="cw-input"
                  value={form.tipo_contrato}
                  onChange={e => {
                    setForm(p => ({ ...p, tipo_contrato: e.target.value }));
                  }}
                >
                  <option value="POR_HORAS">Por Horas (Dom a Dom)</option>
                  <option value="SALARIO_FIJO">Salario Fijo</option>
                </select>
              </div>
              <div className="cw-form-group" style={{ marginBottom: 0 }}>
                <label className="cw-label">Días de Descanso</label>
                <select
                  className="cw-input"
                  value={form.dias_descanso_semana}
                  onChange={e => setForm(p => ({ ...p, dias_descanso_semana: parseInt(e.target.value) }))}
                >
                  <option value={1}>1 Día</option>
                  <option value={2}>2 Días</option>
                </select>
              </div>
            </div>

            {form.tipo_contrato === 'SALARIO_FIJO' && (
              <div className="cw-form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
                <label className="cw-label">Turno Predeterminado</label>
                <select
                  className="cw-input"
                  value={form.turno_predeterminado_id || ''}
                  onChange={e => setForm(p => ({ ...p, turno_predeterminado_id: e.target.value || null }))}
                >
                  <option value="">— Ninguno —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre} ({t.hora_inicio.slice(0,5)} - {t.hora_fin.slice(0,5)})</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Solo aplicable si el área tiene franjas horarias configuradas.
                </div>
              </div>
            )}

            {/* Info del área seleccionada */}
            {selectedArea && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginTop: '0.4rem', padding: '0.5rem 0.75rem',
                background: selectedArea.color + '15',
                border: `1px solid ${selectedArea.color}40`,
                borderRadius: 8, fontSize: '0.78rem',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedArea.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)' }}>
                  {selectedArea.nombre} · {selectedArea.area_employees?.length || 0} colaboradores ·{' '}
                  Salario:{' '}
                  <strong style={{ color: 'var(--cw-success)' }}>
                    {selectedArea.valor_hora_default ? formatCOP(selectedArea.valor_hora_default) + '/h' : 'No definido'}
                  </strong>
                  {selectedArea.tipo_contrato_default && (
                    <> · Contrato: <strong style={{ color: 'var(--text-primary)' }}>
                      {selectedArea.tipo_contrato_default === 'SALARIO_FIJO' ? 'Salario Fijo' : 'Por Horas'}
                    </strong></>
                  )}
                  {selectedArea.dias_descanso_default != null && (
                    <> · Descanso: <strong style={{ color: 'var(--text-primary)' }}>
                      {selectedArea.dias_descanso_default} día{selectedArea.dias_descanso_default !== 1 ? 's' : ''}
                    </strong></>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Toggle empleado especial */}
          <div className="cw-form-group">
            <label style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem', borderRadius: 10, cursor: 'pointer',
              background: esEspecial ? 'rgba(245,158,11,0.08)' : 'var(--bg-glass)',
              border: `1px solid ${esEspecial ? 'rgba(245,158,11,0.35)' : 'var(--border-subtle)'}`,
              transition: 'all 0.2s',
            }}>
              <input
                type="checkbox"
                checked={esEspecial}
                onChange={e => handleToggleEspecial(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#f59e0b', cursor: 'pointer' }}
              />
              <div>
                <div style={{
                  fontWeight: 700, fontSize: '0.85rem',
                  color: esEspecial ? '#fcd34d' : 'var(--text-primary)',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                }}>
                  <MdStar style={{ color: '#f59e0b' }} />
                  Empleado Especial — Salario personalizado
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  El salario NO se tomará del área; se define manualmente
                </div>
              </div>
            </label>
          </div>

          {/* Valor hora */}
          <div className="cw-form-group">
            <label className="cw-label" htmlFor="valor_hora">
              Valor Hora Ordinaria (COP) <span className="required">*</span>
              {!esEspecial && selectedAreaId && (
                <span style={{
                  marginLeft: '0.5rem', fontSize: '0.72rem', color: '#fbbf24',
                  background: 'rgba(245,158,11,0.12)', padding: '0.1rem 0.45rem',
                  borderRadius: 100, border: '1px solid rgba(245,158,11,0.25)',
                }}>
                  <MdInfo style={{ verticalAlign: 'middle', fontSize: '0.85rem' }} /> Auto desde el área
                </span>
              )}
            </label>
            <input
              id="valor_hora" name="valor_hora" type="text"
              inputMode="numeric"
              className={`cw-input${errors.valor_hora ? ' error' : ''}`}
              placeholder={
                !esEspecial && selectedArea?.valor_hora_default
                  ? `${selectedArea.valor_hora_default} (del área)`
                  : 'Ej: 12500'
              }
              value={form.valor_hora}
              readOnly={!esEspecial && !!selectedAreaId && !!selectedArea?.valor_hora_default}
              style={{
                opacity: (!esEspecial && !!selectedAreaId && !!selectedArea?.valor_hora_default) ? 0.7 : 1,
                cursor: (!esEspecial && !!selectedAreaId && !!selectedArea?.valor_hora_default) ? 'not-allowed' : 'text',
              }}
              onChange={(e) => {
                if (!esEspecial && selectedAreaId) return; // bloqueado si viene del área
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setForm(prev => ({ ...prev, valor_hora: val }));
                setErrors(prev => ({ ...prev, valor_hora: '' }));
              }}
            />
            {form.valor_hora && !errors.valor_hora && (
              <span style={{ fontSize: '0.78rem', color: 'var(--cw-success)' }}>
                = {formatCOP(parseFloat(form.valor_hora) || 0)} / hora
                {esEspecial && <span style={{ color: '#fcd34d', marginLeft: 6 }}>★ Personalizado</span>}
              </span>
            )}
            {errors.valor_hora && <span className="cw-input-error">⚠ {errors.valor_hora}</span>}
          </div>

          <div className="cw-modal__footer">
            <button type="button" className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
            <button id="btn-save-employee" type="submit" className="cw-btn cw-btn--primary" disabled={loading}>
              {loading
                ? <><span className="cw-spinner cw-spinner--sm"></span> Guardando...</>
                : (isEdit ? '💾 Actualizar' : '➕ Registrar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { employees, loading, error, createEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const { areas, assignEmployee } = useAreas();
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filtered = employees.filter(e =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    e.cedula.includes(search) ||
    e.cargo.toLowerCase().includes(search.toLowerCase())
  );

  // Buscar área de un empleado
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

  const handleSave = async ({ employeeData, areaId, esEspecial }) => {
    let savedEmp;
    const dataToSave = { ...employeeData, es_especial: esEspecial };
    if (selectedEmployee) {
      savedEmp = await updateEmployee(selectedEmployee.id, dataToSave);
    } else {
      savedEmp = await createEmployee(dataToSave);
    }
    // Asignar área si se seleccionó una
    if (areaId && savedEmp?.id) {
      await assignEmployee(areaId, savedEmp.id);
    }
  };

  const handleDelete = async (id) => {
    await deleteEmployee(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">👥 Gestión de Personal</h1>
          <p className="page-subtitle">Administre colaboradores, áreas y valores hora</p>
        </div>
        <div className="page-header__actions">
          <button id="btn-new-employee" className="cw-btn cw-btn--primary" onClick={handleNew}>
            <MdAdd /> Nuevo Colaborador
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="cw-card mb-3">
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
      </div>

      {/* Table */}
      <div className="cw-card">
        <div className="cw-card__header">
          <h3 className="cw-card__title">
            <MdPeople style={{ marginRight: '0.5rem' }} />
            Colaboradores registrados
          </h3>
          <span className="cw-badge cw-badge--blue">{filtered.length} empleados</span>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="cw-spinner"></div><span>Cargando...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">👥</div>
            <div className="empty-state__title">
              {search ? 'Sin resultados' : 'No hay empleados registrados'}
            </div>
            <div className="empty-state__desc">
              {search ? 'Intente con otro término de búsqueda.' : 'Registre el primer colaborador de su empresa.'}
            </div>
            {!search && (
              <button className="cw-btn cw-btn--primary" onClick={handleNew}>
                <MdAdd /> Registrar primer colaborador
              </button>
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
                  <th>Valor / Hora</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  const empArea = getEmployeeArea(emp.id);
                  const esEspecial = empArea && empArea.valor_hora_default !== emp.valor_hora;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <code className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
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

      {/* Employee Modal */}
      {showModal && (
        <EmployeeModal
          employee={selectedEmployee}
          areas={areas}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
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
