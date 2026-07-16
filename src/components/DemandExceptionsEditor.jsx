import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { MdAdd, MdDelete, MdEvent, MdInfo } from 'react-icons/md';

const fieldStyle = {
  width: '100%',
  padding: '0.4rem 0.55rem',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

export function DemandExceptionsEditor({ areaId }) {
  const { tenant } = useAuth();
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDate, setNewDate] = useState('');
  const [newNote, setNewNote] = useState('');
  const [slots, setSlots] = useState([{ start_hour: 9, end_hour: 17, required_staff: 2 }]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Cargar excepciones del área
  useEffect(() => {
    if (!areaId || !tenant?.id) return;

    const fetchExceptions = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('area_demand_exceptions')
          .select('id, date, observacion, slots')
          .eq('area_id', areaId)
          .eq('tenant_id', tenant.id)
          .order('date', { ascending: true });

        if (fetchError) throw fetchError;
        setExceptions(data || []);
      } catch (err) {
        setError('Error al cargar excepciones: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExceptions();
  }, [areaId, tenant?.id]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const addSlot = () => {
    setSlots(prev => [...prev, { start_hour: 9, end_hour: 17, required_staff: 2 }]);
  };

  const removeSlot = (index) => {
    setSlots(prev => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (index, field, value) => {
    setSlots(prev => prev.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    ));
  };

  const validateSlots = () => {
    for (const slot of slots) {
      if (slot.start_hour < 0 || slot.start_hour > 23) {
        return 'La hora de inicio debe estar entre 0 y 23';
      }
      if (slot.end_hour < 1 || slot.end_hour > 24) {
        return 'La hora de fin debe estar entre 1 y 24';
      }
      if (slot.end_hour <= slot.start_hour) {
        return 'La hora de fin debe ser mayor que la hora de inicio';
      }
      if (slot.required_staff < 0) {
        return 'El personal requerido no puede ser negativo';
      }
    }
    return '';
  };

  const handleAddException = async () => {
    if (!newDate) {
      setError('La fecha es requerida');
      return;
    }

    const slotError = validateSlots();
    if (slotError) {
      setError(slotError);
      return;
    }

    // Verificar duplicado
    const exists = exceptions.some(e => e.date === newDate);
    if (exists) {
      setError('Ya existe una excepción para esta fecha');
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('area_demand_exceptions')
        .insert({
          area_id: areaId,
          tenant_id: tenant.id,
          date: newDate,
          observacion: newNote.trim() || null,
          slots: slots,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setExceptions(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)));
      setNewDate('');
      setNewNote('');
      setSlots([{ start_hour: 9, end_hour: 17, required_staff: 2 }]);
      setError('');
      showToast('Excepción agregada');
    } catch (err) {
      setError('Error al agregar: ' + err.message);
    }
  };

  const handleDeleteException = async (exceptionId) => {
    try {
      const { error: deleteError } = await supabase
        .from('area_demand_exceptions')
        .delete()
        .eq('id', exceptionId);

      if (deleteError) throw deleteError;

      setExceptions(prev => prev.filter(e => e.id !== exceptionId));
      showToast('Excepción eliminada');
    } catch (err) {
      setError('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>
          DEMANDA POR FECHA ESPECÍFICA
        </span>
        <MdEvent style={{ fontSize: '1rem', color: 'var(--cw-primary)' }} />
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Configura demanda especial para fechas puntuales (Black Friday, festivos, eventos). Sobrescribe la curva base del día.
      </p>

      {/* Formulario para nueva excepción */}
      <div style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 150px', minWidth: '120px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
              Fecha
            </label>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={fieldStyle}
            />
          </div>
          <div style={{ flex: '2 1 250px', minWidth: '200px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
              Observación (opcional)
            </label>
            <input
              type="text"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Ej: Black Friday, festivo, evento..."
              style={fieldStyle}
            />
          </div>
        </div>

        {/* Slots dinámicos */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Slots de demanda
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {slots.map((slot, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={slot.start_hour}
                  onChange={e => updateSlot(index, 'start_hour', Number(e.target.value))}
                  style={{ ...fieldStyle, flex: '1 1 80px', minWidth: '60px' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>a</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={slot.end_hour}
                  onChange={e => updateSlot(index, 'end_hour', Number(e.target.value))}
                  style={{ ...fieldStyle, flex: '1 1 80px', minWidth: '60px' }}
                />
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={slot.required_staff}
                  onChange={e => updateSlot(index, 'required_staff', Number(e.target.value))}
                  style={{ ...fieldStyle, flex: '1 1 80px', minWidth: '60px' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', minWidth: '60px' }}>personas</span>
                {slots.length > 1 && (
                  <button
                    onClick={() => removeSlot(index)}
                    title="Eliminar slot"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: '1px solid var(--border-subtle)',
                      background: 'transparent',
                      color: '#dc2626',
                    }}
                  >
                    <MdDelete />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addSlot}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              marginTop: '0.5rem',
              padding: '0.3rem 0.6rem',
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            <MdAdd style={{ fontSize: '0.9rem' }} />
            Agregar slot
          </button>
        </div>

        <button
          onClick={handleAddException}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.4rem 0.85rem',
            borderRadius: 8,
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            border: '1px solid var(--cw-primary)',
            background: 'var(--cw-primary)',
            color: '#fff',
            opacity: loading ? 0.6 : 1,
          }}
        >
          <MdAdd style={{ fontSize: '0.9rem' }} />
          Guardar excepción
        </button>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div style={{
          fontSize: '0.78rem',
          color: '#dc2626',
          marginBottom: '0.75rem',
          padding: '0.5rem 0.75rem',
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: 8,
        }}>
          <MdInfo style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
          {error}
        </div>
      )}

      {/* Estado vacío */}
      {!loading && exceptions.length === 0 && (
        <div style={{
          padding: '1rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontStyle: 'italic',
        }}>
          Sin excepciones de demanda. El algoritmo usa la curva base por día de la semana.
        </div>
      )}

      {/* Tarjetas de excepciones */}
      {loading ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Cargando...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {exceptions.map(exc => (
            <div
              key={exc.id}
              style={{
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {exc.date}
                </div>
                {exc.observacion && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {exc.observacion}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {exc.slots?.map((slot, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        background: 'rgba(59,130,246,0.15)',
                        border: '1px solid rgba(59,130,246,0.3)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {slot.start_hour}h - {slot.end_hour}h ({slot.required_staff}p)
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleDeleteException(exc.id)}
                title="Eliminar excepción"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 6,
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  color: '#dc2626',
                }}
              >
                <MdDelete />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          background: toast.type === 'error' ? '#dc2626' : '#059669',
          color: '#fff',
          padding: '0.65rem 1.25rem',
          borderRadius: 10,
          fontSize: '0.85rem',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.type === 'error' ? '⚠️' : '✅'} {toast.msg}
        </div>
      )}
    </div>
  );
}