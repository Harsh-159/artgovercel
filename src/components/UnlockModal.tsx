import React, { useState } from 'react';
import { Artwork } from '../lib/types';
import { Lock } from 'lucide-react';
import { incrementUnlockCount } from '../lib/firebase';
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
  const [stage, setStage] = useState<'preview' | 'payment' | 'success'>('preview');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [fetchingSecret, setFetchingSecret] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // ── Fetch Stripe clientSecret when user taps Unlock ──
  const handleUnlockTap = async () => {
    setFetchingSecret(true);
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: artwork.price,
          artworkId: artwork.id,
        }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
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
    setStage('success');
    localStorage.setItem(`unlocked_${artwork.id}`, 'true');
    try {
      await incrementUnlockCount(artwork.id);
    } catch (err) {
      console.error('Failed to increment unlock count:', err);
    }
    // Brief success animation then hand control back
    setTimeout(() => {
      setIsUnlocking(true);
      setTimeout(() => onUnlock(), 600);
    }, 800);
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
                              justify-center mb-4 animate-pulse-slow">
                <Lock size={32} className="text-white" />
              </div>

              <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
                {artwork.title}
              </h2>
              <p className="text-text-secondary mb-6">This piece is locked</p>

              <div className="bg-accent/20 text-accent px-4 py-1 rounded-full 
                              font-mono text-lg mb-8 border border-accent/30">
                £{artwork.price?.toFixed(2)}
              </div>

              <button
                onClick={handleUnlockTap}
                disabled={fetchingSecret}
                className="w-full bg-accent hover:bg-accent/90 text-white font-bold 
                           py-3 px-6 rounded-full transition-all active:scale-95 mb-4 
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-[0_0_20px_rgba(68,136,255,0.4)]"
              >
                {fetchingSecret ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white 
                                     rounded-full animate-spin" />
                    Preparing payment...
                  </span>
                ) : (
                  'Unlock & View Forever'
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
            <div className="flex flex-col items-center py-4 animate-[scale-in_0.4s_ease]">
              <div className="w-20 h-20 rounded-full bg-accent/20 border border-accent/40 
                              flex items-center justify-center mb-4
                              shadow-[0_0_40px_rgba(68,136,255,0.6)]">
                <span className="text-4xl">✨</span>
              </div>
              <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">
                Unlocked!
              </h2>
              <p className="text-text-secondary text-sm">
                This piece is yours forever
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};