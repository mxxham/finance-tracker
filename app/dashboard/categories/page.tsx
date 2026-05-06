'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { showToast } from '@/components/Toast';
import { translateCategory } from '@/lib/categories';

interface Category { id: number; name: string; color: string; icon: string; type: string; }

const COLORS = ['#6366f1','#22d47a','#f05252','#f5a623','#3b82f6','#ec4899','#a78bfa','#10b981','#f97316','#06b6d4','#84cc16','#e11d48','#14b8a6','#8b5cf6','#fb923c'];

function Skeleton({ w, h, r = 6 }: { w?: number | string; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w || '100%', height: h, borderRadius: r }} />;
}
const LABEL_STYLE: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.02em', textTransform: 'uppercase' };
const MODAL_STYLE: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', animation: 'fadeIn 0.15s ease both' };
const MODAL_BOX: React.CSSProperties = { width: '100%', maxWidth: 420, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border-2)', padding: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.7)', animation: 'scaleIn 0.2s cubic-bezier(0.34,1.2,0.64,1) both', display: 'flex', flexDirection: 'column', gap: 16 };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', icon: 'tag', type: 'expense' });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const c = await api.getCategories(); setCategories(c); }
    catch { showToast('Failed to load categories', 'error'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setSelected(null); setForm({ name: '', color: '#6366f1', icon: 'tag', type: 'expense' }); setShowModal(true); };
  const openEdit = (c: Category) => { setSelected(c); setForm({ name: c.name, color: c.color, icon: c.icon, type: c.type }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Enter a name', 'error'); return; }
    try {
      if (selected) { await api.updateCategory(selected.id, form); showToast('Category updated'); }
      else { await api.createCategory(form); showToast('Category created'); }
      setShowModal(false); load();
    } catch { showToast('Failed to save', 'error'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this category? Transactions using it will be uncategorized.')) return;
    try { await api.deleteCategory(id); showToast('Deleted', 'info'); load(); }
    catch { showToast('Failed to delete', 'error'); }
  };

  const income = categories.filter(c => c.type === 'income');
  const expense = categories.filter(c => c.type === 'expense');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Categories</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{categories.length} categories</p>
        </div>
        <button onClick={openAdd} style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>
          + New Category
        </button>
      </div>

      {(['expense', 'income'] as const).map(type => {
        const cats = type === 'income' ? income : expense;
        return (
          <div key={type}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: type === 'income' ? 'var(--green)' : 'var(--red)' }}>{type}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{cats.length} categories</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {loading ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Skeleton w={38} h={38} r={10} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Skeleton w={80} h={12} />
                    <Skeleton w={50} h={9} />
                  </div>
                </div>
              )) : cats.length === 0 ? (
                <div style={{ gridColumn: '1/-1', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: '28px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No {type} categories yet</div>
                </div>
              ) : cats.map(c => (
                <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.15s ease' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${c.color}22`, border: `1px solid ${c.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: c.color, flexShrink: 0 }}>
                    {translateCategory(c.name)[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{translateCategory(c.name)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{c.color}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => openEdit(c)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 5, background: 'var(--surface-2)', color: 'var(--text-soft)', border: '1px solid var(--border)', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => handleDelete(c.id)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 5, background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', fontWeight: 600 }}>Del</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {showModal && (
        <div style={MODAL_STYLE} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div style={MODAL_BOX}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.03em' }}>{selected ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
              {(['expense','income'] as const).map(t => (
                <button key={t} onClick={() => setForm(f=>({...f,type:t}))} style={{
                  flex: 1, padding: '9px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  background: form.type===t ? (t==='income'?'var(--green)':'var(--red)') : 'transparent',
                  color: form.type===t ? 'white' : 'var(--text-muted)', border: 'none',
                  textTransform: 'capitalize', transition: 'all 0.15s ease',
                }}>{t}</button>
              ))}
            </div>
            <div>
              <label style={LABEL_STYLE}>Name</label>
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Groceries" autoFocus />
            </div>
            <div>
              <label style={LABEL_STYLE}>Color</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {COLORS.map(col => (
                  <button key={col} onClick={() => setForm(f=>({...f,color:col}))} style={{
                    width: 28, height: 28, borderRadius: '50%', background: col, border: 'none',
                    outline: form.color===col ? `3px solid white` : '2px solid transparent',
                    outlineOffset: 2, transform: form.color===col ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s ease', cursor: 'pointer',
                    boxShadow: form.color===col ? `0 0 12px ${col}60` : 'none',
                  }} />
                ))}
              </div>
            </div>
            {/* Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${form.color}22`, border: `1px solid ${form.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: form.color }}>
                {form.name ? form.name[0].toUpperCase() : '?'}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{form.name || 'Preview'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{form.type} category</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={handleSave} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>{selected ? 'Save Changes' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
