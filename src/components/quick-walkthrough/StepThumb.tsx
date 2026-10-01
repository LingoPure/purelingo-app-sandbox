/**
 * Small per-step thumbnail icons for the walkthrough's step navigator —
 * illustrative glyphs (not photos/screenshots), so a visitor can scan what's
 * coming at a glance before clicking in. Pure inline SVG using currentColor,
 * so each consumer controls colour via its own wrapper styling. Shared by
 * both QuickWalkthrough variants.
 */

type Props = {
  index: number;
  size?: number;
};

export function StepThumb({ index, size = 20 }: Props) {
  switch (index) {
    case 0:
      return <SignupThumb size={size} />;
    case 1:
      return <AriaThumb size={size} />;
    case 2:
      return <ProfileThumb size={size} />;
    case 3:
    default:
      return <PlanThumb size={size} />;
  }
}

function SignupThumb({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 19.5c1.2-3.3 4-5 7-5s5.8 1.7 7 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A simple, friendly abstract face — illustrative, not a photo. */
function AriaThumb({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9.4" cy="11" r="1" fill="currentColor" />
      <circle cx="14.6" cy="11" r="1" fill="currentColor" />
      <path
        d="M9 14.3c.9.8 1.9 1.2 3 1.2s2.1-.4 3-1.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* speaking / listening accent */}
      <path d="M2.4 10.5v3M4.4 9v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M21.6 10.5v3M19.6 9v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ProfileThumb({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5l7.5 4.3v8.4L12 20.5l-7.5-4.3V7.8L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 8l3 1.7v3.4L12 14.8l-3-1.7V9.7L12 8z" fill="currentColor" opacity="0.85" />
    </svg>
  );
}

function PlanThumb({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 9.5h16" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 13.2h3.2M8 16.4h6.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
