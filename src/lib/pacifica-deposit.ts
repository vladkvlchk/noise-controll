import {
  PublicKey,
  TransactionInstruction,
  Transaction,
  Connection,
} from "@solana/web3.js";
import { createHash } from "crypto";

const PROGRAM_ID = new PublicKey("PCFA5iYgmqK6MqPhWNKg7Yv7auX7VZ4Cx7T1eJyrAMH");
const CENTRAL_STATE = new PublicKey("9Gdmhq4Gv1LnNMp7aiS1HSVd7pNnXNMsbuXALCQRmGjY");
const PACIFICA_VAULT = new PublicKey("72R843XwZxqWhsJceARQQTTbYtWy6Zw9et2YV4FpRHTa");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

function getDiscriminator(name: string): Buffer {
  const hash = createHash("sha256").update(`global:${name}`).digest();
  return Buffer.from(hash.subarray(0, 8));
}

function getAssociatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return ata;
}

function buildDepositInstructionData(amount: number): Buffer {
  const discriminator = getDiscriminator("deposit");
  const amountBuf = new ArrayBuffer(8);
  new DataView(amountBuf).setBigUint64(0, BigInt(Math.round(amount * 1_000_000)), true);
  return Buffer.concat([discriminator, Buffer.from(amountBuf)]);
}

export function buildDepositInstruction(
  depositor: PublicKey,
  amount: number,
): TransactionInstruction {
  const userUsdcAta = getAssociatedTokenAddress(depositor, USDC_MINT);
  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    PROGRAM_ID,
  );

  const keys = [
    { pubkey: depositor, isSigner: true, isWritable: true },
    { pubkey: userUsdcAta, isSigner: false, isWritable: true },
    { pubkey: CENTRAL_STATE, isSigner: false, isWritable: true },
    { pubkey: PACIFICA_VAULT, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: eventAuthority, isSigner: false, isWritable: false },
    { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: buildDepositInstructionData(amount),
  });
}

export async function buildDepositTransaction(
  depositor: PublicKey,
  amount: number,
  connection: Connection,
): Promise<Transaction> {
  const ix = buildDepositInstruction(depositor, amount);
  const tx = new Transaction().add(ix);
  tx.feePayer = depositor;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  return tx;
}
