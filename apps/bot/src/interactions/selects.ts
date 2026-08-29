import type { SelectHandler } from "../registry.js";
import { startOpen } from "./openFlow.js";

const panelSelect: SelectHandler = {
  prefix: "panelSelect",
  async run(interaction) {
    const value = interaction.values[0];
    const categoryId = Number(value);
    if (Number.isNaN(categoryId)) return;
    await startOpen(interaction, categoryId);
  },
};

export const selectHandlers: SelectHandler[] = [panelSelect];
