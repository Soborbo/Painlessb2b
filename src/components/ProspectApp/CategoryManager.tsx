import { useState } from 'react';
import { X, Plus, Pencil, Trash2 } from 'lucide-react';
import type { Category } from './types';

interface Props {
  categories: Category[];
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, color: string) => void;
  onUpdate: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
}

export default function CategoryManager({ categories, open, onClose, onAdd, onUpdate, onDelete }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  if (!open) return null;

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), color);
    setName('');
    setColor('#6366f1');
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    onUpdate(editingId, editName.trim(), editColor);
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-[14px] p-6"
        style={{ backgroundColor: '#13151e', border: '1px solid #2a2d42' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: '#e8eaf4' }}>Manage Categories</h2>
          <button onClick={onClose} className="p-1 cursor-pointer" style={{ color: '#8990b0' }}>
            <X size={20} />
          </button>
        </div>

        {/* Add new */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="flex-1 px-3 py-2 rounded-[6px] text-sm outline-none"
            style={{ backgroundColor: '#1a1d2a', border: '1px solid #2a2d42', color: '#e8eaf4' }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-10 h-10 rounded-[6px] cursor-pointer border-0 p-0"
            style={{ backgroundColor: '#1a1d2a' }}
          />
          <button
            onClick={handleAdd}
            className="p-2 rounded-[6px] cursor-pointer"
            style={{ backgroundColor: '#818cf8', color: '#fff' }}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 px-3 py-2 rounded-[6px]"
              style={{ backgroundColor: '#1a1d2a' }}
            >
              {editingId === cat.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-2 py-1 rounded text-sm outline-none"
                    style={{ backgroundColor: '#0c0e14', border: '1px solid #2a2d42', color: '#e8eaf4' }}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    autoFocus
                  />
                  <input
                    type="color"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                  />
                  <button onClick={saveEdit} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: '#818cf8', color: '#fff' }}>
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded cursor-pointer" style={{ color: '#8990b0' }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-sm" style={{ color: '#e8eaf4' }}>{cat.name}</span>
                  <span className="text-xs font-mono" style={{ color: '#5c6280' }}>{cat.company_count ?? 0}</span>
                  <button onClick={() => startEdit(cat)} className="p-1 cursor-pointer" style={{ color: '#8990b0' }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDelete(cat.id)} className="p-1 cursor-pointer" style={{ color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
