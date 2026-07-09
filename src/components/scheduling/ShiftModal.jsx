import { useState, useEffect } from 'react';
import { MdClose, MdDelete } from 'react-icons/md';
import { format } from 'date-fns';
import { supabase } from '../../config/supabaseClient';
import { getLocalISOString } from '../../core/dateUtils';
import { formatCOP } from '../../core/validators';
import { buildDescansos } from '../../core/generateAutomaticShifts';
import { logger } from '../../config/logger';

export default function ShiftModal({ employee, fecha, areaId, areaTemplates, breakPolicy, onClose, onSave, onDelete, existingShift }) {
  const [selected, setSelected] = useState(existingShift?.template_id || null);
  const [loading, setLoading] = useState(false);
  const [extraTemplates, setExtraTemplates] = useState([]);

  useEffect(() => {
    if (!areaId && areaTemplates.length === 0) {
      supabase.from('shift_templates').select('*').is('area_id', null).then(({ data }) => {
        setExtraTemplates(data || []);
      });
    }
  }, [areaId, areaTemplates]);

  const allTemplates = areaTemplates.length > 0 ? areaTemplates : extraTemplates;

  useEffect(() => {
    if (existingShift && !selected) {
      if (existingShift.template_id) {
        setSelected(existingShift.template_id);
      } else {
        const startHour = existingShift.start_time?.slice(11, 16);
        const match = allTemplates.find(t => t.hora_inicio.slice(0, 5) === startHour);
        if (match) setSelected(match.id);
      }
    }
  }, [existingShift, allTemplates, selected]);

  const handleSave = async () => {
    const tpl = allTemplates.find(t => t.id === selected);
    if (!tpl) return;
    setLoading(true);
    try {
      const dateStr = format(fecha, 'yyyy-MM-dd');
      let startISO = getLocalISOString(dateStr, tpl.hora_inicio);
      let endISO;
      if (tpl.cruza_medianoche) {
        const nextDay = new Date(fecha);
        nextDay.setDate(nextDay.getDate() + 1);
        endISO = getLocalISOString(format(nextDay, 'yyyy-MM-dd'), tpl.hora_fin);
      } else {
        endISO = getLocalISOString(dateStr, tpl.hora_fin);
      }
      const confirmed = window.confirm('¿Estás seguro de que deseas asignar/modificar este turno?');
      if (!confirmed) { setLoading(false); return; }

      const grossMin = (new Date(endISO) - new Date(startISO)) / 60000;
      const startHHMM = tpl.hora_inicio.slice(0, 5);
      const tplAlmuerzo = (tpl.break_minutos != null && tpl.break_minutos > 0) ? tpl.break_minutos : null;
      const res = buildDescansos(startHHMM, grossMin, breakPolicy, { soloBreaks: tplAlmuerzo != null });
      const descansos = [...res.descansos];
      let almuerzo = res.almuerzoMin;
      if (tplAlmuerzo != null) {
        descansos.unshift({ tipo: 'ALMUERZO', inicio: null, minutos: tplAlmuerzo });
        almuerzo = tplAlmuerzo;
      }

      await onSave({
        employee_id: employee.id,
        start_time: startISO,
        end_time: endISO,
        shift_type: 'custom',
        periodo: dateStr.slice(0, 7),
        template_id: tpl.id,
        break_minutes: almuerzo,
        almuerzo_minutos: almuerzo,
        breaks_15_count: res.breaksCount,
        descansos,
      });
      onClose();
    } catch (err) {
      logger.error('ShiftModal', err);
    } finally {
      setLoading(false);
    }
  };

  const calcHoras = (tpl) => {
    if (!tpl) return null;
    const [h1, m1] = tpl.hora_inicio.split(':').map(Number);
    const [h2, m2] = tpl.hora_fin.split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins <= 0) mins += 24 * 60;
    return (mins / 60).toFixed(1);
  };

  const selectedTpl = allTemplates.find(t => t.id === selected);

  return (
    <div className="cw-modal-overlay">
      <div className="cw-modal animate-slide-up" style={{ maxWidth: 440 }}>
        <div className="cw-modal__header">
          <h3 className="cw-modal__title">📅 Asignar Turno</h3>
          <button className="cw-modal__close" onClick={onClose}><MdClose /></button>
        </div>
        <div style={{ marginBottom: '1.25rem', padding: '0.875rem', background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{employee.nombre}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
            📅 {format(fecha, 'dd/MM/yyyy')} &nbsp;·&nbsp; {employee.cargo}
          </div>
        </div>
        <div className="cw-form-group">
          <label className="cw-label">Franja Horaria <span className="required">*</span></label>
          {allTemplates.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '1rem', background: 'var(--bg-glass)', borderRadius: 8, textAlign: 'center' }}>
              ℹ️ No hay franjas configuradas para esta área.<br />
              <a href="/areas" style={{ color: 'var(--cw-accent)' }}>Configúralas en Áreas →</a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {allTemplates.map(t => {
                const horas = calcHoras(t);
                const isSelected = selected === t.id;
                return (
                  <button key={t.id} type="button" onClick={() => setSelected(t.id)}
                    style={{
                      padding: '0.875rem 1rem', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${isSelected ? t.color : 'var(--border-subtle)'}`,
                      background: isSelected ? t.color + '18' : 'var(--bg-glass)',
                      color: 'var(--text-primary)', transition: 'all 0.15s',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: t.color + '30', border: `1.5px solid ${t.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: t.color }}>
                        {t.hora_inicio.slice(0, 5)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {t.hora_inicio.slice(0, 5)} — {t.hora_fin.slice(0, 5)}
                          {t.cruza_medianoche && <span style={{ color: '#fbbf24', marginLeft: 4 }}> ☾ +1 día</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? t.color : 'var(--text-muted)' }}>{horas}h</div>
                      {isSelected && <div style={{ fontSize: '0.7rem', color: t.color }}>✓ seleccionado</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {selectedTpl && (
          <div style={{ marginBottom: '1rem', padding: '0.625rem 0.875rem', background: selectedTpl.color + '12', border: `1px solid ${selectedTpl.color}40`, borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            ⏱ Duración: <strong style={{ color: 'var(--text-primary)' }}>{calcHoras(selectedTpl)} horas</strong>
            {' · '}Valor estimado: <strong style={{ color: 'var(--cw-success)', fontFamily: 'var(--font-mono)' }}>
              {formatCOP((parseFloat(calcHoras(selectedTpl)) || 0) * (employee.valor_hora || 0))}
            </strong>
          </div>
        )}
        <div className="cw-modal__footer">
          {existingShift && (
            <button className="cw-btn cw-btn--danger cw-btn--sm"
              onClick={() => { if (window.confirm('¿Estás seguro de que deseas eliminar este turno?')) { onDelete(existingShift.id); onClose(); } }}>
              <MdDelete /> Quitar turno
            </button>
          )}
          <button className="cw-btn cw-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="cw-btn cw-btn--primary" onClick={handleSave} disabled={!selected || loading}>
            {loading ? <><span className="cw-spinner cw-spinner--sm"></span> Guardando...</> : '✅ Asignar'}
          </button>
        </div>
      </div>
    </div>
  );
}
