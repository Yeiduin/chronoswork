import { useState } from 'react';
import { useAnnouncements } from '../hooks/useAnnouncements';
import {
  MdAdd, MdEdit, MdDelete, MdClose, MdImage, MdVideoLibrary, MdLink, MdPriorityHigh,
} from 'react-icons/md';

const TZ = 'America/Bogota';
const colToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ });

const TIPO_CONFIG = {
  TEXTO:  { label: 'Texto',  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  IMAGEN: { label: 'Imagen', color: '#059669', bg: 'rgba(5,150,105,0.12)' },
  VIDEO:  { label: 'Video',  color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  LINK:   { label: 'Enlace', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
};

const TIPO_ICONS = {
  TEXTO: <MdPriorityHigh />,
  IMAGEN: <MdImage />,
  VIDEO: <MdVideoLibrary />,
  LINK: <MdLink />,
};

const PRIORIDAD_CONFIG = {
  ALTA:  { label: 'Alta',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
  MEDIA: { label: 'Media', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  BAJA:  { label: 'Baja',  color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
};

function getVideoEmbedUrl(url) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  return url;
}

export default function AnnouncementsPage() {
  const {
    announcements, loading, error,
    fetchAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  } = useAnnouncements();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const today = colToday();

  const [formData, setFormData] = useState({
    titulo: '', contenido: '', tipo: 'TEXTO',
    video_url: '', link_url: '',
    fecha_inicio: today, fecha_fin: '', prioridad: 'MEDIA',
  });

  const openCreate = () => {
    setEditing(null);
    setFormData({
      titulo: '', contenido: '', tipo: 'TEXTO',
      video_url: '', link_url: '',
      fecha_inicio: today, fecha_fin: '', prioridad: 'MEDIA',
    });
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setFormData({
      titulo: a.titulo || '',
      contenido: a.contenido || '',
      tipo: a.tipo || 'TEXTO',
      video_url: a.video_url || '',
      link_url: a.tipo === 'LINK' ? (a.media_url || '') : '',
      fecha_inicio: a.fecha_inicio || today,
      fecha_fin: a.fecha_fin || '',
      prioridad: a.prioridad || 'MEDIA',
    });
    setImageFile(null);
    setImagePreview(a.tipo === 'IMAGEN' && a.media_url ? a.media_url : null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleTipoChange = (value) => {
    setFormData(prev => ({ ...prev, tipo: value }));
    if (value !== 'IMAGEN') {
      setImageFile(null);
      setImagePreview(null);
    } else if (editing?.tipo === 'IMAGEN' && editing?.media_url) {
      setImagePreview(editing.media_url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        titulo: formData.titulo,
        contenido: formData.contenido,
        tipo: formData.tipo,
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin || null,
        prioridad: formData.prioridad,
      };

      if (formData.tipo === 'VIDEO') {
        payload.video_url = formData.video_url || null;
        payload.media_url = null;
      } else if (formData.tipo === 'LINK') {
        payload.media_url = formData.link_url || null;
        payload.video_url = null;
      } else if (formData.tipo === 'IMAGEN') {
        payload.video_url = null;
        if (imageFile) {
          payload.imageFile = imageFile;
        } else if (editing?.media_url) {
          payload.media_url = editing.media_url;
        } else {
          payload.media_url = null;
        }
      } else {
        payload.media_url = null;
        payload.video_url = null;
      }

      if (editing) {
        await updateAnnouncement(editing.id, payload);
      } else {
        await createAnnouncement(payload);
      }
      closeModal();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteAnnouncement(deleteConfirm.id);
      setDeleteConfirm(null);
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const videoEmbedUrl = formData.tipo === 'VIDEO' ? getVideoEmbedUrl(formData.video_url) : null;

  return (
    <div className="page-wrapper animate-fade-in">
      <div className="page-header">
        <div className="page-header__info">
          <h1 className="page-title">📢 Anuncios y Noticias</h1>
          <p className="page-subtitle">
            Comunica información importante a tus colaboradores
          </p>
        </div>
        <div className="page-header__actions">
          <button className="cw-btn cw-btn--primary" onClick={openCreate}>
            <MdAdd /> Nuevo Anuncio
          </button>
        </div>
      </div>

      {error && (
        <div className="cw-alert cw-alert--error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-overlay">
          <div className="cw-spinner"></div>
          <span>Cargando anuncios...</span>
        </div>
      ) : announcements.length === 0 ? (
        <div className="cw-card">
          <div className="empty-state">
            <div className="empty-state__icon">📢</div>
            <div className="empty-state__title">No hay anuncios activos</div>
            <div className="empty-state__desc">
              Crea el primer anuncio para mantener informados a tus colaboradores.
            </div>
            <button className="cw-btn cw-btn--primary" onClick={openCreate}>
              <MdAdd /> Nuevo Anuncio
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem',
        }}>
          {announcements.map(a => {
            const tipoCfg = TIPO_CONFIG[a.tipo] || TIPO_CONFIG.TEXTO;
            const priCfg = PRIORIDAD_CONFIG[a.prioridad] || PRIORIDAD_CONFIG.MEDIA;
            const embedUrl = a.tipo === 'VIDEO' ? getVideoEmbedUrl(a.video_url) : null;

            return (
              <div key={a.id} className="cw-card" style={{
                padding: 0, overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
              }}>
                {a.tipo === 'IMAGEN' && a.media_url && (
                  <div style={{ height: 160, overflow: 'hidden', background: 'var(--bg-glass)' }}>
                    <img src={a.media_url} alt={a.titulo}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                {a.tipo === 'VIDEO' && embedUrl && (
                  <div style={{ height: 160, overflow: 'hidden', background: '#000' }}>
                    <iframe src={embedUrl} title={a.titulo}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      allowFullScreen />
                  </div>
                )}

                <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                      borderRadius: 6, color: tipoCfg.color, background: tipoCfg.bg,
                    }}>
                      {TIPO_ICONS[a.tipo]} {tipoCfg.label}
                    </span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem',
                      borderRadius: 6, color: priCfg.color, background: priCfg.bg,
                    }}>
                      <MdPriorityHigh style={{ fontSize: '0.85rem' }} />
                      {priCfg.label}
                    </span>
                  </div>

                  <h3 style={{
                    fontSize: '0.95rem', fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: '0 0 0.4rem',
                  }}>
                    {a.titulo}
                  </h3>

                  <p style={{
                    fontSize: '0.82rem', color: 'var(--text-muted)',
                    flex: 1, margin: 0,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  }}>
                    {a.contenido}
                  </p>

                  {a.tipo === 'LINK' && a.media_url && (
                    <a href={a.media_url} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        fontSize: '0.78rem',
                        color: 'var(--cw-accent)',
                        marginTop: '0.4rem', textDecoration: 'none',
                      }}>
                      <MdLink /> Abrir enlace
                    </a>
                  )}

                  <div style={{
                    fontSize: '0.72rem', color: 'var(--text-muted)',
                    marginTop: '0.5rem', paddingTop: '0.5rem',
                    borderTop: '1px solid var(--border-subtle)',
                  }}>
                    📅 {a.fecha_inicio}
                    {a.fecha_fin ? ` → ${a.fecha_fin}` : ' → Indefinido'}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem' }}>
                    <button className="cw-btn cw-btn--secondary cw-btn--sm"
                      onClick={() => openEdit(a)}>
                      <MdEdit /> Editar
                    </button>
                    <button className="cw-btn cw-btn--danger cw-btn--sm"
                      onClick={() => setDeleteConfirm(a)}>
                      <MdDelete /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="cw-modal-overlay">
          <div className="cw-modal animate-fade-in" style={{ maxWidth: '520px' }}>
            <div className="cw-modal__header">
              <h3>{editing ? 'Editar Anuncio' : 'Nuevo Anuncio'}</h3>
              <button className="cw-modal__close" onClick={closeModal}>
                <MdClose />
              </button>
            </div>
            <div className="cw-modal__body">
              <form id="anuncio-form" onSubmit={handleSubmit} className="cw-form">
                <div className="cw-form-group">
                  <label>Título</label>
                  <input
                    type="text"
                    className="cw-input"
                    value={formData.titulo}
                    onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                    maxLength={200}
                    required
                    placeholder="Título del anuncio"
                  />
                </div>

                <div className="cw-form-group">
                  <label>Contenido</label>
                  <textarea
                    className="cw-input"
                    value={formData.contenido}
                    onChange={e => setFormData({ ...formData, contenido: e.target.value })}
                    rows={4}
                    required
                    placeholder="Escribe el contenido del anuncio..."
                  />
                </div>

                <div className="cw-form-group">
                  <label>Tipo</label>
                  <select
                    className="cw-input"
                    value={formData.tipo}
                    onChange={e => handleTipoChange(e.target.value)}
                  >
                    <option value="TEXTO">Texto</option>
                    <option value="IMAGEN">Imagen</option>
                    <option value="VIDEO">Video</option>
                    <option value="LINK">Enlace</option>
                  </select>
                </div>

                {formData.tipo === 'IMAGEN' && (
                  <div className="cw-form-group">
                    <label>Imagen</label>
                    <input
                      type="file"
                      className="cw-input"
                      style={{ padding: '0.4rem' }}
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleImageChange}
                    />
                    {imagePreview && (
                      <div style={{
                        marginTop: '0.5rem', borderRadius: 8,
                        overflow: 'hidden', border: '1px solid var(--border-subtle)',
                      }}>
                        <img src={imagePreview} alt="Vista previa"
                          style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                )}

                {formData.tipo === 'VIDEO' && (
                  <div className="cw-form-group">
                    <label>URL del Video (YouTube o Google Drive)</label>
                    <input
                      type="url"
                      className="cw-input"
                      value={formData.video_url}
                      onChange={e => setFormData({ ...formData, video_url: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    {videoEmbedUrl && (
                      <div style={{
                        marginTop: '0.5rem', borderRadius: 8,
                        overflow: 'hidden', border: '1px solid var(--border-subtle)',
                        aspectRatio: '16 / 9',
                      }}>
                        <iframe src={videoEmbedUrl} title="Vista previa"
                          style={{ width: '100%', height: '100%', border: 'none' }}
                          allowFullScreen />
                      </div>
                    )}
                  </div>
                )}

                {formData.tipo === 'LINK' && (
                  <div className="cw-form-group">
                    <label>URL del Enlace</label>
                    <input
                      type="url"
                      className="cw-input"
                      value={formData.link_url}
                      onChange={e => setFormData({ ...formData, link_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="cw-form-group">
                    <label>Fecha de Inicio</label>
                    <input
                      type="date"
                      className="cw-input"
                      value={formData.fecha_inicio}
                      onChange={e => setFormData({ ...formData, fecha_inicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="cw-form-group">
                    <label>Fecha de Fin (opcional)</label>
                    <input
                      type="date"
                      className="cw-input"
                      value={formData.fecha_fin}
                      onChange={e => setFormData({ ...formData, fecha_fin: e.target.value })}
                      min={formData.fecha_inicio || undefined}
                    />
                  </div>
                </div>

                <div className="cw-form-group">
                  <label>Prioridad</label>
                  <select
                    className="cw-input"
                    value={formData.prioridad}
                    onChange={e => setFormData({ ...formData, prioridad: e.target.value })}
                  >
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Media</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </div>
              </form>
            </div>
            <div className="cw-modal__footer">
              <button type="button" className="cw-btn cw-btn--secondary" onClick={closeModal}>
                Cancelar
              </button>
              <button type="submit" form="anuncio-form" className="cw-btn cw-btn--primary" disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Crear Anuncio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="cw-modal-overlay">
          <div className="cw-modal animate-fade-in" style={{ maxWidth: '380px' }}>
            <div className="cw-modal__header">
              <h3>Eliminar Anuncio</h3>
              <button className="cw-modal__close" onClick={() => setDeleteConfirm(null)}>
                <MdClose />
              </button>
            </div>
            <div className="cw-modal__body">
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                ¿Seguro que deseas eliminar el anuncio <strong>"{deleteConfirm.titulo}"</strong>?
                El anuncio se desactivará y ya no será visible para los colaboradores.
              </p>
            </div>
            <div className="cw-modal__footer">
              <button className="cw-btn cw-btn--secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </button>
              <button className="cw-btn cw-btn--danger" onClick={handleDelete} disabled={saving}>
                {saving ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
