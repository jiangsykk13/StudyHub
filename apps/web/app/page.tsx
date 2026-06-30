import Link from "next/link";
import { branding } from "@studyhub/config";

const primaryRoutes = ["/dashboard", "/courses", "/materials", "/notes", "/favorites", "/profile"];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <nav className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <Link href="/" className="text-xl font-semibold text-slate-950">
          {branding.productName}
        </Link>
        <div className="flex gap-3 text-sm font-medium">
          <Link className="rounded-md border border-slate-300 px-3 py-2" href="/login">
            Log in
          </Link>
          <Link className="rounded-md bg-slate-950 px-3 py-2 text-white" href="/register">
            Register
          </Link>
        </div>
      </nav>
      <section className="grid flex-1 place-items-center py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">
            Invitation-only student workspace
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-slate-950 md:text-6xl">
            Private course materials, notes, and admin controls.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            Access requires an invitation and every protected material action is authorized by the
            API. This scaffold is ready for the milestone slices that add authentication, courses,
            storage, notes, and auditing.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {primaryRoutes.map((route) => (
              <Link
                key={route}
                href={route}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm"
              >
                {route}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
