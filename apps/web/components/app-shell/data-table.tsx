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
  emptyEyebrow?: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
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
    <div className="w-full overflow-hidden rounded-[1.85rem] border border-slate-200 bg-white text-left shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Vista operativa
        </p>
        <p className="text-xs font-medium text-slate-500">
          {rows.length} registro{rows.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left font-semibold text-slate-600 ${column.className ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index} className="align-top transition hover:bg-slate-50/80">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-4 text-slate-700 ${column.className ?? ""}`}
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
