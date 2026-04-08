import { notFound } from "next/navigation";
import { SystemTemplateEditor } from "@/components/system/system-template-editor";
import { getSystemTemplate } from "@/lib/system-tenants";

export const dynamic = "force-dynamic";

type AdminEditTemplatePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminEditTemplatePage({
  params,
}: AdminEditTemplatePageProps) {
  const { id } = await params;
  const template = await getSystemTemplate(id);

  if (!template) {
    notFound();
  }

  return <SystemTemplateEditor initialTemplate={template} />;
}
