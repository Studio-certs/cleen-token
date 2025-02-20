import React, { useState } from 'react';
import { Feather as Ethereum, ArrowRight, Wallet } from 'lucide-react';

function App() {
  const [walletAddress, setWalletAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Wallet address:', walletAddress);
  };

  return (
    <div className="min-h-screen relative">
      {/* Background image with overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=3432&auto=format&fit=crop')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/95 via-purple-900/90 to-blue-900/95"></div>
      </div>

      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <header className="flex items-center mb-16 pt-6">
            <div className="flex items-center space-x-2">
              <Ethereum className="w-10 h-10 text-blue-400" />
              <span className="text-3xl font-bold text-white tracking-tight">Cleen Tokens</span>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-3xl mx-auto text-center">
            <div className="space-y-6 mb-12">
              <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
                The Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Digital Assets</span>
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto">
                Join the next generation of cryptocurrency trading with Cleen Tokens. 
                Your gateway to the future of digital finance.
              </p>
            </div>

            {/* Wallet Input Form */}
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="wallet" className="block text-left text-gray-300 text-sm font-medium mb-2">
                    Wallet Address
                  </label>
                  <div className="relative group">
                    <input
                      id="wallet"
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="Enter your wallet address"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl
                               text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                               focus:ring-blue-400/50 focus:border-transparent transition-all duration-200"
                    />
                    <Wallet className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 group-hover:text-blue-400 transition-colors duration-200" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 
                           hover:to-purple-700 text-white font-medium py-3 px-6 rounded-xl
                           transition-all duration-200 flex items-center justify-center space-x-2
                           shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                >
                  <span>Purchase Tokens</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              {[
                {
                  title: 'Secure Trading',
                  description: 'Advanced encryption and blockchain security for your transactions'
                },
                {
                  title: 'Instant Processing',
                  description: 'Lightning-fast token purchases with real-time blockchain confirmation'
                },
                {
                  title: 'Portfolio Growth',
                  description: 'Track your investments and watch your digital assets grow'
                }
              ].map((feature, index) => (
                <div key={index} className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 transition-colors duration-200">
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-300">{feature.description}</p>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;