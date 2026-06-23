import { useEffect, useRef } from "react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4";

/**
 * Cinematic looping video background with a custom fade-in / fade-out loop.
 * - Fades in over 0.5s at the start.
 * - Fades out over 0.5s before the end.
 * - On `ended`, resets to 0 and replays for a seamless manual loop.
 * Mirrors the hero reference spec exactly.
 */
export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const FADE = 0.5;

    const tick = () => {
      const { currentTime, duration } = video;
      if (duration && !Number.isNaN(duration)) {
        let opacity = 1;
        if (currentTime < FADE) {
          opacity = currentTime / FADE;
        } else if (currentTime > duration - FADE) {
          opacity = Math.max(0, (duration - currentTime) / FADE);
        }
        video.style.opacity = String(opacity);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const handleEnded = () => {
      video.style.opacity = "0";
      setTimeout(() => {
        video.currentTime = 0;
        void video.play();
      }, 100);
    };

    video.addEventListener("ended", handleEnded);
    void video.play().catch(() => {
      /* autoplay may be blocked; poster/gradient remains */
    });
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div
      className="pointer-events-none absolute z-0"
      style={{ top: "300px", inset: "auto 0 0 0" }}
    >
      <div className="relative">
        <video
          ref={videoRef}
          className="h-full w-full object-cover opacity-0 transition-opacity"
          style={{ minHeight: "60vh" }}
          src={VIDEO_URL}
          muted
          playsInline
          autoPlay
          preload="auto"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      </div>
    </div>
  );
}
