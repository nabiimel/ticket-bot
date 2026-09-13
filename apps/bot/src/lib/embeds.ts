import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import {
  hexToInt,
  renderEmbedConfig,
  renderTemplate,
  type ButtonConfig,
  type ButtonStyleName,
  type CategoryConfig,
  type EmbedConfig,
  type PanelConfig,
  type TemplateContext,
} from "@ticketbot/shared";

const BUTTON_STYLE: Record<ButtonStyleName, ButtonStyle> = {
  Primary: ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success: ButtonStyle.Success,
  Danger: ButtonStyle.Danger,
};

/** Turn a dashboard EmbedConfig into a discord.js EmbedBuilder, resolving tokens. */
export function buildEmbed(
  cfg: EmbedConfig,
  ctx: TemplateContext,
): EmbedBuilder {
  const r = renderEmbedConfig(cfg, ctx);
  const embed = new EmbedBuilder();
  if (r.title) embed.setTitle(r.title.slice(0, 256));
  if (r.description) embed.setDescription(r.description.slice(0, 4096));
  embed.setColor(hexToInt(r.color));
  if (r.image) embed.setImage(r.image);
  if (r.thumbnail) embed.setThumbnail(r.thumbnail);
  if (r.footer?.text) {
    embed.setFooter({
      text: r.footer.text.slice(0, 2048),
      iconURL: r.footer.iconUrl || undefined,
    });
  }
  if (r.author?.name) {
    embed.setAuthor({
      name: r.author.name.slice(0, 256),
      iconURL: r.author.iconUrl || undefined,
      url: r.author.url || undefined,
    });
  }
  if (r.timestamp) embed.setTimestamp();
  return embed;
}

/**
 * Build the button rows / select menu for a panel message.
 * Panel-level text supports {guild.name} and, per option, {category.name} /
 * {category.key}. Per-user tokens can't resolve here (one message for everyone).
 */
export function buildPanelComponents(
  panel: PanelConfig,
  categories: CategoryConfig[],
  guildName = "",
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const ordered = panel.categoryIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is CategoryConfig => !!c);

  const catCtx = (c: CategoryConfig): TemplateContext => ({
    "guild.name": guildName,
    "category.name": c.label,
    "category.key": c.key,
  });
  const render = (s: string | null | undefined, c?: CategoryConfig) =>
    renderTemplate(
      s ?? undefined,
      c ? catCtx(c) : { "guild.name": guildName },
    ) ?? "";

  if (panel.style === "dropdown") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`panelSelect:${panel.id}`)
      .setPlaceholder(
        render(panel.dropdownPlaceholder) || "Select a ticket type…",
      )
      .addOptions(
        ordered.slice(0, 25).map((c) => {
          const opt = new StringSelectMenuOptionBuilder()
            .setLabel((render(c.label, c) || c.label).slice(0, 100))
            .setValue(String(c.id));
          const desc = render(c.description, c);
          if (desc) opt.setDescription(desc.slice(0, 100));
          if (c.emoji) opt.setEmoji(c.emoji);
          return opt;
        }),
      );
    return [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    ];
  }

  // Buttons: up to 5 per row, Discord max 5 rows.
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < ordered.length && rows.length < 5; i += 5) {
    const slice = ordered.slice(i, i + 5);
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const c of slice) {
      const bc: ButtonConfig = panel.buttons[String(c.id)] ?? {
        label: c.label,
        style: "Primary",
      };
      const label = render(bc.label || c.label, c) || c.label;
      const btn = new ButtonBuilder()
        .setCustomId(`open:${c.id}:${panel.id}`)
        .setLabel(label.slice(0, 80))
        .setStyle(BUTTON_STYLE[bc.style] ?? ButtonStyle.Primary)
        .setDisabled(c.disabled);
      if (bc.emoji || c.emoji) btn.setEmoji((bc.emoji || c.emoji)!);
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows;
}

/** Claim + Close buttons shown in the ticket channel. */
export function buildTicketControls(
  ticketId: number,
  opts: { claimed?: boolean; claimEnabled?: boolean } = {},
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  if (opts.claimEnabled !== false) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`claim:${ticketId}`)
        .setLabel("Claim")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!opts.claimed),
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`reserve:${ticketId}`)
      .setLabel("Reserve")
      .setEmoji("📌")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`close:${ticketId}`)
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`closeReason:${ticketId}`)
      .setLabel("Close with reason")
      .setStyle(ButtonStyle.Secondary),
  );
  return row;
}

/** Yes/No confirmation buttons for closing. */
export function buildCloseConfirm(
  ticketId: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`closeConfirm:${ticketId}:yes`)
      .setLabel("Close ticket")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`closeConfirm:${ticketId}:no`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );
}

/** Yes/No buttons for the pre-form "is this a reservation?" prompt. */
export function buildReservationChoice(
  categoryId: number,
  panelId: number | null,
  labels: { yesLabel: string; noLabel: string },
): ActionRowBuilder<ButtonBuilder> {
  const suffix = panelId != null ? `:${panelId}` : "";
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`reservationChoice:${categoryId}:yes${suffix}`)
      .setLabel(labels.yesLabel.slice(0, 80))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`reservationChoice:${categoryId}:no${suffix}`)
      .setLabel(labels.noLabel.slice(0, 80))
      .setStyle(ButtonStyle.Secondary),
  );
}

/** One person, or a multi-person order? Shown only after "yes, reservation". */
export function buildPersonCountChoice(
  categoryId: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`personCount:${categoryId}:one`)
      .setLabel("Just me")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`personCount:${categoryId}:multi`)
      .setLabel("Multiple people")
      .setStyle(ButtonStyle.Secondary),
  );
}

export const MAX_MULTI_PERSON = 10;

/** "How many people?" dropdown (2..MAX_MULTI_PERSON). */
export function buildPersonCountSelect(
  categoryId: number,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`personCountSelect:${categoryId}`)
    .setPlaceholder("How many people?");
  for (let n = 2; n <= MAX_MULTI_PERSON; n++) {
    select.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`${n} people`)
        .setValue(`${n}`),
    );
  }
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

/**
 * Button shown between each person's modal in a multi-person order — either
 * to continue to the next person, or (opts.retry) to redo one that failed
 * validation, since a modal submit can't reopen a modal on its own.
 */
export function buildPersonFormNext(
  categoryId: number,
  index: number,
  opts: { retry?: boolean } = {},
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`personFormNext:${categoryId}:${index}`)
      .setLabel(
        opts.retry
          ? `Try again — Person ${index}`
          : `Continue — Person ${index}`,
      )
      .setStyle(opts.retry ? ButtonStyle.Danger : ButtonStyle.Primary),
  );
}

/** 1–5 star rating buttons. */
export function buildRatingRow(
  ticketId: number,
): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let n = 1; n <= 5; n++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`rate:${ticketId}:${n}`)
        .setLabel("★".repeat(n))
        .setStyle(ButtonStyle.Secondary),
    );
  }
  return row;
}
