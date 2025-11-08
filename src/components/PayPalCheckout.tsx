import React, { useState } from 'react';

type Item = {
  product_id?: number;
  variant_id?: number | null;
  unit_price: number;
  quantity: number;
};

type Props = {
  userId?: string | null;
  fullName?: string | null;
  items: Item[];
  shipping?: { address?: string; phone?: string };
  // optional callback when order created
  onCreated?: (order: any, payment: any) => void;
};

export default function PayPalCheckout({ userId, fullName, items, shipping, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0);

  async function handlePayWithPayPal(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = {
        user_id: userId || null,
        full_name: fullName || null,
        items,
        shipping: shipping || null,
        payment_method: 'paypal',
      };

      const res = await fetch('/payments/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // call optional callback
      if (onCreated) onCreated(data.order, data.payment);

      // redirect user to PayPal approval URL if provided
      if (data.payment_url) {
        // full redirect
        window.location.href = data.payment_url;
        return;
      }

      // If no payment_url (fallback) show message
      setError('No payment url returned from server');
    } catch (err: any) {
      console.error('PayPal checkout error', err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <strong>Order summary</strong>
        <div>Items: {items.length}</div>
        <div>Subtotal: {subtotal.toLocaleString()}</div>
      </div>

      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}

      <button onClick={handlePayWithPayPal} disabled={loading} style={{ padding: '10px 16px', background: '#003087', color: 'white', border: 'none', borderRadius: 6 }}>
        {loading ? 'Creating payment...' : 'Pay with PayPal'}
      </button>
    </div>
  );
}
