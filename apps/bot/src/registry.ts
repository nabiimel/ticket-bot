import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  StringSelectMenuInteraction,
} from "discord.js";

export interface SlashCommand {
  data: {
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
    name: string;
  };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

/**
 * customId convention: "<prefix>:<arg>:<arg>...". A handler is matched by prefix
 * (the substring before the first ":") and receives the remaining segments.
 */
export interface ComponentHandler<I> {
  prefix: string;
  run(interaction: I, args: string[]): Promise<void>;
}

export type ButtonHandler = ComponentHandler<ButtonInteraction>;
export type SelectHandler = ComponentHandler<StringSelectMenuInteraction>;
export type ModalHandler = ComponentHandler<ModalSubmitInteraction>;

export function parseCustomId(customId: string): {
  prefix: string;
  args: string[];
} {
  const [prefix, ...args] = customId.split(":");
  return { prefix: prefix ?? "", args };
}
