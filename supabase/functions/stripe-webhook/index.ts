import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import Stripe from 'https://esm.sh/stripe@14.18.0?target=deno';
import { ethers } from 'https://esm.sh/ethers@6.11.1?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

// Token contract configuration
const TOKEN_CONTRACT_ADDRESS = Deno.env.get('TOKEN_CONTRACT_ADDRESS') ?? '';
const ADMIN_PRIVATE_KEY = Deno.env.get('ADMIN_PRIVATE_KEY') ?? '';
const RPC_URL = Deno.env.get('RPC_URL') ?? '';

// Full ERC20 ABI with mint function
const tokenABI = [
  // Read-only functions
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  
  // State-changing functions
  "function transfer(address to, uint256 value) returns (bool)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
  "function mint(address to, uint256 amount)",
  
  // Events
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

async function transferTokens(recipientAddress: string, amount: number): Promise<string> {
  console.log('Starting token transfer:', { recipientAddress, amount });
  
  try {
    console.log('Connecting to provider:', RPC_URL);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log('Creating wallet instance');
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    
    console.log('Creating contract instance:', TOKEN_CONTRACT_ADDRESS);
    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, tokenABI, wallet);
    
    console.log('Getting token decimals');
    const decimals = await tokenContract.decimals();
    
    console.log('Calculating token amount with decimals:', decimals);
    const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
    
    // Check if we should use mint or transfer
    const ownerAddress = await tokenContract.owner();
    const usesMint = ownerAddress.toLowerCase() === wallet.address.toLowerCase();
    
    console.log('Transaction type:', usesMint ? 'mint' : 'transfer');
    let tx;
    if (usesMint) {
      // If we're the owner, mint new tokens
      tx = await tokenContract.mint(recipientAddress, tokenAmount);
    } else {
      // Otherwise transfer existing tokens
      tx = await tokenContract.transfer(recipientAddress, tokenAmount);
    }
    
    console.log('Waiting for transaction confirmation');
    const receipt = await tx.wait();
    
    console.log('Transfer successful:', receipt.hash);
    return receipt.hash;
  } catch (error) {
    console.error('Token transfer failed:', error);
    throw error;
  }
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.log('Missing Stripe signature');
    return new Response('No signature', { status: 400 });
  }

  try {
    console.log('Processing webhook request');
    const body = await req.text();
    
    console.log('Constructing Stripe event');
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      endpointSecret
    );

    console.log('Event type:', event.type);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { transactionId, walletAddress, tokenAmount } = session.metadata;

      console.log('Processing completed checkout:', {
        transactionId,
        walletAddress,
        tokenAmount
      });

      try {
        // Transfer tokens
        console.log('Initiating token transfer');
        const txHash = await transferTokens(walletAddress, Number(tokenAmount));

        console.log('Updating transaction status');
        // Update transaction status and add transaction hash
        await supabaseClient
          .from('transactions')
          .update({ 
            status: 'completed',
            blockchain_tx_hash: txHash
          })
          .eq('id', transactionId);

        console.log('Transaction updated successfully');

      } catch (transferError) {
        console.error('Token transfer failed:', transferError);
        
        console.log('Updating transaction with error status');
        // Update transaction with error status
        await supabaseClient
          .from('transactions')
          .update({ 
            status: 'failed',
            error_message: transferError.message
          })
          .eq('id', transactionId);
          
        throw transferError;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});