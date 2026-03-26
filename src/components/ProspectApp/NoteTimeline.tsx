import { useState } from 'react';
import { X, MessageSquare, Send } from 'lucide-react';
import { formatRelativeTime } from '../../lib/utils';
import type { Note } from './types';

interface Props {
  notes: Note[];
  companyId: string;
  onAddNote: (body: string) => void;
  onDeleteNote: (id: string) => void;
}

function isAutoNote(body: string): boolean {
  return body.startsWith('[Auto]') || body.startsWith('Status changed') || body.startsWith('Email sent');
}

export default function NoteTimeline({ notes, companyId, onAddNote, onDeleteNote }: Props) {
  const [noteText, setNoteText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText.trim());
    setNoteText('');
  };

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      onDeleteNote(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  };

  return (
    <div className="space-y-3">
      {/* Add note */}
      <div className="flex gap-2">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="flex-1 px-3 py-2 rounded-[6px] text-sm outline-none resize-none"
          style={{ backgroundColor: '#1a1d2a', border: '1px solid #2a2d42', color: '#e8eaf4' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!noteText.trim()}
          className="self-end p-2 rounded-[6px] transition-all duration-200 cursor-pointer disabled:opacity-40"
          style={{ backgroundColor: '#818cf8', color: '#fff' }}
        >
          <Send size={16} />
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {notes.map((note) => {
          const auto = isAutoNote(note.body);
          return (
            <div
              key={note.id}
              className="relative px-3 py-2 rounded-[6px] group"
              style={{
                backgroundColor: auto ? 'transparent' : '#1a1d2a',
                borderLeft: auto ? '2px solid #2a2d42' : 'none',
              }}
            >
              <div className="flex items-start gap-2">
                {auto && <MessageSquare size={12} className="mt-1 flex-shrink-0" style={{ color: '#5c6280' }} />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${auto ? 'italic' : ''}`} style={{ color: auto ? '#5c6280' : '#e8eaf4' }}>
                    {note.body}
                  </p>
                  <span className="text-xs" style={{ color: '#5c6280' }}>
                    {formatRelativeTime(note.created_at)}
                  </span>
                </div>
                {!auto && (
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded cursor-pointer transition-opacity"
                    style={{ color: confirmDelete === note.id ? '#ef4444' : '#8990b0' }}
                    title={confirmDelete === note.id ? 'Click again to confirm' : 'Delete note'}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
