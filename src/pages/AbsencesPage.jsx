import { useState } from 'react';
import { useDragScroll } from '../hooks/useDragScroll';
import { useAbsences } from '../hooks/useAbsences';
import { useEmployees } from '../hooks/useEmployees';
import { formatFecha, formatDuracionNovedad } from '../core/dateUtils';
import { validarRangoFechas } from '../core/validators';
import { TIPOS_NOVEDAD, ABSENCE_CFG } from '../config/constants';
import { MdAdd, MdClose, MdDelete, MdEventBusy, MdSearch, MdCheck } from 'react-icons/md';

function AbsenceModal({ onClose, onSave, employees }) {
  const [form, setForm] = useState({
    employee_id: '',
    tipo: 'vacaciones',
    por_horas: false,
    fecha_inicio: '',
    fecha_fin: '',
    hora_inicio: '',
    hora_fin: '',
    observaciones: '',
    estado: 'aprobada',
    aprobada: true
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    setForm(prev => ({ ...prev, [name]: val }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.employee_id) newErrors.employee_id = 'Seleccione un colaborador.';
    if (!form.fecha_inicio) newErrors.fecha_inicio = 'La fecha de inicio es obligatoria.';
    
    if (form.por_horas) {
      if (!form.hora_inicio) newErrors.hora_inicio = 'La hora de inicio es obligatoria.';
      if (!form.hora_fin) newErrors.hora_fin = 'La hora de fin es obligatoria.';
      if (form.hora_inicio && form.hora_fin && form.hora_inicio >= form.hora_fin) {
        newErrors.hora_fin = 'La hora de fin debe ser posterior a la de inicio.';
      }
    } else {
      if (!form.fecha_fin) newErrors.fecha_fin = 'La fecha de fin es obligatoria.';
      if (form.fecha_inicio && form.fecha_fin) {
        const rangoV = validarRangoFechas(form.fecha_inicio, form.fecha_fin);
        if (!rangoV.valid) newErrors.fecha_fin = rangoV.message;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const dataToSave = { ...form };
      if (dataToSave.por_horas) {
        dataToSave.fecha_fin = dataToSave.fecha_inicio;
      } else {
        dataToSave.hora_inicio = null;
        dataToSave.hora_fin = null;
      }
      await onSave(dataToSave);
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

          <div className="cw-form-group">
            <label className="cw-label">Modalidad de Novedad</label>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="por_horas" checked={!form.por_horas} onChange={() => setForm({...form, por_horas: false, hora_inicio: '', hora_fin: ''})} />
                Por días completos
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="radio" name="por_horas" checked={form.por_horas} onChange={() => setForm({...form, por_horas: true, fecha_fin: ''})} />
                Por horas
              </label>
            </div>
          </div>

          <div className="cw-grid cw-grid--2">
            <div className="cw-form-group" style={form.por_horas ? { gridColumn: '1 / -1' } : {}}>
              <label className="cw-label" htmlFor="fecha_inicio">{form.por_horas ? 'Fecha de la Novedad' : 'Fecha Inicio'} <span className="required">*</span></label>
              <input id="fecha_inicio" name="fecha_inicio" type="date"
                className={`cw-input${errors.fecha_inicio ? ' error' : ''}`}
                value={form.fecha_inicio} onChange={handleChange}
              />
              {errors.fecha_inicio && <span className="cw-input-error">⚠️ {errors.fecha_inicio}</span>}
            </div>

            {!form.por_horas ? (
              <div className="cw-form-group">
                <label className="cw-label" htmlFor="fecha_fin">Fecha Fin <span className="required">*</span></label>
                <input id="fecha_fin" name="fecha_fin" type="date"
                  className={`cw-input${errors.fecha_fin ? ' error' : ''}`}
                  value={form.fecha_fin} onChange={handleChange}
                  min={form.fecha_inicio}
                />
                {errors.fecha_fin && <span className="cw-input-error">⚠️ {errors.fecha_fin}</span>}
              </div>
            ) : (
              <>
                <div className="cw-form-group">
                  <label className="cw-label" htmlFor="hora_inicio">Hora Inicio <span className="required">*</span></label>
                  <input id="hora_inicio" name="hora_inicio" type="time"
                    className={`cw-input${errors.hora_inicio ? ' error' : ''}`}
                    value={form.hora_inicio} onChange={handleChange}
                  />
                  {errors.hora_inicio && <span className="cw-input-error">⚠️ {errors.hora_inicio}</span>}
                </div>
                <div className="cw-form-group">
                  <label className="cw-label" htmlFor="hora_fin">Hora Fin <span className="required">*</span></label>
                  <input id="hora_fin" name="hora_fin" type="time"
                    className={`cw-input${errors.hora_fin ? ' error' : ''}`}
                    value={form.hora_fin} onChange={handleChange}
                  />
                  {errors.hora_fin && <span className="cw-input-error">⚠️ {errors.hora_fin}</span>}
                </div>
              </>
            )}
          </div>

          <div className="cw-form-group">
            <label className="cw-label" htmlFor="observaciones">
              Observaciones / Motivo {form.tipo === 'otro' && <span style={{color: 'var(--cw-danger)'}}>* (Requerido)</span>}
            </label>
            <textarea id="observaciones" name="observaciones"
              className="cw-input" rows="3"
              value={form.observaciones} onChange={handleChange}
              placeholder={form.tipo === 'otro' ? 'Especifica el tipo de novedad detalladamente...' : 'Opcional. Breve detalle o motivo...'}
              required={form.tipo === 'otro'}
            ></textarea>
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

export default function AbsencesPage() {
  const { absences, loading, createAbsence, deleteAbsence, updateAbsenceStatus } = useAbsences();
  const { employees } = useEmployees();
  const { ref: tableRef, handlers, style: dragStyle } = useDragScroll();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('pendientes');

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

  const pendientes = filtered.filter(a => a.estado === 'pendiente');
  const historial = filtered.filter(a => (a.estado === 'aprobada' || a.aprobada === true) && a.estado !== 'pendiente');
  const displayed = activeTab === 'pendientes' ? pendientes : historial;

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
        <div className="cw-card__header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div className="emp-tabs" style={{ marginBottom: 0, justifyContent: 'flex-start', borderBottom: '1px solid var(--border-subtle)', width: '100%' }}>
            <button 
              className={`emp-tab ${activeTab === 'pendientes' ? 'emp-tab--active' : ''}`} 
              onClick={() => setActiveTab('pendientes')}
            >
              Solicitudes Pendientes <span className="cw-badge cw-badge--yellow" style={{marginLeft: '0.5rem'}}>{pendientes.length}</span>
            </button>
            <button 
              className={`emp-tab ${activeTab === 'historial' ? 'emp-tab--active' : ''}`} 
              onClick={() => setActiveTab('historial')}
            >
              Historial / Activas <span className="cw-badge cw-badge--gray" style={{marginLeft: '0.5rem'}}>{historial.length}</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="cw-spinner"></div><span>Cargando...</span></div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <div className="empty-state__title">
              {search ? 'Sin resultados' : (activeTab === 'pendientes' ? 'No hay solicitudes pendientes' : 'Sin novedades registradas')}
            </div>
            <div className="empty-state__desc">
              {search ? 'Intente con otro término de búsqueda.' : (activeTab === 'pendientes' ? 'Todas las solicitudes han sido gestionadas.' : 'Todo el personal está disponible para ser asignado en turnos.')}
            </div>
            {!search && activeTab === 'historial' && (
              <button className="cw-btn cw-btn--primary" onClick={() => setShowModal(true)}>
                <MdAdd /> Registrar novedad
              </button>
            )}
          </div>
        ) : (
          <div className="cw-table-wrapper" ref={tableRef} {...handlers} style={dragStyle}>
            <table className="cw-table cw-table--striped">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Tipo de Novedad</th>
                  <th>Fechas</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(abs => {
                  const isActive = today >= abs.fecha_inicio && today <= abs.fecha_fin && (abs.estado === 'aprobada' || abs.aprobada);
                  const novedadInfo = ABSENCE_CFG[abs.tipo] || { badge: 'cw-badge--gray', label: abs.tipo, icon: '📌' };
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
                        {abs.observaciones && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                            "{abs.observaciones}"
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`cw-badge ${novedadInfo.badge}`}>
                          {novedadInfo.icon} {novedadInfo.label}
                        </span>
                      </td>
                      <td>
                        {abs.por_horas ? (
                          <>
                            <div>{formatFecha(abs.fecha_inicio)}</div>
                            <div style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>
                              {abs.hora_inicio?.slice(0, 5)} a {abs.hora_fin?.slice(0, 5)}
                            </div>
                            <div style={{color: 'var(--cw-blue-500)', fontSize: '0.75rem', fontWeight: 500, marginTop: '0.2rem'}}>
                              {formatDuracionNovedad(abs)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>{formatFecha(abs.fecha_inicio)}</div>
                            <div style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>al {formatFecha(abs.fecha_fin)}</div>
                            <div style={{color: 'var(--cw-blue-500)', fontSize: '0.75rem', fontWeight: 500, marginTop: '0.2rem'}}>
                              {formatDuracionNovedad(abs)}
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        {abs.estado === 'pendiente' ? (
                          <span className="cw-badge cw-badge--yellow">⏳ Pendiente</span>
                        ) : abs.estado === 'rechazada' ? (
                          <span className="cw-badge cw-badge--red">❌ Rechazada</span>
                        ) : isActive ? (
                          <span className="cw-badge cw-badge--red">● Activa</span>
                        ) : (
                          <span className="cw-badge cw-badge--gray">Finalizada</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {abs.estado === 'pendiente' && (
                            <>
                              <button
                                className="cw-btn cw-btn--success cw-btn--sm cw-btn--icon"
                                onClick={() => updateAbsenceStatus(abs.id, 'aprobada')}
                                title="Aprobar novedad"
                              >
                                <MdCheck />
                              </button>
                              <button
                                className="cw-btn cw-btn--danger cw-btn--sm cw-btn--icon"
                                onClick={() => updateAbsenceStatus(abs.id, 'rechazada')}
                                title="Rechazar novedad"
                              >
                                <MdClose />
                              </button>
                            </>
                          )}
                          <button
                            className="cw-btn cw-btn--danger cw-btn--sm cw-btn--icon"
                            onClick={() => deleteAbsence(abs.id)}
                            title="Eliminar novedad"
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
