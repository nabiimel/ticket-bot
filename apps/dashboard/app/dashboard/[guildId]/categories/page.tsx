import { db, repos } from "@/lib/db";
import { requireGuildAccess } from "@/lib/guild-access";
import { CategoryCreateForm } from "@/components/CategoryCreateForm";
import { CategoryList } from "@/components/CategoryList";
import { PageHeader } from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  params,
}: {
  params: { guildId: string };
}) {
  const { guildId } = params;
  await requireGuildAccess(guildId, "editor");
  const cats = repos.categories.listCategories(db(), guildId);

  return (
    <div className="page max-w-4xl">
      <PageHeader
        title="Categories"
        description="Ticket types — each with its own staff, form, and welcome message."
      />
      <CategoryCreateForm guildId={guildId} />
      <CategoryList guildId={guildId} initial={cats} />
    </div>
  );
}
