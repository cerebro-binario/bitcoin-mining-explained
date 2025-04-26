export interface TransactionInput {
  txid: string;
  vout: number;
  scriptSig: string;
  address: string;
  amount: number;
  utxoReference?: {
    txid: string;
    vout: number;
  };
}

export interface TransactionOutput {
  amount: number;
  address: string;
  scriptPubKey: string;
}

export interface Transaction {
  id: string;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  fees: number;
  volume: number;
  coinbaseMessage?: string;
  timestamp: number;
}

export interface Block {
  height: number;
  version: number;
  hash: string;
  previousHash: string;
  merkleRoot: string;
  timestamp: number;
  bits: number;
  nonce: number;
  transactions: Transaction[];
  reward: number;
  validationResult?: ValidationResult;
  miningTime: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
