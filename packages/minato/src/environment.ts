import { IAgentRuntime } from "@elizaos/core";
import { isAddress } from "viem";
import { z } from "zod";

export const evmEnvSchema = z.object({
    EVM_ADDRESS: z
        .string()
        .min(1, "EVM address is required")
        .refine((address) => isAddress(address, { strict: false }), {
            message: "EVM address must be a valid address",
        }),
    EVM_PRIVATE_KEY: z
        .string()
        .min(1, "EVM private key is required")
        .refine((key) => /^[a-fA-F0-9]{64}$/.test(key), {
            message:
                "EVM private key must be a 64-character hexadecimal string (32 bytes) without the '0x' prefix",
        }),
});

export type EVMConfig = z.infer<typeof evmEnvSchema>;

export async function validateEVMConfig(
    runtime: IAgentRuntime
): Promise<EVMConfig> {
    try {
        const config = {
            EVM_ADDRESS: runtime.getSetting("EVM_ADDRESS"),
            EVM_PRIVATE_KEY: runtime.getSetting("EVM_PRIVATE_KEY"),
        };

        return evmEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `EVM configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
