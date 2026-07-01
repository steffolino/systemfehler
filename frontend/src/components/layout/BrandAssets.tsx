import icon from '../../assets/ChatGPT Image Jul 1, 2026, 07_12_51 PM.webp';
import wordmarkLight from '../../assets/ChatGPT Image Jul 1, 2026, 07_13_06 PM.webp';

type BrandAssetProps = {
  className?: string;
};

export function BrandIcon({ className = '' }: BrandAssetProps) {
  return (
    <img
      src={icon}
      alt=""
      aria-hidden="true"
      className={['brand-mark', className].filter(Boolean).join(' ')}
    />
  );
}

export function BrandWordmark({ className = '' }: BrandAssetProps) {
  return (
    <img
      src={wordmarkLight}
      alt="Systemfehler"
      className={['brand-wordmark', className].filter(Boolean).join(' ')}
    />
  );
}
