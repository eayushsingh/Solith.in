import React, { useMemo } from "react";

export const Meteors = ({ number = 2 }) => {
  const meteorStyles = useMemo(() => {
    return [...new Array(number)].map(() => ({
      // Start slightly above the top of the screen ("the sky")
      top: Math.floor(Math.random() * 50) - 100 + "px",
      // Since it moves down-right (+X and +Y after 45deg rotation),
      // we need to spawn it on the left or top-center
      left: Math.floor(Math.random() * window.innerWidth) - 200 + "px",
      animationDelay: Math.random() * 5 + "s",
      animationDuration: Math.floor(Math.random() * 4 + 4) + "s", // 4s to 8s 
    }));
  }, [number]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {meteorStyles.map((style, idx) => (
        <span
          key={idx}
          // Note: rotate(45deg) is handled entirely by the @keyframes, so we don't need a tailwind rotate class
          className="pointer-events-none absolute h-[2px] w-[2px] animate-meteor rounded-full bg-white/50 shadow-[0_0_0_1px_#ffffff20]"
          style={style}
        >
          {/* Meteor Tail: moving positive X means the front is on the right. So gradient from transparent on the left to white on the right */}
          <div className="pointer-events-none absolute top-1/2 -z-10 h-[1px] w-[60px] -translate-y-1/2 bg-gradient-to-r from-transparent to-white/50 right-[100%]" />
        </span>
      ))}
    </div>
  );
};
