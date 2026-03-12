import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Inner form — must be inside Elements provider
function CheckoutForm({ artworkId, onSuccess }: {
    artworkId: string,
    onSuccess: () => void
}) {
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
            redirect: 'if_required' // stays on page if no redirect needed
        });

        if (error) {
            setError(error.message || 'Payment failed');
            setLoading(false);
        } else if (paymentIntent?.status === 'succeeded') {
            onSuccess();
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <PaymentElement />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
                onClick={handlePay}
                disabled={loading || !stripe}
                className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold
                   disabled:opacity-50 active:scale-95 transition-all"
            >
                {loading ? 'Processing...' : 'Pay & Unlock Forever'}
            </button>
        </div>
    );
}

// Outer wrapper — fetches clientSecret and sets up Elements
export default function PaymentModal({
    artwork,
    onSuccess,
    onClose
}: {
    artwork: { id: string, title: string, price: number },
    onSuccess: () => void,
    onClose: () => void
}) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const initPayment = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: artwork.price,
                    artworkId: artwork.id
                })
            });
            const data = await res.json();
            setClientSecret(data.clientSecret);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    // Fetch clientSecret as soon as modal opens
    useState(() => { initPayment(); });

    const appearance = {
        theme: 'night' as const,
        variables: { colorPrimary: '#4488FF' }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center 
                    bg-black/70 backdrop-blur-xl">
            <div className="w-full max-w-md bg-[#12121A] rounded-t-3xl p-6 
                      border-t border-white/10">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-white font-bold text-lg">{artwork.title}</h2>
                        <p className="text-gray-400 text-sm">Unlock forever · £{artwork.price}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 text-2xl">×</button>
                </div>

                {/* Stripe Payment Form */}
                {loading && (
                    <p className="text-center text-gray-400 py-8">Loading payment...</p>
                )}
                {clientSecret && (
                    <Elements
                        stripe={stripePromise}
                        options={{ clientSecret, appearance }}
                    >
                        <CheckoutForm
                            artworkId={artwork.id}
                            onSuccess={onSuccess}
                        />
                    </Elements>
                )}
            </div>
        </div>
    );
}