// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ShieldCheck, Wallet as WalletIcon, Lock, Gift, AlertTriangle, Loader2, CheckCircle2, Coins } from 'lucide-react';
import { SecurityPolicyModal } from '../components/SecurityPolicyModal';

export function Wallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [checkoutPlan, setCheckoutPlan] = useState<{ days: number; cost: number; usdCost: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState<{ days: number; untilStr: string } | null>(null);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      // Local Guest / Demo fallback to prevent stuck loaders
      const localUsd = localStorage.getItem('local_wallet_usd') || '10.00';
      const localNaira = localStorage.getItem('local_wallet_naira') || '16000';
      const localTk = localStorage.getItem('local_wallet_tk') || '50.00';
      const localWithdrawable = localStorage.getItem('local_wallet_withdrawable') || '8000';

      // Always save back to guarantee presence
      localStorage.setItem('local_wallet_usd', localUsd);
      localStorage.setItem('local_wallet_naira', localNaira);
      localStorage.setItem('local_wallet_tk', localTk);
      localStorage.setItem('local_wallet_withdrawable', localWithdrawable);

      setWallet({
        balance_usd: parseFloat(localUsd),
        balance_naira: parseInt(localNaira),
        tk_balance: parseFloat(localTk),
        withdrawable_balance: parseInt(localWithdrawable),
        is_ads_free: false,
      });

      // Load local transactions
      const localTxStr = localStorage.getItem('local_wallet_transactions');
      if (localTxStr) {
        try {
          setTransactions(JSON.parse(localTxStr));
        } catch {
          setTransactions([]);
        }
      } else {
        // Default historical transactions
        const mockTx = [
          { id: '1', type: 'funding', amount_naira: 10000, amount_usd: 6.25, created_at: new Date(Date.now() - 3600000 * 24).toISOString() },
          { id: '2', type: 'tip', amount_naira: 6000, amount_usd: 3.75, created_at: new Date().toISOString() },
        ];
        localStorage.setItem('local_wallet_transactions', JSON.stringify(mockTx));
        setTransactions(mockTx);
      }
      return;
    }

    const fetchWallet = async () => {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
      if (data) {
        setWallet(data);
      } else {
        // Fallback inside supabase context if single query returns null
        setWallet({
          balance_usd: 10.00,
          balance_naira: 16000,
          tk_balance: 50.00,
          withdrawable_balance: 8000
        });
      }
    };
    
    const fetchTx = async () => {
      const { data } = await supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      setTransactions(data || []);
    };

    fetchWallet();
    fetchTx();

    const ch = supabase
      .channel('wallet-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, () => fetchWallet())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.id}` }, () => fetchTx())
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const handleAdsFree = async (days: number, cost: number) => {
    const usdCost = days === 1 ? 0.50 : days === 7 ? 2.50 : 8.00;
    setCheckoutPlan({ days, cost, usdCost });
  };

  const executeAdsFreePurchase = async () => {
    if (!checkoutPlan) return;
    const { days, cost, usdCost } = checkoutPlan;
    setIsProcessing(true);
    const untilStr = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    try {
      if (user) {
        // Fetch current real-time wallet from Supabase
        const { data: currentWallet, error: fetchErr } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchErr || !currentWallet) {
          alert("Error fetching wallet data: " + (fetchErr?.message || "Wallet not found"));
          setIsProcessing(false);
          return;
        }

        let currentNaira = Number(currentWallet.balance_naira || 0);
        let currentUsd = Number(currentWallet.balance_usd || 0);

        if (currentNaira < cost) {
          const grantKey = `premium_demo_grant_claimed_${user.id}`;
          const alreadyClaimed = localStorage.getItem(grantKey) === 'true';

          if (alreadyClaimed) {
            alert(`Insufficient balance. You currently have ₦${currentNaira.toLocaleString()}, but you need ₦${cost.toLocaleString()} to upgrade.\n\nYou have already claimed your once-in-a-lifetime free ₦1,000 Demo Producer Grant. Please fund your wallet to proceed.`);
            setIsProcessing(false);
            return;
          }

          // Automatically inject free demo grant
          currentNaira += 1000;
          currentUsd += 0.60;
          localStorage.setItem(grantKey, 'true');
          
          // Log the grant injection transaction
          await supabase.from('wallet_transactions').insert({
            user_id: user.id,
            amount_naira: 1000,
            amount_usd: 0.60,
            type: 'revenue',
            description: "Instantly Claimed: Once-in-a-lifetime ₦1,000 Demo Grant"
          });
          
          const { error: grantErr } = await supabase
            .from('wallets')
            .update({
              balance_naira: currentNaira,
              balance_usd: currentUsd
            })
            .eq('user_id', user.id);

          if (grantErr) {
            alert("Error applying grant: " + grantErr.message);
            setIsProcessing(false);
            return;
          }
        }

        const nextNaira = currentNaira - cost;
        const nextUsd = currentUsd - usdCost;

        // Perform balance deduction
        const { error: updErr } = await supabase
          .from('wallets')
          .update({
            balance_naira: nextNaira,
            balance_usd: nextUsd
          })
          .eq('user_id', user.id);

        if (updErr) {
          alert("Error updating wallet balance: " + updErr.message);
          setIsProcessing(false);
          return;
        }

        // Try to update DB premium flags if they exist, caught gracefully
        try {
          await supabase
            .from('wallets')
            .update({
              ads_free_until: untilStr,
              is_ads_free: true
            })
            .eq('user_id', user.id);
        } catch (colErr) {
          console.warn("DB ads_free attributes skip-warn:", colErr);
        }

        // Insert real audit transaction log
        await supabase.from('wallet_transactions').insert({
          user_id: user.id,
          amount_naira: cost,
          amount_usd: usdCost,
          type: 'sub_charge',
          description: `Go Ads-Free Premium Upgrade: ${days}-Day autonomy pass`
        });

        // Set state to update screen immediately
        setWallet((prev: any) => ({
          ...prev,
          balance_naira: nextNaira,
          balance_usd: nextUsd,
          is_ads_free: true,
          ads_free_until: untilStr
        }));

        // Fetch refreshed transaction list
        const { data: refreshedTx } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (refreshedTx) setTransactions(refreshedTx);

      } else {
        // Fallback dynamic transaction execution for guest locally!
        let currentNaira = wallet ? Number(wallet.balance_naira) : 16000;
        let currentUsd = wallet ? Number(wallet.balance_usd) : 10.00;

        if (currentNaira < cost) {
          const grantKey = 'premium_demo_grant_claimed_guest';
          const alreadyClaimed = localStorage.getItem(grantKey) === 'true';

          if (alreadyClaimed) {
            alert(`Insufficient balance. You currently have ₦${currentNaira.toLocaleString()}, but you need ₦${cost.toLocaleString()} to upgrade.\n\nYou have already claimed your once-in-a-lifetime free ₦1,000 Demo Producer Grant.`);
            setIsProcessing(false);
            return;
          }

          currentNaira += 1000;
          currentUsd += 0.60;
          localStorage.setItem(grantKey, 'true');

          // Add transaction log for the grant injection locally
          const localTxStr = localStorage.getItem('local_wallet_transactions');
          let txl = [];
          try { txl = localTxStr ? JSON.parse(localTxStr) : []; } catch { txl = []; }
          txl.unshift({
            id: Math.random().toString(),
            type: 'revenue',
            amount_naira: 1000,
            amount_usd: 0.60,
            description: "Instantly Claimed: Once-in-a-lifetime ₦1,000 Demo Grant",
            created_at: new Date().toISOString()
          });
          localStorage.setItem('local_wallet_transactions', JSON.stringify(txl));
        }

        const nextNaira = currentNaira - cost;
        const nextUsd = currentUsd - usdCost;

        localStorage.setItem('local_wallet_naira', nextNaira.toString());
        localStorage.setItem('local_wallet_usd', nextUsd.toString());

        // Update local transaction log
        const localTxStr = localStorage.getItem('local_wallet_transactions');
        let txl = [];
        try { txl = localTxStr ? JSON.parse(localTxStr) : []; } catch { txl = []; }
        txl.unshift({
          id: Math.random().toString(),
          type: 'sub_charge',
          amount_naira: cost,
          amount_usd: usdCost,
          description: `Go Ads-Free Premium Upgrade: ${days}-Day autonomy pass`,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('local_wallet_transactions', JSON.stringify(txl));
        setTransactions(txl);

        setWallet((prev: any) => ({
          ...prev,
          balance_naira: nextNaira,
          balance_usd: nextUsd,
          is_ads_free: true,
          ads_free_until: untilStr
        }));
      }

      // Save local validation cache key (highly robust bypass validation)
      localStorage.setItem(`local_ads_free_until_${user?.id || 'guest'}`, untilStr);
      setShowSuccessOverlay({ days, untilStr });
    } catch (checkoutErr: any) {
      alert("Checkout error: " + (checkoutErr?.message || checkoutErr));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!wallet) return <div className="p-8 text-center animate-pulse">Loading...</div>;

  return (
    <div className="flex flex-col p-4 space-y-6 pb-20">
      <h1 className="text-2xl font-bold">Wallet</h1>
      
      <div className="w-full bg-gradient-to-br from-fuchsia-500 to-pink-500 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
        <div className="text-sm font-medium opacity-90 mb-1">Total Balance</div>
        <div className="text-4xl font-black tracking-tight mb-2">₦{Number(wallet.balance_naira).toLocaleString()}</div>
        <div className="text-sm font-medium opacity-90 mb-6">${Number(wallet.balance_usd).toLocaleString()} USD</div>
        
        <div className="flex items-center text-xs font-semibold opacity-90 gap-2">
          <span>TK: {Number(wallet.tk_balance).toFixed(2)}</span>
          <span>•</span>
          <span>Withdrawable: ₦{Number(wallet.withdrawable_balance).toLocaleString()}</span>
        </div>
        
        <WalletIcon size={120} className="absolute -bottom-6 -right-6 opacity-10 text-white rotate-12" />
      </div>
      
      <div className="flex flex-col gap-3">
        <button 
          onClick={() => navigate('/earnings?path=/wallet&title=Earning%20Wallet')} 
          className="w-full flex items-center justify-between p-5 bg-gradient-to-r from-orange-500/10 to-pink-500/10 hover:from-orange-500/15 hover:to-pink-500/15 rounded-2xl border border-pink-500/20 shadow-md transition-all active:scale-[0.99] group text-left"
        >
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/30 text-pink-400 shrink-0">
              <Coins size={20} className="group-hover:animate-bounce" />
            </div>
            <div>
              <div className="font-extrabold text-xs uppercase tracking-widest text-[#00FF5A] mb-0.5">Wallet Actions</div>
              <span className="font-bold text-sm text-zinc-100 group-hover:text-white transition-colors leading-tight block">
                Visit See Vibe earning page to fund and withdrawal
              </span>
            </div>
          </div>
          <ArrowUpRight size={18} className="text-pink-400 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>

        <button 
          onClick={() => document.getElementById('ads-free')?.scrollIntoView({ behavior: 'smooth' })} 
          className="w-full flex items-center justify-between p-4 bg-[#141414] hover:bg-[#1a1a1a] rounded-2xl border border-[#222] transition-all active:scale-[0.99] group text-left"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-cyan-400 shrink-0" />
            <span className="font-bold text-sm text-zinc-300 group-hover:text-white">Upgrade to Premium (Ads-Free)</span>
          </div>
          <ArrowDownLeft size={16} className="text-zinc-500 group-hover:text-cyan-400" />
        </button>
      </div>
      
      <div id="ads-free" className="mt-6 p-6 rounded-3xl bg-gradient-to-b from-[#141519] to-[#0A0B0D] border border-amber-500/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] space-y-6 relative overflow-hidden">
        {/* Glow decorative highlight */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] font-extrabold uppercase tracking-widest">Premium Upgrade</span>
          </div>
          <h2 className="text-xl font-extrabold text-white uppercase tracking-wider font-sans">Go Ads-Free</h2>
          <p className="text-[11px] text-zinc-400 font-mono leading-relaxed">
            Eliminate all interactive game countdowns, full-screen interstitials, and banner ads. Experience the studio at maximum efficiency.
          </p>
        </div>

        {/* Core Value Checklist benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1 border-y border-white/5 text-[9px] text-zinc-300 font-mono font-medium">
          <div className="flex items-center gap-1.5 py-1">
            <span className="text-[#00FF5A] font-extrabold">✓</span>
            <span>No AI flow blockages</span>
          </div>
          <div className="flex items-center gap-1.5 py-1">
            <span className="text-[#00FF5A] font-extrabold">✓</span>
            <span>Skip native game ads</span>
          </div>
          <div className="flex items-center gap-1.5 py-1">
            <span className="text-[#00FF5A] font-extrabold">✓</span>
            <span>Priority compute server</span>
          </div>
        </div>

        {/* Plan Select Cards Container */}
        <div className="space-y-3 pt-1">
          {/* Daily Card */}
          <button 
            onClick={() => handleAdsFree(1, 800)} 
            className="w-full text-left p-4.5 bg-[#1B1C22]/80 hover:bg-[#202229] border border-white/5 active:scale-[0.99] rounded-2xl flex items-center justify-between transition-all group duration-150"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5 font-mono text-zinc-400 font-bold group-hover:bg-amber-500 group-hover:text-black transition-colors duration-200">
                1D
              </div>
              <div>
                <div className="font-extrabold text-sm text-zinc-100 group-hover:text-white transition-colors uppercase tracking-wide">Daily Plan</div>
                <div className="text-[10px] text-zinc-500 font-mono">24 Hours continuous Ad-Free access</div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-black text-white group-hover:text-amber-400 transition-colors">₦800</span>
              <span className="text-[9px] text-zinc-500 font-mono">$0.50 USD</span>
            </div>
          </button>

          {/* Weekly Card (Popular Choice) */}
          <button 
            onClick={() => handleAdsFree(7, 4000)} 
            className="w-full text-left p-4.5 bg-[#1B1C22]/85 hover:bg-[#202229] border border-amber-500/20 active:scale-[0.99] rounded-2xl flex items-center justify-between transition-all relative group duration-150 shadow-[0_4px_25px_rgba(245,158,11,0.02)]"
          >
            {/* Ribbon Badge indicator */}
            <span className="absolute -top-2.5 right-6 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-extrabold text-[8px] uppercase tracking-widest leading-none shadow-md shadow-black">
              Popular Choice
            </span>
            
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 font-mono text-amber-400 font-bold group-hover:bg-amber-500 group-hover:text-black transition-colors duration-200">
                7D
              </div>
              <div>
                <div className="font-extrabold text-sm text-zinc-100 group-hover:text-white transition-colors uppercase tracking-wide flex items-center gap-2">
                  <span>Weekly Plan</span>
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">7 Days uninterrupted session flow</div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-black text-amber-400 group-hover:text-amber-300 transition-colors">₦4,000</span>
              <span className="text-[9px] text-zinc-500 font-mono">$2.50 USD</span>
            </div>
          </button>

          {/* Monthly Card (Best Deal) */}
          <button 
            onClick={() => handleAdsFree(30, 12800)} 
            className="w-full text-left p-4.5 bg-[#1B1C22]/80 hover:bg-[#202229] border border-white/5 active:scale-[0.99] rounded-2xl flex items-center justify-between transition-all group duration-150"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/5 font-mono text-zinc-400 font-bold group-hover:bg-amber-500 group-hover:text-black transition-colors duration-200">
                30D
              </div>
              <div>
                <div className="font-extrabold text-sm text-zinc-100 group-hover:text-white transition-colors uppercase tracking-wide">Monthly Plan</div>
                <div className="text-[10px] text-zinc-500 font-mono">30 Days premium producer autonomy</div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="flex items-center gap-1.5">
                <span className="text-[7px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-black font-mono">SAVE 50%</span>
                <span className="text-xs font-black text-white group-hover:text-amber-400 transition-colors">₦12,800</span>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">$8.00 USD</span>
            </div>
          </button>
        </div>
      </div>

      <h2 className="text-lg font-bold mt-4">Recent Transactions</h2>
      <div className="space-y-3">
        {transactions.length === 0 ? <p className="text-sm text-gray-500">No transactions yet.</p> : transactions.map(tx => {
          const isIncome = ['funding', 'tip', 'revenue'].includes(tx.type);
          return (
            <div key={tx.id} className="flex items-center justify-between p-4 bg-[#141414] rounded-2xl border border-[#222]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1A1A1A] rounded-full flex items-center justify-center">
                  <WalletIcon size={16} className="text-fuchsia-400" />
                </div>
                <div>
                  <div className="font-semibold text-sm capitalize">{tx.type.replace('_', ' ')}</div>
                  <div className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className={`font-bold text-sm ${isIncome ? 'text-green-400' : 'text-gray-200'}`}>
                {isIncome ? '+' : '-'}₦{Number(tx.amount_naira).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checkout Plan Confirmation Modal */}
      {checkoutPlan && (() => {
        const walletNaira = wallet ? Number(wallet.balance_naira) : 0;
        const grantKey = user ? `premium_demo_grant_claimed_${user.id}` : 'premium_demo_grant_claimed_guest';
        const alreadyClaimed = localStorage.getItem(grantKey) === 'true';
        const hasShortfall = walletNaira < checkoutPlan.cost;
        const shortfall = checkoutPlan.cost - walletNaira;
        const eligibleForGrant = hasShortfall && !alreadyClaimed;
        
        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#0C0D11] border border-zinc-800 rounded-[28px] w-full max-w-sm overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.85)] flex flex-col relative">
              {/* Header with secure indication */}
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-zinc-950/40">
                <div className="flex items-center gap-2">
                  <Lock size={14} className="text-emerald-400" />
                  <span className="font-mono text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Secure Checkout</span>
                </div>
                <button 
                  onClick={() => setCheckoutPlan(null)}
                  disabled={isProcessing}
                  className="text-zinc-500 hover:text-white transition-colors h-6 w-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Plan detail badge card */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-black border border-white/5 flex flex-col justify-center space-y-1 text-center">
                  <span className="text-[10px] font-mono uppercase text-amber-400 font-extrabold tracking-widest leading-none">Selected Upgrade</span>
                  <h3 className="text-base font-black text-white">{checkoutPlan.days}-Day Ads-Free Subscription</h3>
                  <p className="text-xs font-mono text-zinc-500">Continuous premium autonomy flow</p>
                </div>

                {/* Subtotal fee item list */}
                <div className="space-y-2.5 text-xs font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subscription Rate:</span>
                    <span className="text-white font-extrabold font-mono">₦{checkoutPlan.cost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Your Current Balance:</span>
                    <span className="text-white font-extrabold font-mono">₦{walletNaira.toLocaleString()}</span>
                  </div>

                  {!hasShortfall ? (
                    <div className="pt-2 border-t border-white/5 flex justify-between text-[#00FFBC] font-bold">
                      <span>Remaining Balance:</span>
                      <span>₦{(walletNaira - checkoutPlan.cost).toLocaleString()}</span>
                    </div>
                  ) : (
                    <div className="pt-2.5 space-y-3">
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[10px] space-y-1.5 leading-relaxed">
                        <div className="flex items-center gap-1.5 font-bold text-amber-400 uppercase tracking-wide">
                          <AlertTriangle size={12} />
                          <span>Shortfall detected</span>
                        </div>
                        <p>
                          You need <span className="font-bold text-white">₦{shortfall.toLocaleString()}</span> more to subscribe.
                        </p>
                        {eligibleForGrant ? (
                          <div className="pt-1 text-zinc-300">
                            🎁 Good news! As a demo tester, you can claim a free <span className="font-bold text-[#00FF5A]">₦1,000 Demo Grant</span> to instantly complete this transaction!
                          </div>
                        ) : (
                          <div className="pt-1 text-red-300 font-medium">
                            You already claimed your free grant once. Please fund your wallet to proceed.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 border-t border-white/5 bg-zinc-950/20 space-y-2 flex flex-col">
                {isProcessing ? (
                  <button 
                    disabled 
                    className="w-full py-3.5 bg-zinc-900 text-zinc-400 rounded-xl font-mono text-xs font-medium flex items-center justify-center gap-2"
                  >
                    <Loader2 size={13} className="animate-spin text-zinc-500" />
                    <span>Processing Secure Transaction...</span>
                  </button>
                ) : hasShortfall ? (
                  eligibleForGrant ? (
                    <button
                      onClick={executeAdsFreePurchase}
                      className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-black rounded-xl font-mono text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/10 transition-all active:scale-95 text-center flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Gift size={13} />
                      <span>Claim ₦1k + Approve Pay</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setCheckoutPlan(null);
                        navigate('/earnings?path=/wallet/fund&title=Fund Wallet');
                      }}
                      className="w-full py-3.5 bg-zinc-805 hover:bg-zinc-800 border border-white/5 text-white rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all active:scale-95 text-center cursor-pointer"
                    >
                      <span>Fund Wallet Balance</span>
                    </button>
                  )
                ) : (
                  <button
                    onClick={executeAdsFreePurchase}
                    className="w-full py-3.5 bg-[#00FFBC] hover:bg-[#00E5A8] text-black rounded-xl font-mono text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/10 transition-all active:scale-95 text-center cursor-pointer"
                  >
                    <span>Approve & Deduct ₦{checkoutPlan.cost.toLocaleString()}</span>
                  </button>
                )}

                <button
                  onClick={() => setCheckoutPlan(null)}
                  disabled={isProcessing}
                  className="w-full py-2.5 bg-transparent hover:bg-white/5 text-zinc-400 rounded-xl font-mono text-[10px] uppercase font-bold tracking-wider transition-all active:scale-95 text-center cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Success Animation & Feedback Overlay */}
      {showSuccessOverlay && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-[#0B0C0E] border-2 border-emerald-500/20 rounded-[32px] w-full max-w-sm overflow-hidden shadow-[0_30px_80px_rgba(0,255,188,0.15)] flex flex-col p-8 text-center items-center space-y-6">
            
            {/* Animated Glow Checked Icon Container */}
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center relative animate-pulse">
              <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-xl animate-pulse" />
              <CheckCircle2 size={40} className="text-[#00FFBC] animate-bounce" />
            </div>

            <div className="space-y-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[#00FFBC] font-mono text-[8.5px] font-extrabold uppercase tracking-widest">
                Upgrade Activated
              </span>
              <h3 className="text-xl font-black text-white uppercase tracking-wider">Premium Access Active</h3>
              <p className="text-xs text-zinc-400 font-mono leading-relaxed max-w-[260px] mx-auto">
                Your <span className="font-bold text-white">{showSuccessOverlay.days}-Day</span> Ads-Free premium experience was applied successfully. Ready to use instantly!
              </p>
            </div>

            {/* Date Details card */}
            <div className="w-full p-4 rounded-2xl bg-zinc-950 border border-white/5 font-mono text-[10px] text-zinc-450 space-y-1.5 flex flex-col">
              <div className="flex justify-between">
                <span>Account Tier:</span>
                <span className="text-emerald-450 font-bold uppercase">👑 Ads-Free Pro</span>
              </div>
              <div className="flex justify-between">
                <span>Valid Until:</span>
                <span className="text-zinc-200">{new Date(Date.now() + showSuccessOverlay.days * 24 * 60 * 60 * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowSuccessOverlay(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-400 to-[#00FFBC] hover:brightness-110 text-black rounded-xl font-mono text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/10 active:scale-95 transition-all text-center cursor-pointer"
            >
              🚀 Enter Premium Studio
            </button>
          </div>
        </div>
      )}

      {/* Help & Privacy Banner */}
      <div className="pt-4 border-t border-[#222] flex flex-col items-center space-y-2.5">
        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Billing or Token Issues?</p>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full justify-center">
          <a
            id="contact-seevibe-wallet"
            href="mailto:seevibehelp@gmail.com"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[#111] hover:bg-[#1A1A1A] border border-white/5 hover:border-fuchsia-500/20 rounded-xl text-xs font-mono text-zinc-400 hover:text-white transition-all text-center cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
            <span>seevibehelp@gmail.com</span>
          </a>

          <button
            type="button"
            id="btn-policy-wallet"
            onClick={() => setIsPolicyOpen(true)}
            className="flex-1 py-2.5 bg-[#111] hover:bg-[#1A1A1A] border border-fuchsia-500/10 hover:border-fuchsia-500/20 rounded-xl text-[10px] font-mono text-fuchsia-400 hover:text-fuchsia-300 font-bold uppercase tracking-wider transition-all text-center cursor-pointer"
          >
            Manual & Security Policy
          </button>
        </div>
      </div>

      <SecurityPolicyModal isOpen={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} />
    </div>
  );
}
