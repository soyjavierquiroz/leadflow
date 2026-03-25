import type { ReactNode } from "react";

type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyTitle: string;
  emptyDescription: string;
};

export function DataTable<T>({
  columns,
  rows,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h3 className="text-lg font-semibold text-slate-950">{emptyTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.85rem] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
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
