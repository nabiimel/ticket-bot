import type { SelectHandler } from "../registry.js";
import { handlePersonCountSelect, startOpen } from "./openFlow.js";

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

const personCountSelectHandler: SelectHandler = {
  prefix: "personCountSelect",
  async run(interaction, args) {
    const categoryId = Number(args[0]);
    if (Number.isNaN(categoryId)) return;
    await handlePersonCountSelect(interaction, categoryId);
  },
};

export const selectHandlers: SelectHandler[] = [
  panelSelect,
  personCountSelectHandler,
];
