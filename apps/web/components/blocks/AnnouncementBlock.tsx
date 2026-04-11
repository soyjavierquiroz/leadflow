type AnnouncementBlockProps = any;

export function AnnouncementBlock(props: AnnouncementBlockProps) {
  return (
    <section className="space-y-4 px-4 py-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-[0.24em] text-slate-400 uppercase">
          Base Block
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
          AnnouncementBlock
        </h2>
      </div>

      <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
        {JSON.stringify(props, null, 2)}
      </pre>
    </section>
  );
}
