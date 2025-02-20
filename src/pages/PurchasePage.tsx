import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Feather as Ethereum, ArrowLeft, Coins } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { stripePromise } from '../lib/stripe';

const TOKEN_OPTIONS = [10, 50, 100, 150, 200, 250];
const PRICE_PER_TOKEN = 1; // Price in USD per token

function PurchasePage() {
  const { walletAddress } = useParams();
  const navigate = useNavigate();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = async () => {
    if (!selectedAmount || !walletAddress || isProcessing) return;

    try {
      setIsProcessing(true);

      // Create a transaction record
      const { data: transaction, error: dbError } = await supabase
        .from('transactions')
        .insert({
          wallet_address: walletAddress,
          token_amount: selectedAmount,
          amount_usd: selectedAmount * PRICE_PER_TOKEN,
          status: 'pending'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Create Stripe checkout session using Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            tokenAmount: selectedAmount,
            walletAddress,
            transactionId: transaction.id
          }),
        }
      );

      const { sessionId, error } = await response.json();
      if (error) throw new Error(error);
      
      // Redirect to Stripe checkout
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to load');

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId
      });

      if (stripeError) throw stripeError;

    } catch (error) {
      console.error('Purchase error:', error);
      alert('Failed to process purchase. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Background image with overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1642790106117-e829e14a795f?q=80&w=3432&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/95 via-purple-900/90 to-blue-900/95"></div>
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="flex items-center justify-between mb-16 pt-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <Ethereum className="w-10 h-10 text-blue-400" />
              <span className="text-3xl font-bold text-white tracking-tight">Cleen Tokens</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
          </header>

          {/* Main Content */}
          <main className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-5xl font-bold text-white mb-6">
                Select Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Token Amount</span>
              </h1>
              <p className="text-gray-300 text-lg">
                Tokens will be sent to: <span className="font-mono bg-white/10 px-3 py-1 rounded-lg">{walletAddress}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {TOKEN_OPTIONS.map((amount) => (
                <div
                  key={amount}
                  onClick={() => setSelectedAmount(amount)}
                  className={`relative group cursor-pointer transform hover:scale-105 transition-all duration-200
                    ${selectedAmount === amount 
                      ? 'ring-2 ring-blue-400 bg-white/15' 
                      : 'bg-white/10 hover:bg-white/15'
                    } backdrop-blur-xl rounded-2xl p-6 border border-white/10`}
                >
                  <div className="absolute -top-3 -right-3">
                    <Coins className={`w-6 h-6 ${
                      selectedAmount === amount ? 'text-blue-400' : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="text-center">
                    <h3 className="text-4xl font-bold text-white mb-2">{amount}</h3>
                    <p className="text-gray-300">Tokens</p>
                    <div className="mt-4">
                      <span className="text-sm text-gray-400">Price</span>
                      <p className="text-xl font-semibold text-white">${amount * PRICE_PER_TOKEN}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <button
                onClick={handlePurchase}
                disabled={!selectedAmount || isProcessing}
                className={`px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-200
                  ${selectedAmount && !isProcessing
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white cursor-pointer shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {isProcessing
                  ? 'Processing...'
                  : selectedAmount
                    ? `Purchase ${selectedAmount} Tokens for $${selectedAmount * PRICE_PER_TOKEN}`
                    : 'Select an amount to purchase'}
              </button>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="text-xl font-semibold text-white mb-4">Purchase Information</h3>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex justify-between">
                    <span>Payment Method</span>
                    <span className="font-medium">Credit/Debit Card</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Processing Time</span>
                    <span className="font-medium">Instant</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Token Delivery</span>
                    <span className="font-medium">Within 24 hours</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="text-xl font-semibold text-white mb-4">Token Information</h3>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex justify-between">
                    <span>Token Standard</span>
                    <span className="font-medium">ERC-20</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Token Type</span>
                    <span className="font-medium">Utility Token</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Network</span>
                    <span className="font-medium">Ethereum</span>
                  </li>
                </ul>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default PurchasePage;