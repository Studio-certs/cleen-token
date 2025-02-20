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

// Minimal ERC20 ABI
const tokenABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

async function transferTokens(recipientAddress: string, amount: number): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, tokenABI, wallet);
    
    const decimals = await tokenContract.decimals();
    const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
    
    const tx = await tokenContract.transfer(recipientAddress, tokenAmount);
    const receipt = await tx.wait();
    
    return receipt.hash;
  } catch (error) {
    console.error('Token transfer failed:', error);
    throw error;
  }
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      endpointSecret
    );

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { transactionId, walletAddress, tokenAmount } = session.metadata;

      try {
        // Transfer tokens
        const txHash = await transferTokens(walletAddress, Number(tokenAmount));

        // Update transaction status and add transaction hash
        await supabaseClient
          .from('transactions')
          .update({ 
            status: 'completed',
            blockchain_tx_hash: txHash
          })
          .eq('id', transactionId);

      } catch (transferError) {
        console.error('Token transfer failed:', transferError);
        
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
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});