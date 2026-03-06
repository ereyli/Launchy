'use client';

import { useEffect, useState } from 'react';

type Variant = 'pending' | 'success' | 'error';

export function TransactionFeedbackCard({
  open,
  variant,
  title,
  description,
}: {
  open: boolean;
  variant: Variant;
  title: string;
  description: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, [open, title, description, variant]);

  if (!visible) return null;

  return (
    <div className={`tx-feedback tx-feedback-${variant}`} role="status" aria-live="polite">
      <div className="tx-feedback-icon" aria-hidden="true">
        {variant === 'pending' ? <span className="button-spinner" /> : null}
        {variant === 'success' ? '✓' : null}
        {variant === 'error' ? '!' : null}
      </div>
      <div className="tx-feedback-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
}
