import { apiGet, type ResourcePreview, type ResourceSummary } from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { ResourceActions } from "./resource-actions";

export const dynamic = "force-dynamic";

export default async function ResourceDetailPage({
  params
}: Readonly<{ params: Promise<{ resourceId: string }> }>) {
  const { resourceId } = await params;
  const [{ resource }, { preview }] = await Promise.all([
    apiGet<{ resource: ResourceSummary }>(`/api/resources/${resourceId}`),
    apiGet<{ preview: ResourcePreview }>(`/api/resources/${resourceId}/preview`)
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={resource.title} description={resource.description ?? "Course material"} />

      <section className="grid gap-4 md:grid-cols-4" aria-label="Material summary">
        <Metric label="Course" value={`${resource.course.code} · ${resource.course.title}`} />
        <Metric label="Category" value={resource.category.label} />
        <Metric label="Visibility" value={visibilityLabel(resource.visibility)} />
        <Metric label="Downloads" value={resource.downloadCount.toString()} />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Current Version</h2>
        {resource.currentVersion ? (
          <dl className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-600">Filename</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {resource.currentVersion.originalFilename}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Size</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {formatBytes(resource.currentVersion.sizeBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">MIME type</dt>
              <dd className="mt-1 font-medium text-slate-950">
                {resource.currentVersion.mimeType}
              </dd>
            </div>
            <div className="md:col-span-3">
              <dt className="text-sm text-slate-600">SHA-256</dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-800">
                {resource.currentVersion.sha256}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No current file version is available.</p>
        )}
        {resource.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {resource.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <ResourceActions resourceId={resource.id} deletedAt={resource.deletedAt} />

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Preview</h2>
        <div className="mt-4">
          <PreviewSurface preview={preview} title={resource.title} />
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-950">Version History</h2>
        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Version</th>
                <th className="px-4 py-3 font-semibold">Filename</th>
                <th className="px-4 py-3 font-semibold">Size</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {resource.versions.map((version) => (
                <tr key={version.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 text-slate-700">v{version.versionNumber}</td>
                  <td className="px-4 py-3 text-slate-700">{version.originalFilename}</td>
                  <td className="px-4 py-3 text-slate-700">{formatBytes(version.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {new Date(version.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PreviewSurface(props: { preview: ResourcePreview; title: string }) {
  if (props.preview.kind === "pdf") {
    return (
      <iframe
        title={`${props.title} PDF preview`}
        src={props.preview.url}
        className="h-[70vh] w-full rounded-md border border-slate-200"
      />
    );
  }
  if (props.preview.kind === "image") {
    return (
      <img
        src={props.preview.url}
        alt={`${props.title} preview`}
        className="max-h-[70vh] max-w-full rounded-md border border-slate-200"
      />
    );
  }
  if (
    props.preview.kind === "markdown" ||
    props.preview.kind === "text" ||
    props.preview.kind === "notebook"
  ) {
    return (
      <div
        className="prose max-w-none rounded-md border border-slate-200 bg-slate-50 p-4 text-sm"
        dangerouslySetInnerHTML={{ __html: props.preview.html }}
      />
    );
  }
  return (
    <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      {props.preview.reason}
    </p>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{props.label}</div>
      <div className="mt-2 text-base font-semibold text-slate-950">{props.value}</div>
    </div>
  );
}

function visibilityLabel(value: ResourceSummary["visibility"]): string {
  if (value === "ALL_MEMBERS") return "All members";
  if (value === "PRIVATE") return "Private";
  return "Course members";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
