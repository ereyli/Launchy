'use client';

export function LoadingState({ title, description }: { title: string; description: string }) {
  return (
    <div className="figma-empty figma-loading-state" role="status" aria-live="polite">
      <span className="figma-spinner" aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
