// @ts-nocheck
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function transferTokens(walletAddress: string, amount: string, supabaseClient: any, transactionId: string) {
  try {
    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      throw new Error('Invalid wallet address');
    }

    // Connect to provider and create wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Check provider connection
    await provider.getNetwork();
    
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    
    // Minimal ABI for token interactions
    const tokenABI = [
      "function transfer(address to, uint256 amount) returns (bool)",
      "function decimals() view returns (uint8)",
      "function balanceOf(address account) view returns (uint256)"
    ];
    
    const tokenContract = new ethers.Contract(TOKEN_CONTRACT_ADDRESS, tokenABI, wallet);
    
    // Get token decimals and admin balance
    const [decimals, adminBalance] = await Promise.all([
      tokenContract.decimals(),
      tokenContract.balanceOf(wallet.address)
    ]);
    
    // Calculate token amount with decimals
    const tokenAmount = ethers.parseUnits(amount.toString(), decimals);
    
    // Check if admin has enough balance
    if (adminBalance < tokenAmount) {
      throw new Error('Insufficient admin token balance');
    }
    
    // Update transaction status to processing
    await supabaseClient
      .from('transactions')
      .update({ status: 'processing' })
      .eq('id', transactionId);
    
    // Send transfer transaction
    const tx = await tokenContract.transfer(walletAddress, tokenAmount, {
      gasLimit: 100000 // Set reasonable gas limit
    });
    
    console.log('Transfer transaction sent:', tx.hash);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log('Transfer confirmed in block:', receipt.blockNumber);
    
    return receipt.hash;
  } catch (error) {
    console.error('Token transfer error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const signature = req.headers.get('stripe-signature');
  
  if (!signature || !endpointSecret) {
    return new Response(
      JSON.stringify({ error: !signature ? 'No signature provided' : 'Webhook secret not configured' }), 
      { 
        status: !signature ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body = await req.text();
    let event;
    
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }), 
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { transactionId, walletAddress, tokenAmount } = session.metadata;

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      try {
        // Perform token transfer
        const txHash = await transferTokens(
          walletAddress,
          tokenAmount,
          supabaseClient,
          transactionId
        );

        // Update transaction with success
        await supabaseClient
          .from('transactions')
          .update({ 
            status: 'completed',
            blockchain_tx_hash: txHash,
            completed_at: new Date().toISOString()
          })
          .eq('id', transactionId);

        console.log('Transaction completed successfully:', txHash);

      } catch (error) {
        console.error('Token transfer failed:', error);
        
        // Update transaction with error
        await supabaseClient
          .from('transactions')
          .update({ 
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', transactionId);

        // We don't throw here to still return 200 to Stripe
        // The error is logged and stored in the database
      }
    }

    return new Response(
      JSON.stringify({ received: true }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(
      JSON.stringify({ error: err.message }), 
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});