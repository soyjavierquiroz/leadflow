import type { ReactNode } from "react";
import { EmptyState } from "@/components/app-shell/empty-state";

type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowClassName?: (row: T) => string;
  emptyEyebrow?: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  getRowClassName,
  emptyEyebrow,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <EmptyState
        eyebrow={emptyEyebrow}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-[1.85rem] border border-app-border bg-app-card text-left shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
          Vista operativa
        </p>
        <p className="text-xs font-medium text-app-text-soft">
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[920px] divide-y divide-app-border text-sm">
          <thead className="bg-app-surface-muted">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left font-semibold text-app-text-muted ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {rows.map((row, index) => (
              <tr
                key={index}
                className={`align-top transition hover:bg-app-surface-muted ${
                  getRowClassName?.(row) ?? ""
                }`}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-4 text-app-text-muted ${column.className ?? ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
