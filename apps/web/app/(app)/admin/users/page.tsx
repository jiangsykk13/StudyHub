import Link from "next/link";
import { apiGet, type AdminUserSummary, type AuthMe } from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { AdminUsersClient } from "./admin-users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams
}: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  const me = await apiGet<AuthMe>("/api/auth/me");
  if (me.user.role !== "SYSTEM_ADMIN") {
    return (
      <PageHeader
        title="User administration"
        description="System administrator access is required for user administration."
      />
    );
  }

  const params = await searchParams;
  const query = firstParam(params.q);
  const page = Number(firstParam(params.page) ?? "1");
  const pageSize = 20;
  const userQuery = new URLSearchParams({
    page: String(Number.isFinite(page) && page > 0 ? page : 1),
    pageSize: String(pageSize)
  });
  if (query) userQuery.set("q", query);
  const result = await apiGet<{
    users: AdminUserSummary[];
    page: number;
    pageSize: number;
    total: number;
  }>(`/api/admin/users?${userQuery.toString()}`);
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="User administration"
        description="Search users, inspect roles and memberships, disable accounts, and revoke sessions."
      />
      <form className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 md:flex-row md:items-end">
        <label className="block flex-1 text-sm font-medium text-slate-700">
          Search users
          <input
            name="q"
            defaultValue={query ?? ""}
            placeholder="Name or email"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>
      </form>
      <AdminUsersClient users={result.users} />
      <Pagination
        basePath="/admin/users"
        params={userQuery}
        page={result.page}
        pageCount={pageCount}
        total={result.total}
        label="users"
      />
    </div>
  );
}

function Pagination(props: {
  basePath: string;
  params: URLSearchParams;
  page: number;
  pageCount: number;
  total: number;
  label: string;
}) {
  return (
    <nav className="flex items-center justify-between text-sm" aria-label="User pagination">
      <div className="text-slate-600">
        Page {props.page} of {props.pageCount} · {props.total} {props.label}
      </div>
      <div className="flex gap-2">
        <PageLink
          {...props}
          labelText="Previous"
          disabled={props.page <= 1}
          nextPage={props.page - 1}
        />
        <PageLink
          {...props}
          labelText="Next"
          disabled={props.page >= props.pageCount}
          nextPage={props.page + 1}
        />
      </div>
    </nav>
  );
}

function PageLink(props: {
  basePath: string;
  params: URLSearchParams;
  labelText: string;
  disabled: boolean;
  nextPage: number;
}) {
  const nextParams = new URLSearchParams(props.params);
  nextParams.set("page", String(props.nextPage));
  return props.disabled ? (
    <span className="rounded-md border border-slate-200 px-3 py-2 text-slate-400">
      {props.labelText}
    </span>
  ) : (
    <Link
      href={`${props.basePath}?${nextParams.toString()}`}
      className="rounded-md border border-slate-300 px-3 py-2 text-slate-800"
    >
      {props.labelText}
    </Link>
  );
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}
