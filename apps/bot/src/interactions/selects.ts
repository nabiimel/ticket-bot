import type { SelectHandler } from "../registry.js";
import { startOpen } from "./openFlow.js";

const panelSelect: SelectHandler = {
  prefix: "panelSelect",
  async run(interaction, args) {
    const value = interaction.values[0];
    const categoryId = Number(value);
    if (Number.isNaN(categoryId)) return;
    // customId is `panelSelect:<panelId>`.
    const panelId = args[0] ? Number(args[0]) : null;
    await startOpen(
      interaction,
      categoryId,
      Number.isNaN(panelId as number) ? null : panelId,
    );
  },
};

export const selectHandlers: SelectHandler[] = [panelSelect];
