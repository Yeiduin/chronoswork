import { useState } from 'react';
import { useAbsences } from '../hooks/useAbsences';
import { useEmployees } from '../hooks/useEmployees';
import { formatFecha } from '../core/dateUtils';
import { validarRangoFechas } from '../core/validators';
import { TIPOS_NOVEDAD } from '../config/constants';
import { MdAdd, MdClose, MdDelete, MdEventBusy, MdSearch } from 'react-icons/md';

function AbsenceModal({ onClose, onSave, employees }) {
  const [form, setForm] = useState({
    employee_id: '',
    tipo: 'vacaciones',
    fecha_inicio: '',
    fecha_fin: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.employee_id) newErrors.employee_id = 'Seleccione un colaborador.';
    if (!form.fecha_inicio) newErrors.fecha_inicio = 'La fecha de inicio es obligatoria.';
    if (!form.fecha_fin) newErrors.fecha_fin = 'La fecha de fin es obligatoria.';
    if (form.fecha_inicio && form.fecha_fin) {
      const rangoV = validarRangoFechas(form.fecha_inicio, form.fecha_fin);
      if (!rangoV.valid) newErrors.fecha_fin = rangoV.message;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setErrors({ api: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up">
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">📋 Registrar Novedad Laboral</h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>

        {errors.api && <div className="cw-alert cw-alert--error">🚫 {errors.api}</div>}

        <form onSubmit={handleSubmit} id="absence-form">
          <div className="cw-form-group">
            <label className="cw-label" htmlFor="employee_id">Colaborador <span className="required">*</span></label>
            <select id="employee_id" name="employee_id"
              className={`cw-select${errors.employee_id ? ' error' : ''}`}
              value={form.employee_id} onChange={handleChange}
            >
              <option value="">Seleccione un colaborador...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.nombre} — {e.cargo}</option>
              ))}
            </select>
            {errors.employee_id && <span className="cw-input-error">⚠ {errors.employee_id}</span>}
          </div>

          <div className="cw-form-group">
            <label className="cw-label" htmlFor="tipo">Tipo de Novedad <span className="required">*</span></label>
            <select id="tipo" name="tipo"
              className="cw-select"
              value={form.tipo} onChange={handleChange}
            >
              {TIPOS_NOVEDAD.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="cw-grid cw-grid--2">
            <div className="cw-form-group">
              <label className="cw-label" htmlFor="fecha_inicio">Fecha Inicio <span className="required">*</span></label>
              <input id="fecha_inicio" name="fecha_inicio" type="date"
                className={`cw-input${errors.fecha_inicio ? ' error' : ''}`}
                value={form.fecha_inicio} onChange={handleChange}
              />
              {errors.fecha_inicio && <span className="cw-input-error">⚠ {errors.fecha_inicio}</span>}
            </div>

            <div className="cw-form-group">
              <label className="cw-label" htmlFor="fecha_fin">Fecha Fin <span className="required">*</span></label>
              <input id="fecha_fin" name="fecha_fin" type="date"
                className={`cw-input${errors.fecha_fin ? ' error' : ''}`}
                value={form.fecha_fin} onChange={handleChange}
                min={form.fecha_inicio}
              />
              {errors.fecha_fin && <span className="cw-input-error">⚠ {errors.fecha_fin}</span>}
            </div>
          </div>

          {form.tipo && (
            <div className="cw-alert cw-alert--warning" style={{ fontSize: '0.8rem' }}>
              ⚠️ Al registrar esta novedad, el sistema bloqueará automáticamente la asignación de
              turnos al colaborador durante el período indicado.
            </div>
          )}

          <div className="cw-modal__footer">
            <button type="button" className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
            <button id="btn-save-absence" type="submit" className="cw-btn cw-btn--primary" disabled={loading}>
              {loading ? <><span className="cw-spinner cw-spinner--sm"></span> Guardando...</> : '📋 Registrar Novedad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const NOVEDAD_COLORS = {
  vacaciones: { badge: 'cw-badge--green', label: '🌴 Vacaciones' },
  incapacidad: { badge: 'cw-badge--red', label: '🏥 Incapacidad' },
  licencia: { badge: 'cw-badge--yellow', label: '📄 Licencia' },
  suspension: { badge: 'cw-badge--gray', label: '⏸ Suspensión' },
};

export default function AbsencesPage() {
  const { absences, loading, createAbsence, deleteAbsence } = useAbsences();
  const { employees } = useEmployees();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const filtered = absences.filter(abs => {
    const term = search.toLowerCase();
    const nombre = (abs.employees?.nombre || '').toLowerCase();
    const cargo = (abs.employees?.cargo || '').toLowerCase();
    const tipo = (abs.tipo || '').toLowerCase();
    const inicio = abs.fecha_inicio || '';
    const fin = abs.fecha_fin || '';
    return nombre.includes(term) || cargo.includes(term) || tipo.includes(term) || inicio.includes(term) || fin.includes(term);
  });

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">📋 Gestión de Novedades</h1>
          <p className="page-subtitle">
            Registre vacaciones, incapacidades y licencias. El sistema bloqueará los turnos automáticamente.
          </p>
        </div>
        <div className="page-header__actions">
          <button id="btn-new-absence" className="cw-btn cw-btn--primary" onClick={() => setShowModal(true)}>
            <MdAdd /> Nueva Novedad
          </button>
        </div>
      </div>

      <div className="cw-card mb-3">
        <div style={{ position: 'relative' }}>
          <MdSearch style={{
            position: 'absolute', left: '0.875rem', top: '50%',
            transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '1.2rem',
          }} />
          <input
            type="text"
            className="cw-input"
            placeholder="Buscar por nombre, cargo, tipo o fecha (ej: 2026-06)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      <div className="cw-card">
        <div className="cw-card__header">
          <h3 className="cw-card__title"><MdEventBusy style={{ marginRight: '0.5rem' }} />Novedades Registradas</h3>
          <span className="cw-badge cw-badge--yellow">{absences.length} novedades</span>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="cw-spinner"></div><span>Cargando...</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__title">
              {search ? 'Sin resultados' : 'Sin novedades registradas'}
            </div>
            <div className="empty-state__desc">
              {search ? 'Intente con otro término de búsqueda.' : 'Todo el personal está disponible para ser asignado en turnos.'}
            </div>
            {!search && (
              <button className="cw-btn cw-btn--primary" onClick={() => setShowModal(true)}>
                <MdAdd /> Registrar novedad
              </button>
            )}
          </div>
        ) : (
          <div className="cw-table-wrapper">
            <table className="cw-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Tipo de Novedad</th>
                  <th>Fecha Inicio</th>
                  <th>Fecha Fin</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(abs => {
                  const isActive = today >= abs.fecha_inicio && today <= abs.fecha_fin;
                  const novedadInfo = NOVEDAD_COLORS[abs.tipo] || { badge: 'cw-badge--gray', label: abs.tipo };
                  return (
                    <tr key={abs.id}>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {abs.employees?.nombre || '—'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          CC: {abs.employees?.cedula} · {abs.employees?.cargo || 'Sin cargo'}
                        </div>
                        {abs.employees?.area_employees?.[0]?.areas?.nombre && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--cw-blue-500)', marginTop: '0.1rem' }}>
                            📍 Área: {abs.employees.area_employees[0].areas.nombre}
                          </div>
                        )}
                      </td>
                      <td><span className={`cw-badge ${novedadInfo.badge}`}>{novedadInfo.label}</span></td>
                      <td>{formatFecha(abs.fecha_inicio)}</td>
                      <td>{formatFecha(abs.fecha_fin)}</td>
                      <td>
                        {isActive
                          ? <span className="cw-badge cw-badge--red">● Activa</span>
                          : <span className="cw-badge cw-badge--gray">Finalizada</span>
                        }
                      </td>
                      <td>
                        <button
                          className="cw-btn cw-btn--danger cw-btn--sm cw-btn--icon"
                          onClick={() => deleteAbsence(abs.id)}
                          title="Eliminar novedad"
                        >
                          <MdDelete />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AbsenceModal
          onClose={() => setShowModal(false)}
          onSave={createAbsence}
          employees={employees}
        />
      )}
    </div>
  );
}
