import { useEffect } from 'react';

const TOOLS = [
  { id: 'arrow', label: 'Flèche', icon: '↗', shortcut: '1' },
  { id: 'box', label: 'Rectangle', icon: '□', shortcut: '2' },
  { id: 'text', label: 'Texte', icon: 'T', shortcut: '3' },
  { id: 'draw', label: 'Trait libre', icon: '✎', shortcut: '4' },
];

const COLORS = [
  { id: 'red', value: '#EF4444', label: 'Rouge' },
  { id: 'blue', value: '#3B82F6', label: 'Bleu' },
  { id: 'green', value: '#22C55E', label: 'Vert' },
  { id: 'black', value: '#000000', label: 'Noir' },
];

export function Toolbar({
  activeTool,
  activeColor,
  onToolChange,
  onColorChange,
  onUndo,
  onClear,
  canUndo,
  readOnly = false,
}) {
  // Keyboard shortcuts for tools
  useEffect(() => {
    if (readOnly) return;

    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const tool = TOOLS.find((t) => t.shortcut === e.key);
      if (tool) {
        onToolChange(tool.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToolChange, readOnly]);

  if (readOnly) {
    return null;
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
      {/* Tools */}
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => (
          <div key={tool.id} className="relative group">
            <button
              onClick={() => onToolChange(tool.id)}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                activeTool === tool.id
                  ? 'bg-red-100 text-red-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="text-lg">{tool.icon}</span>
            </button>
            {/* Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {tool.label} <span className="text-gray-400">({tool.shortcut})</span>
            </div>
          </div>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((color) => (
          <button
            key={color.id}
            onClick={() => onColorChange(color.value)}
            className={`w-8 h-8 rounded-full border-2 transition-transform ${
              activeColor === color.value
                ? 'border-gray-800 scale-110'
                : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: color.value }}
            title={color.label}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-gray-200" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
            canUndo
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          Annuler
        </button>
        <button
          onClick={onClear}
          className="px-3 py-2 rounded text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          Enlever toutes les annotations
        </button>
      </div>
    </div>
  );
}
