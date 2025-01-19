import type { Action } from "@elizaos/core";
import {
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    elizaLogger,
    composeContext,
    generateObject,
} from "@elizaos/core";
import { validateEvmConfig } from "../environment";

import {
    Address,
    createWalletClient,
    erc20Abi,
    http,
    parseEther,
    isAddress,
    parseUnits,
    createPublicClient,
} from "viem";
import { soneiumMinato } from "viem/chains";
import { z } from "zod";
import { ValidateContext } from "../utils";
import { ERC20_INFO } from "../constants";
import { useGetAccount, useGetWalletClient } from "../hooks";

const TransferSchema = z.object({
    tokenAddress: z.string(),
    recipient: z.string(),
    amount: z.string(),
});

export interface TransferContent extends Content {
    tokenAddress: string;
    recipient: string;
    amount: string | number;
}

const transferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Here are several frequently used addresses. Use these for the corresponding tokens:
- ASTR: 0x000000000000000000000000000000000000800A
- MAI: 0x8c8bE6BF04224507067791CD5989BC51137caCE6

Example response:
\`\`\`json
{
    "tokenAddress": "0x8c8bE6BF04224507067791CD5989BC51137caCE6",
    "recipient": "0xCCa8009f5e09F8C5dB63cb0031052F9CB635Af62",
    "amount": "1000"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested token transfer:
- Token contract address
- Recipient wallet address
- Amount to transfer

Respond with a JSON markdown block containing only the extracted values.`;

export const transferAction: Action = {
    name: "SEND_MAI",
    similes: [
        "SEND_TOKEN",
        "TRANSFER_TOKEN_ON_ABSTRACT",
        "TRANSFER_TOKENS_ON_ABSTRACT",
        "SEND_TOKENS_ON_ABSTRACT",
        "SEND_ETH_ON_ABSTRACT",
        "PAY_ON_ABSTRACT",
        "MOVE_TOKENS_ON_ABSTRACT",
        "MOVE_ETH_ON_ABSTRACT",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        await validateEvmConfig(runtime);
        return true;
    },
    description: "Transfer tokens from the agent's wallet to another address",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting Minato SEND_TOKEN handler...");

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Compose transfer context
        const transferContext = composeContext({
            state,
            template: transferTemplate,
        });

        // Generate transfer content
        const content = (
            await generateObject({
                runtime,
                context: transferContext,
                modelClass: ModelClass.SMALL,
                schema: TransferSchema,
            })
        ).object as unknown as TransferContent;

        // Validate transfer content
        if (!ValidateContext.transferAction(content)) {
            console.error("Invalid content for TRANSFER_TOKEN action.");
            if (callback) {
                callback({
                    text: "Unable to process transfer request. Invalid content provided.",
                    content: { error: "Invalid transfer content" },
                });
            }
            return false;
        }

        try {
            const account = useGetAccount(runtime);
            const walletClient = useGetWalletClient();

            // Convert amount to proper token decimals
            const tokenInfo = ERC20_INFO[content.tokenAddress.toLowerCase()];
            const decimals = tokenInfo?.decimals ?? 18; // Default to 18 decimals if not specified
            const tokenAmount = parseUnits(content.amount.toString(), decimals);

            // Execute ERC20 transfer
            const hash = await walletClient.writeContract({
                account,
                chain: soneiumMinato,
                address: content.tokenAddress as Address,
                abi: erc20Abi,
                functionName: "transfer",
                args: [content.recipient as Address, tokenAmount],
            });

            elizaLogger.success(
                "Transfer completed successfully! Transaction hash: " + hash
            );
            if (callback) {
                callback({
                    text:
                        "Transfer completed successfully! Transaction hash: " +
                        hash,
                    content: {},
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error during token transfer:", error);
            if (callback) {
                callback({
                    text: `Error transferring tokens: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Send 100 MAI to 0x114B242D931B47D5cDcEe7AF065856f70ee278C4",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Sure, I'll send 100 MAI to that address now.",
                    action: "SEND_MAI",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully sent 100 MAI to 0x114B242D931B47D5cDcEe7AF065856f70ee278C4\nTransaction: 0xdde850f9257365fffffc11324726ebdcf5b90b01c6eec9b3e7ab3e81fde6f14b",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "can you spare 1000 of your tokens to 0x114B242D931B47D5cDcEe7AF065856f70ee278C4",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Sure, I'll send 1000 MAI to that address now.",
                    action: "SEND_MAI",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully sent 1000 MAI to 0x114B242D931B47D5cDcEe7AF065856f70ee278C4\nTransaction: 0xdde850f9257365fffffc11324726ebdcf5b90b01c6eec9b3e7ab3e81fde6f14b",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Send 10000 MAI to 0xCCa8009f5e09F8C5dB63cb0031052F9CB635Af62",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Aren't you a bit greedy? Ask me less and I might send it.",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Please send 10 MAI to 0xbD8679cf79137042214fA4239b02F4022208EE82",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Of course. Sending 10 MAI to that address now.",
                    action: "SEND_MAI",
                },
            },
            {
                user: "{{agent}}",
                content: {
                    text: "Successfully sent 10 MAI to 0xbD8679cf79137042214fA4239b02F4022208EE82\nTransaction: 0x0b9f23e69ea91ba98926744472717960cc7018d35bc3165bdba6ae41670da0f0",
                },
            },
        ],
    ] as ActionExample[][],
};
