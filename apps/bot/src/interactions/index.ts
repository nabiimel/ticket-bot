import { buttonHandlers } from "./buttons.js";
import { selectHandlers } from "./selects.js";
import { modalHandlers } from "./modals.js";
import { quicksetupHandlers } from "./quicksetup.js";

/** Role / channel / user select menus (not string selects). */
export const componentSelectHandlers = [...quicksetupHandlers];

export { buttonHandlers, selectHandlers, modalHandlers };
