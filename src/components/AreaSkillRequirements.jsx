import { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { MdAdd, MdDelete, MdVerified, MdInfo } from 'react-icons/md';

const fieldStyle = {
  width: '100%',
  padding: '0.4rem 0.55rem',
  borderRadius: 8,
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
};

export function AreaSkillRequirements({ areaId }) {
  const { tenant } = useAuth();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSkill, setNewSkill] = useState('');
  const [newRequired, setNewRequired] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Cargar skills requeridos del área
  useEffect(() => {
    if (!areaId || !tenant?.id) return;

    const fetchSkills = async () => {
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from('area_skill_requirements')
          .select('id, skill, required')
          .eq('area_id', areaId)
          .eq('tenant_id', tenant.id)
          .order('skill', { ascending: true });

        if (fetchError) throw fetchError;
        setSkills(data || []);
      } catch (err) {
        setError('Error al cargar skills: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, [areaId, tenant?.id]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddSkill = async () => {
    const skillName = newSkill.trim();
    if (!skillName) {
      setError('El nombre del skill es requerido');
      return;
    }

    // Validar duplicado (case-insensitive)
    const exists = skills.some(s => s.skill.toLowerCase() === skillName.toLowerCase());
    if (exists) {
      setError('Este skill ya está registrado');
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('area_skill_requirements')
        .insert({
          area_id: areaId,
          tenant_id: tenant.id,
          skill: skillName,
          required: newRequired,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setSkills(prev => [...prev, data].sort((a, b) => a.skill.localeCompare(b.skill)));
      setNewSkill('');
      setNewRequired(true);
      setError('');
      showToast('Skill agregado');
    } catch (err) {
      setError('Error al agregar: ' + err.message);
    }
  };

  const handleDeleteSkill = async (skillId) => {
    try {
      const { error: deleteError } = await supabase
        .from('area_skill_requirements')
        .delete()
        .eq('id', skillId);

      if (deleteError) throw deleteError;

      setSkills(prev => prev.filter(s => s.id !== skillId));
      showToast('Skill eliminado');
    } catch (err) {
      setError('Error al eliminar: ' + err.message);
    }
  };

  const handleToggleRequired = async (skill) => {
    try {
      const { error: updateError } = await supabase
        .from('area_skill_requirements')
        .update({ required: !skill.required })
        .eq('id', skill.id);

      if (updateError) throw updateError;

      setSkills(prev => prev.map(s =>
        s.id === skill.id ? { ...s, required: !s.required } : s
      ));
      showToast(skill.required ? 'Marcado como deseable' : 'Marcado como obligatorio');
    } catch (err) {
      setError('Error al actualizar: ' + err.message);
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
          SKILLS REQUERIDOS DEL ÁREA
        </span>
        <MdVerified style={{ fontSize: '1rem', color: 'var(--cw-primary)' }} />
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
        Solo los empleados que tengan TODOS los skills obligatorios serán asignados a esta área por el algoritmo.
      </p>

      {/* Formulario para agregar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input
          type="text"
          value={newSkill}
          onChange={e => setNewSkill(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nombre del skill"
          style={{ ...fieldStyle, flex: '2 1 200px', minWidth: '150px' }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem 0' }}>
          <input
            type="checkbox"
            checked={newRequired}
            onChange={e => setNewRequired(e.target.checked)}
          />
          Obligatorio
        </label>
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
      {!loading && skills.length === 0 && (
        <div style={{
          padding: '1rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          fontStyle: 'italic',
        }}>
          Sin skills requeridos. Cualquier empleado del área puede ser asignado.
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
            const isRequired = skill.required;
            const bg = isRequired ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)';
            const border = isRequired ? 'rgba(245,158,11,0.4)' : 'rgba(59,130,246,0.3)';
            const color = isRequired ? '#d97706' : '#3b82f6';

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
                  background: bg,
                  border: `1px solid ${border}`,
                  color: 'var(--text-primary)',
                }}
              >
                <span>{skill.skill}</span>
                <button
                  onClick={() => handleToggleRequired(skill)}
                  title={isRequired ? 'Marcar como deseable' : 'Marcar como obligatorio'}
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: 12,
                    background: isRequired ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)',
                    color: color,
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {isRequired ? 'Oblig.' : 'Deseable'}
                </button>
                <button
                  onClick={() => handleDeleteSkill(skill.id)}
                  title="Eliminar skill"
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