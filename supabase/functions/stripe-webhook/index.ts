import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import Stripe from 'https://esm.sh/stripe@14.18.0?target=deno';
import { ethers } from 'https://esm.sh/ethers@6.11.1?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const TOKEN_CONTRACT_ADDRESS = Deno.env.get('TOKEN_CONTRACT_ADDRESS');
const ADMIN_PRIVATE_KEY = Deno.env.get('ADMIN_PRIVATE_KEY');
const RPC_URL = Deno.env.get('RPC_URL');

// Validate required environment variables
if (!endpointSecret) {
  console.error('Missing STRIPE_WEBHOOK_SECRET');
}
if (!TOKEN_CONTRACT_ADDRESS) {
  console.error('Missing TOKEN_CONTRACT_ADDRESS');
}
if (!ADMIN_PRIVATE_KEY) {
  console.error('Missing ADMIN_PRIVATE_KEY');
}
if (!RPC_URL) {
  console.error('Missing RPC_URL');
}

const tokenABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function owner() view returns (address)",
  "function mint(address to, uint256 amount)",
  "function transfer(address to, uint256 value) returns (bool)"
];

async function transferTokens(recipientAddress: string, amount: number): Promise<string> {
  console.log('Starting token transfer:', { recipientAddress, amount });
  
  try {
    if (!RPC_URL || !TOKEN_CONTRACT_ADDRESS || !ADMIN_PRIVATE_KEY) {
      throw new Error('Missing required environment variables for token transfer');
    }

    console.log('Connecting to provider:', RPC_URL);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log('Creating wallet instance');
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    console.log('Wallet address:', wallet.address);
    
    console.log('Creating contract instance:', TOKEN_CONTRACT_ADDRESS);
    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, tokenABI, wallet);
    
    console.log('Getting token decimals');
    const decimals = await tokenContract.decimals();
    console.log('Token decimals:', decimals);
    
    console.log('Calculating token amount with decimals:', decimals);
    const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
    console.log('Token amount in wei:', tokenAmount.toString());
    
    // Check if we should use mint or transfer
    console.log('Checking contract ownership');
    const ownerAddress = await tokenContract.owner();
    console.log('Contract owner:', ownerAddress);
    console.log('Wallet address:', wallet.address);
    const usesMint = ownerAddress.toLowerCase() === wallet.address.toLowerCase();
    
    console.log('Transaction type:', usesMint ? 'mint' : 'transfer');

    let tx;
    if (usesMint) {
      console.log('Minting new tokens');
      tx = await tokenContract.mint(recipientAddress, tokenAmount);
    } else {
      console.log('Transferring existing tokens');
      const balance = await tokenContract.balanceOf(wallet.address);
      console.log('Current balance:', balance.toString());
      if (balance < tokenAmount) {
        throw new Error('Insufficient balance for transfer');
      }
      tx = await tokenContract.transfer(recipientAddress, tokenAmount);
    }
    
    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    
    console.log('Transfer successful:', receipt.hash);
    return receipt.hash;
  } catch (error) {
    console.error('Token transfer failed:', error);
    throw error;
  }
}

serve(async (req) => {
  console.log('Received webhook request');
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return new Response('No signature', { status: 400 });
  }

  if (!endpointSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET environment variable');
    return new Response('Configuration error', { status: 500 });
  }

  try {
    const body = await req.text();
    console.log('Constructing Stripe event');
    console.log('Signature:', signature);
    console.log('Endpoint secret length:', endpointSecret.length);
    
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      endpointSecret
    );

    console.log('Event processed successfully:', event.type);

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
        console.log('Initiating token transfer');
        const txHash = await transferTokens(walletAddress, Number(tokenAmount));

        console.log('Updating transaction status');
        const { error: updateError } = await supabaseClient
          .from('transactions')
          .update({ 
            status: 'completed',
            blockchain_tx_hash: txHash
          })
          .eq('id', transactionId);

        if (updateError) {
          console.error('Failed to update transaction:', updateError);
          throw updateError;
        }

        console.log('Transaction updated successfully');
      } catch (transferError) {
        console.error('Token transfer failed:', transferError);
        
        const { error: updateError } = await supabaseClient
          .from('transactions')
          .update({ 
            status: 'failed',
            error_message: transferError.message
          })
          .eq('id', transactionId);

        if (updateError) {
          console.error('Failed to update transaction status:', updateError);
        }
          
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