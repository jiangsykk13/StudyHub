import { apiGet, type CourseSummary } from "../../../../lib/api";
import { PageHeader } from "../../shared";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const [courseResult, categoryResult] = await Promise.all([
    apiGet<{ courses: CourseSummary[] }>("/api/courses"),
    apiGet<{ categories: Array<{ key: string; label: string }> }>("/api/resources/categories")
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload material"
        description="Upload a validated file into private storage for an authorized course."
      />
      <UploadForm courses={courseResult.courses} categories={categoryResult.categories} />
    </div>
  );
}
