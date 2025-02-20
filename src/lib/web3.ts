import { ethers } from 'ethers';

// ERC20 Token ABI (minimal ABI for transfer function)
const tokenABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export async function transferTokens(
  recipientAddress: string, 
  amount: number,
  contractAddress: string,
  adminPrivateKey: string
): Promise<string> {
  try {
    // Connect to Ethereum network (you'll need to replace with your RPC URL)
    const provider = new ethers.JsonRpcProvider(import.meta.env.VITE_RPC_URL);
    
    // Create wallet instance from admin private key
    const wallet = new ethers.Wallet(adminPrivateKey, provider);
    
    // Create contract instance
    const tokenContract = new ethers.Contract(contractAddress, tokenABI, wallet);
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Convert amount to token units
    const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
    
    // Send transfer transaction
    const tx = await tokenContract.transfer(recipientAddress, tokenAmount);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    return receipt.hash;
  } catch (error) {
    console.error('Token transfer failed:', error);
    throw error;
  }
}