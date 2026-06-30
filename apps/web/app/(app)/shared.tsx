export function PageHeader(props: { title: string; description: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-semibold tracking-normal text-slate-950">{props.title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{props.description}</p>
    </section>
  );
}
