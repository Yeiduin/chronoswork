import { useState, useEffect } from 'react';
import { useDemandSlots } from '../hooks/useDemandSlots';
import { MdAdd, MdEdit, MdDelete, MdInfo, MdCheckCircle, MdWarning, MdClose } from 'react-icons/md';

const DIAS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
];

export function DemandCurveConfig({ area }) {
  const { demandSlots, loading, createDemandSlotGroup, updateDemandSlotGroup, deleteDemandSlotGroup } = useDemandSlots(area.id);
  const [selectedDay, setSelectedDay] = useState(1);
  const [form, setForm] = useState({ start_hour: 0, end_hour: 8, required_staff: 1 });
  const [applyDays, setApplyDays] = useState([1]);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [error, setError] = useState('');

  // Sincronizar el día a aplicar por defecto cuando cambian de pestaña
  useEffect(() => {
    setApplyDays([selectedDay]);
  }, [selectedDay]);

  const currentSlots = demandSlots.filter(s => s.day_of_week === selectedDay);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    
    const start = parseInt(form.start_hour);
    const end = parseInt(form.end_hour);
    const staff = parseInt(form.required_staff);

    if (start >= end) {
      setError('La hora de inicio debe ser menor a la hora de fin.');
      return;
    }
    if (staff < 0) {
      setError('El personal requerido no puede ser negativo.');
      return;
    }

    if (applyDays.length === 0) {
      setError('Debes seleccionar al menos un día para aplicar la franja.');
      return;
    }

    // Validar solapamiento en todos los días seleccionados, ignorando el grupo que estamos editando
    const overlapErrors = [];
    for (let d of applyDays) {
      const daySlots = demandSlots.filter(s => s.day_of_week === d && s.group_id !== editingGroupId);
      const overlap = daySlots.some(s => (start < s.end_hour && end > s.start_hour));
      if (overlap) {
        overlapErrors.push(DIAS.find(x => x.value === d).label);
      }
    }

    if (overlapErrors.length > 0) {
      setError(`Solapamiento detectado en los días: ${overlapErrors.join(', ')}. Por favor ajusta las horas.`);
      return;
    }

    try {
      if (editingGroupId) {
        await updateDemandSlotGroup(editingGroupId, applyDays, start, end, staff);
        setEditingGroupId(null);
      } else {
        await createDemandSlotGroup(applyDays, start, end, staff);
      }
      
      // Preparar el formulario para la siguiente franja automáticamente
      const nextEnd = Math.min(24, end + 8);
      setForm({ start_hour: end, end_hour: nextEnd, required_staff: 1 });
      setApplyDays([selectedDay]);
    } catch (err) {
      if (err.message.includes('unique constraint')) {
        setError('Ya existe una franja que empieza a la misma hora.');
      } else {
        setError(err.message);
      }
    }
  };

  const getMissingHoursInfo = () => {
     let missing = 0;
     let covered = 0;
     for (let i = 0; i < 24; i++) {
        if (currentSlots.some(s => i >= s.start_hour && i < s.end_hour)) covered++;
        else missing++;
     }
     return { covered, missing };
  };

  const { covered, missing } = getMissingHoursInfo();
  
  // Días que tienen alguna curva configurada
  const daysWithData = [...new Set(demandSlots.map(s => s.day_of_week))];

  const handleEditSlot = (slot) => {
     setError('');
     const groupSlots = demandSlots.filter(s => s.group_id === slot.group_id);
     setApplyDays(groupSlots.map(s => s.day_of_week));
     setForm({
        start_hour: slot.start_hour,
        end_hour: slot.end_hour,
        required_staff: slot.required_staff
     });
     setEditingGroupId(slot.group_id);
  };

  const handleDeleteSlot = async (slot) => {
     const groupCount = demandSlots.filter(s => s.group_id === slot.group_id).length;
     if (groupCount > 1) {
        if (!window.confirm(`Esta franja está asignada a ${groupCount} días. ¿Deseas eliminarla de TODOS los días?`)) {
           return;
        }
     }
     try {
        await deleteDemandSlotGroup(slot.group_id);
        if (editingGroupId === slot.group_id) {
           setEditingGroupId(null);
           setForm({ start_hour: 0, end_hour: 8, required_staff: 1 });
        }
     } catch (err) {
        setError(err.message);
     }
  };

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          CURVAS DE DEMANDA (WFM)
        </div>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
        Configura cuántas personas necesitas en cada hora del día. Si el sistema detecta que has configurado curvas para esta área, <strong>priorizará esta demanda sobre las estrategias tradicionales de asignación.</strong>
      </p>

      {/* Selector de Días */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {DIAS.map(d => {
          const isSelected = selectedDay === d.value;
          const hasData = daysWithData.includes(d.value);
          return (
            <button key={d.value} onClick={() => { setSelectedDay(d.value); setError(''); }} style={{
              padding: '0.5rem 1rem', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s',
              background: isSelected ? 'var(--cw-primary)' : (hasData ? 'var(--bg-glass)' : 'transparent'),
              border: isSelected ? '1px solid var(--cw-primary)' : (hasData ? '1px solid var(--border-subtle)' : '1px dashed var(--border-medium)'),
              color: isSelected ? '#fff' : (hasData ? 'var(--text-primary)' : 'var(--text-muted)'),
              fontWeight: isSelected ? 600 : 500,
              fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
              flexShrink: 0
            }}>
              {d.label}
              {hasData && !isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cw-primary)' }} />}
            </button>
          );
        })}
      </div>

      {/* Panel del Día Seleccionado */}
      <div style={{
        background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, padding: '1.25rem', position: 'relative'
      }}>
        <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Demanda para el {DIAS.find(d => d.value === selectedDay)?.label}
        </h4>

        {/* Resumen de Cobertura */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
           <div style={{ flex: 1, background: covered === 24 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: '0.75rem', borderRadius: 8, border: `1px solid ${covered === 24 ? '#34d399' : '#fcd34d'}`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ color: covered === 24 ? '#059669' : '#d97706', fontSize: '1.5rem' }}>
                 {covered === 24 ? <MdCheckCircle /> : <MdWarning />}
              </div>
              <div>
                 <div style={{ fontSize: '0.8rem', fontWeight: 700, color: covered === 24 ? '#059669' : '#b45309' }}>
                    {covered}h configuradas / {missing}h vacías
                 </div>
                 <div style={{ fontSize: '0.72rem', color: covered === 24 ? '#047857' : '#92400e', marginTop: '0.2rem' }}>
                    {missing > 0 ? 'Las horas vacías asumen que se necesita 1 persona por defecto.' : 'Has configurado la curva completa para este día.'}
                 </div>
              </div>
           </div>
        </div>

        {/* Lista de Franjas */}
        {loading ? (
           <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}><span className="cw-spinner"></span> Cargando...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {currentSlots.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', border: '1px dashed var(--border-medium)', borderRadius: 8 }}>
                No hay franjas de demanda creadas para este día.
              </div>
            ) : (
              currentSlots.map(slot => (
                <div key={slot.id} className="animate-fade-in" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: '0.75rem 1rem', transition: 'all 0.2s',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      background: 'var(--cw-primary)', color: '#fff', fontWeight: 800, fontSize: '1.1rem',
                      width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {slot.required_staff}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horario</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {String(slot.start_hour).padStart(2, '0')}:00 — {String(slot.end_hour).padStart(2, '0')}:00
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="cw-btn cw-btn--secondary cw-btn--sm cw-btn--icon" onClick={() => handleEditSlot(slot)} title="Editar franja en todos sus días">
                      <MdEdit style={{ fontSize: '1.1rem' }} />
                    </button>
                    <button className="cw-btn cw-btn--danger cw-btn--sm cw-btn--icon" onClick={() => handleDeleteSlot(slot)} title="Eliminar franja de todos sus días">
                      <MdDelete style={{ fontSize: '1.1rem' }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Formulario Agregar/Editar */}
        <div style={{ borderTop: '1px dashed var(--border-medium)', paddingTop: '1.25rem' }}>
           <h5 style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {editingGroupId ? <><MdEdit /> Editando Franja de Demanda agrupada</> : 'Agregar Franja de Demanda'}
              {editingGroupId && (
                 <button onClick={() => { setEditingGroupId(null); setForm({ start_hour: 0, end_hour: 8, required_staff: 1 }); setApplyDays([selectedDay]); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}>
                    <MdClose /> Cancelar edición
                 </button>
              )}
           </h5>
           
           {error && <div className="cw-alert cw-alert--error" style={{ padding: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem' }}>🚫 {error}</div>}
           
           <form onSubmit={handleAdd}>
             {/* Selector Múltiple de Días */}
             <div className="cw-form-group" style={{ marginBottom: '1rem' }}>
               <label className="cw-label">Aplicar esta franja a los días:</label>
               <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                 {DIAS.map(d => {
                   const isSelected = applyDays.includes(d.value);
                   return (
                     <button type="button" key={`apply-${d.value}`} onClick={() => {
                       if (isSelected) {
                         setApplyDays(applyDays.filter(x => x !== d.value));
                       } else {
                         setApplyDays([...applyDays, d.value].sort());
                       }
                     }} style={{
                       padding: '0.4rem 0.75rem', borderRadius: 8, fontSize: '0.82rem',
                       fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                       border: `2px solid ${isSelected ? 'var(--cw-primary)' : 'var(--border-subtle)'}`,
                       background: isSelected ? 'var(--cw-primary)' : 'var(--bg-glass)',
                       color: isSelected ? '#fff' : 'var(--text-muted)',
                     }}>
                       {d.label}
                     </button>
                   );
                 })}
               </div>
             </div>

             <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
               <div className="cw-form-group" style={{ marginBottom: 0, flex: 1, minWidth: 100 }}>
                 <label className="cw-label">Hora Inicio (0-23)</label>
                 <input type="number" min="0" max="23" required className="cw-input" value={form.start_hour} onChange={e => setForm({...form, start_hour: e.target.value})} />
               </div>
               <div className="cw-form-group" style={{ marginBottom: 0, flex: 1, minWidth: 100 }}>
                 <label className="cw-label">Hora Fin (1-24)</label>
                 <input type="number" min="1" max="24" required className="cw-input" value={form.end_hour} onChange={e => setForm({...form, end_hour: e.target.value})} />
               </div>
               <div className="cw-form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
                 <label className="cw-label">Personal Requerido</label>
                 <input type="number" min="0" required className="cw-input" value={form.required_staff} onChange={e => setForm({...form, required_staff: e.target.value})} />
               </div>
               <button type="submit" className="cw-btn cw-btn--primary" disabled={loading} style={{ height: '42px', padding: '0 1.25rem', background: editingGroupId ? 'var(--cw-warning)' : 'var(--cw-primary)', borderColor: editingGroupId ? 'var(--cw-warning)' : 'var(--cw-primary)' }}>
                 {editingGroupId ? <><MdEdit style={{ fontSize: '1.1rem' }} /> Actualizar Grupo</> : <><MdAdd style={{ fontSize: '1.1rem' }} /> Agregar</>}
               </button>
             </div>
           </form>
        </div>

      </div>
    </div>
  );
}
