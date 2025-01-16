import { Plugin } from "@elizaos/core";

import { transferAction } from "./actions";

export const minatoPlugin: Plugin = {
    name: "minato",
    description: "Minato Plugin for Eliza",
    actions: [transferAction],
    evaluators: [],
    providers: [],
};

export default minatoPlugin;
