import Link from "next/link";
import { notFound } from "next/navigation";
import { db, repos } from "@/lib/db";
import {
  categoryChannels,
  getGuildChannels,
  getGuildRoles,
} from "@/lib/discord";
import { CategoryEditor } from "@/components/CategoryEditor";

export const dynamic = "force-dynamic";

export default async function CategoryEditPage({
  params,
}: {
  params: { guildId: string; categoryId: string };
}) {
  const { guildId } = params;
  const category = repos.categories.getCategory(
    db(),
    Number(params.categoryId),
  );
  if (!category || category.guildId !== guildId) notFound();

  const [roles, channels] = await Promise.all([
    getGuildRoles(guildId),
    getGuildChannels(guildId),
  ]);

  return (
    <div className="space-y-4">
      <Link
        href={`/dashboard/${guildId}/categories`}
        className="text-xs text-faint hover:text-dim"
      >
        ← Categories
      </Link>
      <h1 className="text-2xl font-bold">{category.label}</h1>
      <CategoryEditor
        guildId={guildId}
        category={category}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        parents={categoryChannels(channels).map((c) => ({
          id: c.id,
          name: c.name,
        }))}
      />
    </div>
  );
}
