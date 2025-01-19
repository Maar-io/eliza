import { createWalletClient, http } from "viem";
import { soneiumMinato } from "viem/chains";

export const useGetWalletClient = (): ReturnType<typeof createWalletClient> => {
    const client = createWalletClient({
        chain: soneiumMinato,
        transport: http(),
    });

    return client;
};
