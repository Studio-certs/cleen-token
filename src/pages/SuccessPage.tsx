import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Feather as Ethereum, CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

function SuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<any>(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!sessionId) return;
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .single();

      if (!error && data) {
        setTransaction(data);
      }
    };

    fetchTransaction();
  }, [sessionId]);

  return (
    <div className="min-h-screen relative">
      {/* Background with overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=3432&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 via-emerald-900/90 to-teal-900/95"></div>
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="flex items-center justify-between mb-16 pt-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <Ethereum className="w-10 h-10 text-emerald-400" />
              <span className="text-3xl font-bold text-white tracking-tight">Cleen Tokens</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Home</span>
            </button>
          </header>

          {/* Success Content */}
          <main className="max-w-3xl mx-auto text-center">
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 border border-white/10">
              <CheckCircle className="w-20 h-20 text-emerald-400 mx-auto mb-8" />
              
              <h1 className="text-4xl font-bold text-white mb-6">
                Payment Successful!
              </h1>
              
              {transaction && (
                <div className="space-y-6">
                  <p className="text-xl text-gray-300">
                    You have successfully purchased {transaction.token_amount} Cleen Tokens
                  </p>
                  
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 max-w-md mx-auto">
                    <dl className="space-y-4 text-left">
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Amount Paid</dt>
                        <dd className="text-white font-medium">${transaction.amount_usd}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Wallet Address</dt>
                        <dd className="text-white font-medium font-mono text-sm">
                          {transaction.wallet_address.slice(0, 6)}...{transaction.wallet_address.slice(-4)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-400">Status</dt>
                        <dd className="text-emerald-400 font-medium">Completed</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}

              <div className="mt-8">
                <button
                  onClick={() => navigate('/')}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 
                           hover:from-emerald-600 hover:to-teal-700 text-white font-medium 
                           rounded-xl transition-all duration-200 shadow-lg 
                           shadow-emerald-500/25 hover:shadow-emerald-500/40"
                >
                  Return to Home
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default SuccessPage;