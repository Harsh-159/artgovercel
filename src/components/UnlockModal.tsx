import React, { useState, useEffect } from 'react';
import { Artwork, AccessTier, Certificate } from '../lib/types';
import { Lock } from 'lucide-react';
import { incrementUnlockCount, saveCertificate, auth, getUserProfile, updateUserProfile } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ── Inner Stripe checkout form ──────────────────────────────────────────────
const CheckoutForm: React.FC<{
  artworkId: string;
  onSuccess: () => void;
  onCancel: () => void;
}> = ({ artworkId, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/ar/${artworkId}?unlocked=true`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setError(error.message || 'Payment failed');
      setLoading(false);
    } else if (paymentIntent?.status === 'succeeded') {
      onSuccess();
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      {error && (
        <p className="text-red-400 text-sm text-center bg-red-400/10 
                      rounded-lg px-3 py-2 border border-red-400/20">
          {error}
        </p>
      )}
      <button
        onClick={handlePay}
        disabled={loading || !stripe}
        className="w-full bg-accent hover:bg-accent/90 text-white font-bold 
                   py-3 px-6 rounded-full transition-all active:scale-95 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   shadow-[0_0_20px_rgba(68,136,255,0.4)]"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white 
                             rounded-full animate-spin" />
            Processing...
          </span>
        ) : (
          'Pay & Unlock Forever'
        )}
      </button>
      <button
        onClick={onCancel}
        className="text-text-secondary hover:text-white transition-colors text-sm"
      >
        Maybe later
      </button>
    </div>
  );
};

// ── Main UnlockModal ────────────────────────────────────────────────────────
export const UnlockModal: React.FC<{
  artwork: Artwork;
  onUnlock: () => void;
  onCancel: () => void;
}> = ({ artwork, onUnlock, onCancel }) => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<'preview' | 'payment' | 'success'>('preview');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingSecret, setFetchingSecret] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [selectedTier, setSelectedTier] = useState<AccessTier | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  useEffect(() => {
    if (!artwork.accessTiers) return;
    if (artwork.accessTiers.viewOnce.enabled) setSelectedTier('viewOnce');
    else if (artwork.accessTiers.viewForever.enabled) setSelectedTier('viewForever');
    else if (artwork.accessTiers.own.enabled) setSelectedTier('own');
  }, [artwork]);

  // ── Fetch Stripe clientSecret when user taps Unlock ──
  const handleUnlockTap = async () => {
    if (!selectedTier || !artwork.accessTiers) return;
    setFetchingSecret(true);
    const tierData = artwork.accessTiers[selectedTier];
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: tierData.price,
          artworkId: artwork.id,
          tier: selectedTier
        }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
        setStage('payment');
      } else {
        console.error('No clientSecret returned:', data);
      }
    } catch (err) {
      console.error('Failed to create payment intent:', err);
    }
    setFetchingSecret(false);
  };

  // ── Called after Stripe confirms payment ──
  const handlePaymentSuccess = async () => {
    if (!selectedTier || !artwork.accessTiers) return;

    if (selectedTier === 'viewOnce') {
      sessionStorage.setItem(`viewonce_${artwork.id}`, 'true');
      setStage('success');
      setTimeout(() => { setIsUnlocking(true); setTimeout(onUnlock, 600); }, 800);
    }

    if (selectedTier === 'viewForever') {
      localStorage.setItem(`unlocked_${artwork.id}`, 'true');
      try { await incrementUnlockCount(artwork.id); } catch (err) { }
      setStage('success');
      setTimeout(() => { setIsUnlocking(true); setTimeout(onUnlock, 600); }, 800);
    }

    if (selectedTier === 'own') {
      const cert: Certificate = {
        artworkId: artwork.id,
        artworkTitle: artwork.title,
        artistName: artwork.artistName,
        mediaUrl: artwork.mediaUrl,
        category: artwork.category,
        lat: artwork.lat,
        lng: artwork.lng,
        tokenId: artwork.accessTiers.own.tokenId!,
        ownerId: auth?.currentUser?.uid || 'anonymous',
        ownerName: auth?.currentUser?.displayName || 'Anonymous',
        purchasedAt: new Date().toISOString(),
        transactionId: paymentIntentId || 'unknown',
      };
      await saveCertificate(cert);
      localStorage.setItem(`unlocked_${artwork.id}`, 'true');
      localStorage.setItem(`owned_${artwork.id}`, cert.tokenId);
      try { await incrementUnlockCount(artwork.id); } catch (err) { }

      // Update portal economy
      if (auth?.currentUser?.uid) {
        try {
          const profile = await getUserProfile(auth.currentUser.uid);
          const newPurchasedCount = profile.purchasedCount + 1;
          const userGetsPortal = newPurchasedCount > 0 && newPurchasedCount % 3 === 0;
          await updateUserProfile(auth.currentUser.uid, {
            purchasedCount: newPurchasedCount,
            portalCount: profile.portalCount + (userGetsPortal ? 1 : 0)
          });
        } catch (err) {
          console.error('Failed to update portal economy', err);
        }
      }

      // Immediate redirect to Certificate bypassing intermediate UI
      navigate(`/certificate/${cert.tokenId}`);
    }
  };

  const stripeAppearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#4488FF',
      colorBackground: '#12121A',
      colorText: '#F0F0FF',
      colorDanger: '#FF4444',
      fontFamily: 'DM Sans, sans-serif',
      borderRadius: '12px',
    },
  };

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/60 backdrop-blur-xl transition-all duration-500',
        isUnlocking && 'opacity-0 scale-110'
      )}
    >
      <div
        className="bg-surface border border-white/10 rounded-2xl p-6 w-full 
                   max-w-sm flex flex-col items-center text-center relative 
                   overflow-hidden"
      >
        {/* Blurred preview background */}
        <div
          className="absolute inset-0 opacity-20 blur-xl z-0"
          style={{
            backgroundImage: `url(${artwork.mediaUrl})`,
            backgroundSize: 'cover',
          }}
        />

        <div className="relative z-10 flex flex-col items-center w-full">

          {/* ── Stage 1: Preview / locked state ── */}
          {stage === 'preview' && (
            <>
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center 
                              justify-center mb-2 animate-pulse-slow">
                <Lock size={32} className="text-white" />
              </div>

              <h2 className="text-xl font-heading font-bold text-text-primary mb-1">
                {artwork.title}
              </h2>
              <p className="text-text-secondary text-sm mb-4">Choose your access level</p>

              <div className="flex flex-col gap-3 w-full mb-6">
                {artwork.accessTiers?.viewOnce.enabled && (
                  <button
                    onClick={() => setSelectedTier('viewOnce')}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                      selectedTier === 'viewOnce' ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(68,136,255,0.2)]" : "border-white/10 bg-black/30 hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">👁</span>
                      <div>
                        <div className="font-bold text-white text-sm">View Once</div>
                        <div className="text-[10px] text-text-secondary">Right now</div>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-accent">£{artwork.accessTiers.viewOnce.price.toFixed(2)}</div>
                  </button>
                )}

                {artwork.accessTiers?.viewForever.enabled && (
                  <button
                    onClick={() => setSelectedTier('viewForever')}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                      selectedTier === 'viewForever' ? "border-accent bg-accent/10 shadow-[0_0_15px_rgba(68,136,255,0.2)]" : "border-white/10 bg-black/30 hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">♾</span>
                      <div>
                        <div className="font-bold text-white text-sm">View Forever</div>
                        <div className="text-[10px] text-text-secondary">Revisit any time</div>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-accent">£{artwork.accessTiers.viewForever.price.toFixed(2)}</div>
                  </button>
                )}

                {artwork.accessTiers?.own.enabled && (
                  <button
                    onClick={() => setSelectedTier('own')}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                      selectedTier === 'own' ? "border-[#FFD700] bg-[#FFD700]/10 shadow-[0_0_15px_rgba(255,215,0,0.2)]" : "border-[#FFD700]/30 bg-[#FFD700]/5 hover:bg-[#FFD700]/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">⭐</span>
                      <div>
                        <div className="font-bold text-[#FFD700] text-sm">Own It</div>
                        <div className="text-[10px] text-[#FFD700]/70">NFT Certificate</div>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-[#FFD700]">£{artwork.accessTiers.own.price.toFixed(2)}</div>
                  </button>
                )}
              </div>

              <button
                onClick={handleUnlockTap}
                disabled={fetchingSecret || !selectedTier}
                className={clsx(
                  "w-full text-white font-bold py-3 px-6 rounded-full transition-all active:scale-95 mb-4 disabled:opacity-50 disabled:cursor-not-allowed",
                  selectedTier === 'own' ? "bg-[#FFD700] hover:bg-[#FFD700]/90 text-black shadow-[0_0_20px_rgba(255,215,0,0.4)]" : "bg-accent hover:bg-accent/90 shadow-[0_0_20px_rgba(68,136,255,0.4)]"
                )}
              >
                {fetchingSecret ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className={clsx("w-4 h-4 border-2 border-t-white rounded-full animate-spin", selectedTier === 'own' ? "border-black/30 border-t-black" : "border-white/30")} />
                    Preparing payment...
                  </span>
                ) : (
                  selectedTier === 'viewOnce' ? `Pay £${artwork.accessTiers?.viewOnce.price.toFixed(2)} — View Now` :
                    selectedTier === 'viewForever' ? `Pay £${artwork.accessTiers?.viewForever.price.toFixed(2)} — Unlock Forever` :
                      selectedTier === 'own' ? `Pay £${artwork.accessTiers?.own.price.toFixed(2)} — Own This Piece ⭐` :
                        'Select a Tier'
                )}
              </button>

              <button
                onClick={onCancel}
                className="text-text-secondary hover:text-white transition-colors text-sm"
              >
                Maybe later
              </button>
            </>
          )}

          {/* ── Stage 2: Stripe payment form ── */}
          {stage === 'payment' && clientSecret && (
            <>
              <h2 className="text-xl font-heading font-bold text-text-primary mb-1">
                {artwork.title}
              </h2>
              <p className="text-text-secondary text-sm mb-6">
                Unlock forever · £{artwork.price?.toFixed(2)}
              </p>

              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: stripeAppearance }}
              >
                <CheckoutForm
                  artworkId={artwork.id}
                  onSuccess={handlePaymentSuccess}
                  onCancel={onCancel}
                />
              </Elements>
            </>
          )}

          {/* ── Stage 3: Success ── */}
          {stage === 'success' && (
            <div className="flex flex-col items-center py-4 animate-[scale-in_0.4s_ease] w-full">
              {selectedTier === 'own' ? (
                <>
                  <div className="w-24 h-24 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/40 
                                  flex items-center justify-center mb-4
                                  shadow-[0_0_40px_rgba(255,215,0,0.6)]">
                    <span className="text-5xl">⭐</span>
                  </div>
                  <h2 className="text-2xl font-heading font-bold text-[#FFD700] mb-2">
                    You Own This Piece
                  </h2>
                  <p className="text-text-secondary text-sm mb-6">
                    Your certificate of ownership is ready
                  </p>
                  <button
                    onClick={() => navigate(`/certificate/${artwork.accessTiers?.own.tokenId}`)}
                    className="w-full bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-bold py-3 rounded-full mb-3 shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-colors active:scale-95"
                  >
                    View Certificate →
                  </button>
                  <button
                    onClick={onUnlock}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-full transition-colors active:scale-95"
                  >
                    Continue to AR
                  </button>
                </>
              ) : selectedTier === 'viewForever' ? (
                <>
                  <div className="w-20 h-20 rounded-full bg-accent/20 border border-accent/40 
                                  flex items-center justify-center mb-4
                                  shadow-[0_0_40px_rgba(68,136,255,0.6)]">
                    <span className="text-4xl">✨</span>
                  </div>
                  <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
                    Unlocked Forever!
                  </h2>
                  <p className="text-text-secondary text-sm">
                    This piece is yours to revisit any time
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-full bg-white/20 border border-white/40 
                                  flex items-center justify-center mb-4
                                  shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                    <span className="text-4xl">👁</span>
                  </div>
                  <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
                    Enjoy the view!
                  </h2>
                  <p className="text-text-secondary text-sm">
                    Your access is active for this session
                  </p>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};