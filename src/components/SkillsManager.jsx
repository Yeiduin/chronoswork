import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { MdAdd, MdDelete, MdBuild, MdInfo } from 'react-icons/md';

const SKILL_LEVELS = [
  { value: 'BASICO', label: 'Básico' },
  { value: 'INTERMEDIO', label: 'Intermedio' },
  { value: 'AVANZADO', label: 'Avanzado' },
  { value: 'EXPERTO', label: 'Experto' },
];

const LEVEL_COLORS = {
  BASICO: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)' },
  INTERMEDIO: { bg: 'rgba(59,130,246,0.25)', border: 'rgba(59,130,246,0.4)' },
  AVANZADO: { bg: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.4)' },
  EXPERTO: { bg: 'rgba(16,185,129,0.2)', border: 'rgba(16,185,129,0.4)' },
};

const fieldStyle = {
  width: '100%',
  padding: '0.4rem 0.55rem',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

export function SkillsManager({ employeeId }) {
  const { tenant } = useAuth();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSkill, setNewSkill] = useState('');
  const [newLevel, setNewLevel] = useState('BASICO');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Cargar skills del empleado
  useEffect(() => {
    if (!employeeId || !tenant?.id) return;

    const fetchSkills = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('employee_skills')
          .select('id, skill, nivel')
          .eq('employee_id', employeeId)
          .eq('tenant_id', tenant.id)
          .order('skill', { ascending: true });

        if (fetchError) throw fetchError;
        setSkills(data || []);
      } catch (err) {
        setError('Error al cargar habilidades: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, [employeeId, tenant?.id]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddSkill = async () => {
    const skillName = newSkill.trim();
    if (!skillName) {
      setError('El nombre de la habilidad es requerido');
      return;
    }

    // Validar duplicado (case-insensitive)
    const exists = skills.some(s => s.skill.toLowerCase() === skillName.toLowerCase());
    if (exists) {
      setError('Esta habilidad ya está registrada');
      return;
    }

    // Validar máximo 20 skills
    if (skills.length >= 20) {
      setError('Máximo 20 habilidades permitidas por empleado');
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('employee_skills')
        .insert({
          employee_id: employeeId,
          tenant_id: tenant.id,
          skill: skillName,
          nivel: newLevel,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setSkills(prev => [...prev, data].sort((a, b) => a.skill.localeCompare(b.skill)));
      setNewSkill('');
      setNewLevel('BASICO');
      setError('');
      showToast('Habilidad agregada');
    } catch (err) {
      setError('Error al agregar: ' + err.message);
    }
  };

  const handleDeleteSkill = async (skillId) => {
    try {
      const { error: deleteError } = await supabase
        .from('employee_skills')
        .delete()
        .eq('id', skillId);

      if (deleteError) throw deleteError;

      setSkills(prev => prev.filter(s => s.id !== skillId));
      showToast('Habilidad eliminada');
    } catch (err) {
      setError('Error al eliminar: ' + err.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>
          HABILIDADES Y CUALIFICACIONES
        </span>
        <MdBuild style={{ fontSize: '1rem', color: 'var(--cw-primary)' }} />
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Define las habilidades del empleado. El algoritmo solo lo asignará a áreas que requieran estos skills.
      </p>

      {/* Formulario para agregar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={newSkill}
          onChange={e => setNewSkill(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nombre de la habilidad"
          style={{ ...fieldStyle, flex: '2 1 200px', minWidth: '150px' }}
        />
        <select
          value={newLevel}
          onChange={e => setNewLevel(e.target.value)}
          style={{ ...fieldStyle, flex: '1 1 120px' }}
        >
          {SKILL_LEVELS.map(l => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <button
          onClick={handleAddSkill}
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
      {!loading && skills.length === 0 && (
        <div style={{
          padding: '1rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontStyle: 'italic',
        }}>
          Sin habilidades registradas. Añade la primera.
        </div>
      )}

      {/* Grid de badges */}
      {loading ? (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Cargando...
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {skills.map(skill => {
            const colors = LEVEL_COLORS[skill.nivel] || LEVEL_COLORS.BASICO;
            return (
              <div
                key={skill.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 20,
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: 'var(--text-primary)',
                }}
              >
                <span>{skill.skill}</span>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.3)',
                  color: 'var(--text-secondary)',
                }}>
                  {SKILL_LEVELS.find(l => l.value === skill.nivel)?.label || skill.nivel}
                </span>
                <button
                  onClick={() => handleDeleteSkill(skill.id)}
                  title="Eliminar habilidad"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    border: 'none',
                    background: 'transparent',
                    color: '#dc2626',
                    fontSize: '0.9rem',
                  }}
                >
                  <MdDelete />
                </button>
              </div>
            );
          })}
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