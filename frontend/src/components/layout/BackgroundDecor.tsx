export function BackgroundDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,77,77,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,32,0.04),transparent_30%)]" />

      <svg
        className="absolute left-[-8rem] top-[-4rem] h-[30rem] w-[52rem] opacity-45 blur-[0.3px] md:h-[36rem] md:w-[64rem]"
        viewBox="0 0 1200 700"
        fill="none"
      >
        <path
          d="M-40 150C120 40 260 40 430 150C600 260 740 260 900 150C1040 55 1130 45 1240 85"
          stroke="rgba(255,77,77,0.35)"
          strokeWidth="44"
          strokeLinecap="round"
        />
        <path
          d="M-40 210C130 90 280 90 450 210C620 330 760 330 930 210C1070 110 1160 100 1240 140"
          stroke="rgba(15,23,32,0.14)"
          strokeWidth="28"
          strokeLinecap="round"
        />
        <path
          d="M-40 270C120 160 260 160 430 270C600 380 740 380 900 270C1040 175 1130 165 1240 205"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="18"
          strokeLinecap="round"
        />
      </svg>

      <svg
        className="absolute bottom-[-7rem] right-[-10rem] h-[28rem] w-[50rem] opacity-50 blur-[0.3px] md:h-[34rem] md:w-[62rem]"
        viewBox="0 0 1200 700"
        fill="none"
      >
        <path
          d="M-40 560C130 450 270 450 440 560C610 670 750 670 920 560C1060 470 1150 460 1240 500"
          stroke="rgba(255,77,77,0.32)"
          strokeWidth="48"
          strokeLinecap="round"
        />
        <path
          d="M-40 500C120 390 260 390 430 500C600 610 740 610 900 500C1040 405 1130 395 1240 435"
          stroke="rgba(15,23,32,0.18)"
          strokeWidth="30"
          strokeLinecap="round"
        />
        <path
          d="M-40 440C130 325 280 325 450 440C620 555 760 555 930 440C1070 345 1160 335 1240 375"
          stroke="rgba(255,255,255,0.72)"
          strokeWidth="18"
          strokeLinecap="round"
        />
      </svg>

      <div className="absolute left-6 top-24 grid grid-cols-3 gap-3 opacity-35">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={`plus-${index}`}
            className="block h-2 w-2 rounded-full bg-[rgba(15,23,32,0.8)] shadow-[0_0_0_2px_rgba(255,255,255,0.6)]"
          />
        ))}
      </div>

      <div className="absolute right-8 top-24 grid grid-cols-4 gap-2 opacity-30">
        {Array.from({ length: 12 }).map((_, index) => (
          <span key={`dot-${index}`} className="block h-1.5 w-1.5 rounded-full bg-[rgba(15,23,32,0.25)]" />
        ))}
      </div>

      <div className="absolute bottom-24 left-8 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,77,77,0.22),transparent_70%)] blur-2xl" />
      <div className="absolute right-20 top-1/2 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(255,77,77,0.14),transparent_72%)] blur-2xl" />
    </div>
  );
}
