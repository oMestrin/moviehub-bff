import { defineInterface } from "../../shared/kernel/defineInterface.js";

/** Porta de saída — relógio. now() -> Date */
export const Clock = defineInterface("Clock", ["now"]);
