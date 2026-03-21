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
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h3 className="text-lg font-semibold text-slate-950">{emptyTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
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
              <tr key={index} className="align-top">
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
