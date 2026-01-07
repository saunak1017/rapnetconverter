import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ColumnDef } from "../lib/types";

function Item({
  col,
  hidden,
  toggleHidden,
}: {
  col: ColumnDef;
  hidden: boolean;
  toggleHidden: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: col.key,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: hidden ? 0.45 : 1,
    border: "1px solid rgba(148,163,184,.2)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(2,6,23,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    cursor: "grab",
    boxShadow: isDragging ? "0 12px 30px rgba(0,0,0,.45)" : undefined
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          ref={setActivatorNodeRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(148,163,184,.2)",
            cursor: "grab",
            color: "#cbd5f5",
            fontSize: 16,
          }}
          {...attributes}
          {...listeners}
        >
          ↕
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontWeight: 600 }}>{col.label}</div>
          <div className="small">{col.key}</div>
        </div>
      </div>
      <button className="btn" type="button" onClick={(e) => { e.stopPropagation(); toggleHidden(); }}>
        {hidden ? "Show" : "Hide"}
      </button>
    </div>
  );
}

export function ColumnPicker({
  columns,
  hiddenKeys,
  setHiddenKeys,
  setColumns,
}: {
  columns: ColumnDef[];
  hiddenKeys: Set<string>;
  setHiddenKeys: (s: Set<string>) => void;
  setColumns: (cols: ColumnDef[]) => void;
}) {
  const ids = columns.map((c) => c.key);

  return (
    <div>
      <div className="small" style={{ marginBottom: 8 }}>
        Drag to reorder. Hide columns you don’t want to show.
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={(evt) => {
          const { active, over } = evt;
          if (!over) return;
          if (active.id === over.id) return;

          const oldIndex = ids.indexOf(String(active.id));
          const newIndex = ids.indexOf(String(over.id));
          setColumns(arrayMove(columns, oldIndex, newIndex));
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {columns.map((c) => (
              <Item
                key={c.key}
                col={c}
                hidden={hiddenKeys.has(c.key)}
                toggleHidden={() => {
                  const next = new Set(hiddenKeys);
                  if (next.has(c.key)) next.delete(c.key);
                  else next.add(c.key);
                  setHiddenKeys(next);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
