import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { MdAdd, MdDelete, MdSchedule, MdInfo } from 'react-icons/md';

const DIAS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

const fieldStyle = {
  width: '100%',
  padding: '0.4rem 0.55rem',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

export function EmployeePreferencesEditor({ employeeId }) {
  const { tenant } = useAuth();
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [newAvailable, setNewAvailable] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Cargar preferencias del empleado
  useEffect(() => {
    if (!employeeId || !tenant?.id) return;

    const fetchPreferences = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('employee_preferences')
          .select('id, day_of_week, start_time, end_time, available')
          .eq('employee_id', employeeId)
          .eq('tenant_id', tenant.id)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true });

        if (fetchError) throw fetchError;
        setPreferences(data || []);
      } catch (err) {
        setError('Error al cargar preferencias: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [employeeId, tenant?.id]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const validateTimeRange = (start, end) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Si end <= start, cruza medianoche (válido)
    if (endMinutes > startMinutes) {
      return true;
    }
    // Permite cruce de medianoche
    return endMinutes <= startMinutes;
  };

  const checkDuplicate = (day, start, end, available) => {
    return preferences.some(p =>
      p.day_of_week === day &&
      p.start_time === start &&
      p.end_time === end &&
      p.available === available
    );
  };

  const handleAddPreference = async () => {
    // Validar horas
    if (!validateTimeRange(newStart, newEnd)) {
      setError('La hora de fin debe ser mayor que la hora de inicio, o cruzar medianoche');
      return;
    }

    // Validar duplicado
    if (checkDuplicate(newDay, newStart, newEnd, newAvailable)) {
      setError('Esta restricción ya está registrada');
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('employee_preferences')
        .insert({
          employee_id: employeeId,
          tenant_id: tenant.id,
          day_of_week: newDay,
          start_time: newStart,
          end_time: newEnd,
          available: newAvailable,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setPreferences(prev => [...prev, data].sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      }));
      setNewDay(1);
      setNewStart('09:00');
      setNewEnd('17:00');
      setNewAvailable(false);
      setError('');
      showToast('Restricción agregada');
    } catch (err) {
      setError('Error al agregar: ' + err.message);
    }
  };

  const handleDeletePreference = async (prefId) => {
    try {
      const { error: deleteError } = await supabase
        .from('employee_preferences')
        .delete()
        .eq('id', prefId);

      if (deleteError) throw deleteError;

      setPreferences(prev => prev.filter(p => p.id !== prefId));
      showToast('Restricción eliminada');
    } catch (err) {
      setError('Error al eliminar: ' + err.message);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>
          RESTRICCIONES DE HORARIO
        </span>
        <MdSchedule style={{ fontSize: '1rem', color: 'var(--cw-primary)' }} />
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Define franjas donde el empleado NO está disponible. El algoritmo respetará estas restricciones al asignar turnos.
      </p>

      {/* Formulario para agregar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 120px', minWidth: '100px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
            Día
          </label>
          <select
            value={newDay}
            onChange={e => setNewDay(Number(e.target.value))}
            style={fieldStyle}
          >
            {DIAS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
            Inicio
          </label>
          <input
            type="time"
            value={newStart}
            onChange={e => setNewStart(e.target.value)}
            style={fieldStyle}
          />
        </div>
        <div style={{ flex: '1 1 100px', minWidth: '80px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.3rem' }}>
            Fin
          </label>
          <input
            type="time"
            value={newEnd}
            onChange={e => setNewEnd(e.target.value)}
            style={fieldStyle}
          />
        </div>
        <div style={{ flex: '1 1 140px', minWidth: '120px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={newAvailable}
              onChange={e => setNewAvailable(e.target.checked)}
            />
            Disponible
          </label>
        </div>
        <button
          onClick={handleAddPreference}
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
            flexShrink: 0,
          }}
        >
          <MdAdd style={{ fontSize: '0.9rem' }} />
          Agregar
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
      {!loading && preferences.length === 0 && (
        <div style={{
          padding: '1rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontStyle: 'italic',
        }}>
          Sin restricciones. El empleado está disponible en cualquier franja.
        </div>
      )}

      {/* Tabla de preferencias */}
      {!loading && preferences.length > 0 && (
        <div style={{
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
            gap: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            padding: '0.5rem 0.75rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span>Día</span>
            <span>Inicio</span>
            <span>Fin</span>
            <span>Estado</span>
            <span></span>
          </div>
          {preferences.map(pref => (
            <div
              key={pref.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                gap: '0.5rem',
                alignItems: 'center',
                fontSize: '0.85rem',
                padding: '0.5rem 0.75rem',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>
                {DIAS.find(d => d.value === pref.day_of_week)?.label || pref.day_of_week}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{pref.start_time}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{pref.end_time}</span>
              <span style={{
                color: pref.available ? '#059669' : '#dc2626',
                fontWeight: 600,
              }}>
                {pref.available ? 'Disponible' : 'No disponible'}
              </span>
              <button
                onClick={() => handleDeletePreference(pref.id)}
                title="Eliminar restricción"
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