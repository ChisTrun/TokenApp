/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Buffer } from "buffer";
import * as web3 from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { getProvider } from "./utils";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";

window.Buffer = Buffer;

const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const metadataData = {
  name: "Kappa",
  symbol: "KAP",
  uri: "https://raw.githubusercontent.com/ChisTrun/Peint/refs/heads/master/metadata.json",
  sellerFeeBasisPoints: 0,
  creators: null,
  collection: null,
  uses: null,
};

const network = web3.clusterApiUrl("mainnet-beta");
console.log("Network:", network);
const provider = getProvider();
const connection = new web3.Connection(
  "https://muddy-distinguished-sea.solana-mainnet.quiknode.pro/d2b95ca59124154cce9ca521731e51dc72b06297/",
  "finalized"
);

function App() {
  const [walletPubkey, setWalletPubkey] = useState<web3.PublicKey | null>(null);

  const handleConnect = async () => {
    if (!provider) return;
    try {
      const address = await provider.connect();
      setWalletPubkey(address.publicKey);
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  async function buildTransferTransaction(
    sender: web3.PublicKey,
    receiver: web3.PublicKey,
    transferAmount: number
  ): Promise<web3.Transaction> {
    const transferInstruction = web3.SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: receiver,
      lamports: transferAmount * web3.LAMPORTS_PER_SOL,
    });

    const transaction = new web3.Transaction().add(transferInstruction);
    return transaction;
  }

  async function buildCreateMintTransaction(
    connection: web3.Connection,
    payer: web3.PublicKey,
    decimals: number
  ): Promise<{ transaction: web3.Transaction; accountKeypair: web3.Keypair }> {
    const lamports = await token.getMinimumBalanceForRentExemptMint(connection);
    const accountKeypair = web3.Keypair.generate();
    const programId = token.TOKEN_PROGRAM_ID;

    const metadataPDAAndBump = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        accountKeypair.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const metadataPDA = metadataPDAAndBump[0];

    const transaction = new web3.Transaction().add(
      web3.SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: accountKeypair.publicKey,
        space: token.MINT_SIZE,
        lamports,
        programId,
      }),
      token.createInitializeMintInstruction(
        accountKeypair.publicKey,
        decimals,
        payer,
        payer,
        programId
      ),
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataPDA,
          mint: accountKeypair.publicKey,
          mintAuthority: payer,
          payer: payer,
          updateAuthority: payer,
        },
        {
          createMetadataAccountArgsV3: {
            collectionDetails: null,
            data: metadataData,
            isMutable: true,
          },
        }
      )
    );
    return { transaction, accountKeypair };
  }

  const handleCreateToken = async () => {
    if (!walletPubkey || !provider) return;
    try {
      const { transaction, accountKeypair } = await buildCreateMintTransaction(
        connection,
        walletPubkey,
        9
      );
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPubkey;
      transaction.partialSign(accountKeypair);

      const { signature } = await provider.signAndSendTransaction(transaction);
      await connection.getSignatureStatus(signature);
      console.log("Token created:", accountKeypair.publicKey.toString());
    } catch (error) {
      console.error("Error creating token:", (error as Error).message);
    }
  };

  const handleTransfer = async () => {
    if (!walletPubkey || !provider) return;
    try {
      const sender = walletPubkey;
      const receiver = new web3.PublicKey(
        "Fjq4jmr998ZiSbp7Ba8A9pvV82guKi9ejFaAWQ16PAzM"
      );
      const amount = 1;

      const transaction = await buildTransferTransaction(
        sender,
        receiver,
        amount
      );
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = sender;

      const { signature } = await provider.signAndSendTransaction(transaction);
      await connection.getSignatureStatus(signature);
    } catch (error) {
      console.error("Error transferring token:", (error as Error).message);
    }
  };

  return (
    <div>
      <button onClick={handleConnect}>Connect Wallet</button>
      {walletPubkey && (
        <div>
          <p>Address: {walletPubkey.toString()}</p>
          <button onClick={handleCreateToken}>create token</button>
          <button onClick={handleTransfer}>transfer token</button>
        </div>
      )}
    </div>
  );
}

export default App;
