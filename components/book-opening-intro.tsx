"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Scale } from "lucide-react";

export interface BookOpeningIntroProps {
  isOpen: boolean;
  onComplete: () => void;
  logoUrl?: string;
  firmName?: string;
  accentColor?: string;
}

export function BookOpeningIntro({
  isOpen,
  onComplete,
  logoUrl,
  firmName = "Gray's Defence Solicitors",
  accentColor = "#B8860B",
}: BookOpeningIntroProps) {
  const [stage, setStage] = useState<"closed" | "opening" | "pages" | "reveal" | "complete">("closed");
  const [showSkip, setShowSkip] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleComplete = useCallback(() => {
    setStage("complete");
    setTimeout(onComplete, 100);
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  useEffect(() => {
    if (!isOpen) {
      setStage("closed");
      return;
    }

    // Show skip button after a brief delay
    const skipTimer = setTimeout(() => setShowSkip(true), 500);

    if (shouldReduceMotion) {
      // Simplified animation for reduced motion
      const timer = setTimeout(handleComplete, 800);
      return () => {
        clearTimeout(timer);
        clearTimeout(skipTimer);
      };
    }

    // Full animation sequence
    const timers: NodeJS.Timeout[] = [];

    // Stage 1: Book appears (already showing)
    timers.push(setTimeout(() => setStage("opening"), 400));
    // Stage 2: Cover opens
    timers.push(setTimeout(() => setStage("pages"), 1000));
    // Stage 3: Page flip
    timers.push(setTimeout(() => setStage("reveal"), 1400));
    // Stage 4: Dashboard reveal
    timers.push(setTimeout(handleComplete, 2200));

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(skipTimer);
    };
  }, [isOpen, shouldReduceMotion, handleComplete]);

  if (!isOpen && stage === "complete") return null;

  // Reduced motion: simple fade with logo
  if (shouldReduceMotion) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{ backgroundColor: "#0D0D0D" }}
          >
            {/* Logo */}
            <div className="flex items-center gap-4 mb-4">
              {logoUrl ? (
                <img src={logoUrl} alt={firmName} className="h-16 w-auto" style={{ filter: `drop-shadow(0 0 8px ${accentColor}40)` }} />
              ) : (
                <div
                  className="p-4 rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${accentColor}20 0%, transparent 100%)`,
                    border: `2px solid ${accentColor}`,
                  }}
                >
                  <Scale size={40} style={{ color: accentColor }} />
                </div>
              )}
            </div>
            <p className="text-lg font-medium" style={{ color: accentColor }}>
              {firmName}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && stage !== "complete" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#0D0D0D" }}
        >
          {/* Subtle vignette overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)",
            }}
          />

          {/* Skip button */}
          <AnimatePresence>
            {showSkip && stage !== "reveal" && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                onClick={handleSkip}
                className="absolute bottom-8 right-8 text-sm font-medium transition-colors cursor-pointer"
                style={{ color: "#666666" }}
              >
                Skip intro
              </motion.button>
            )}
          </AnimatePresence>

          {/* Loading text */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: stage === "closed" || stage === "opening" ? 0.8 : 0, y: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute text-sm font-medium tracking-wide"
            style={{
              color: accentColor,
              top: "calc(50% + 160px)",
            }}
          >
            Opening Case File...
          </motion.p>

          {/* Book container */}
          <div
            className="relative"
            style={{
              perspective: "1500px",
              perspectiveOrigin: "center center",
            }}
          >
            {/* Book wrapper */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: stage === "reveal" ? 1.05 : 1,
                opacity: 1,
              }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative"
              style={{
                transformStyle: "preserve-3d",
              }}
            >
              {/* Book spine (visible when opening) */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: stage !== "closed" ? 1 : 0 }}
                className="absolute left-0 top-0 h-full w-6 origin-left"
                style={{
                  background: `linear-gradient(90deg, #1a1410 0%, #2a2018 50%, #1a1410 100%)`,
                  transform: "translateX(-12px) rotateY(90deg)",
                  boxShadow: "inset 2px 0 8px rgba(0,0,0,0.5)",
                }}
              />

              {/* Back cover (inner pages visible) */}
              <div
                className="relative overflow-hidden"
                style={{
                  width: "320px",
                  height: "420px",
                  background: "linear-gradient(135deg, #F5F0E8 0%, #EDE5D8 100%)",
                  borderRadius: "4px 8px 8px 4px",
                  boxShadow: "inset 0 0 20px rgba(0,0,0,0.1), 0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                {/* Page lines */}
                <div className="absolute inset-6 flex flex-col gap-3 opacity-20">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-px w-full"
                      style={{
                        background: "#8B7355",
                        width: `${85 + Math.random() * 10}%`,
                      }}
                    />
                  ))}
                </div>

                {/* Dashboard reveal overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: stage === "reveal" ? 1 : 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #F8F9FA 0%, #FFFFFF 100%)",
                  }}
                >
                  {/* Mini dashboard preview */}
                  <div className="w-full h-full p-4 flex">
                    {/* Mini sidebar */}
                    <div
                      className="w-16 h-full rounded-l-md"
                      style={{ backgroundColor: "#395B45" }}
                    >
                      <div className="p-2 flex flex-col gap-2 mt-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div
                            key={i}
                            className="h-2 rounded-full"
                            style={{
                              backgroundColor: i === 1 ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                              width: `${60 + i * 5}%`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Mini content */}
                    <div className="flex-1 p-3 flex flex-col gap-2">
                      <div className="h-3 w-24 rounded" style={{ backgroundColor: "#E0E0E0" }} />
                      <div className="h-2 w-40 rounded" style={{ backgroundColor: "#F0F0F0" }} />
                      <div className="flex gap-2 mt-2">
                        <div className="h-6 w-16 rounded" style={{ backgroundColor: "#395B45" }} />
                        <div className="h-6 w-16 rounded" style={{ backgroundColor: "#E8E8E8" }} />
                      </div>
                      <div
                        className="flex-1 mt-2 rounded"
                        style={{ backgroundColor: "#FAFAFA", border: "1px solid #E8E8E8" }}
                      />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Page flip effect */}
              <motion.div
                initial={{ rotateY: 0 }}
                animate={{
                  rotateY: stage === "pages" || stage === "reveal" ? -160 : 0,
                  opacity: stage === "pages" || stage === "reveal" ? 0 : 1,
                }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute inset-0 origin-left"
                style={{
                  width: "320px",
                  height: "420px",
                  background: "linear-gradient(135deg, #FAF8F5 0%, #F0EBE3 100%)",
                  borderRadius: "2px 6px 6px 2px",
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                }}
              >
                <div className="absolute inset-6 flex flex-col gap-3 opacity-15">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-px"
                      style={{
                        background: "#8B7355",
                        width: `${70 + Math.random() * 25}%`,
                      }}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Front cover */}
              <motion.div
                initial={{ rotateY: 0 }}
                animate={{
                  rotateY:
                    stage === "opening"
                      ? -25
                      : stage === "pages" || stage === "reveal"
                      ? -170
                      : 0,
                }}
                transition={{
                  duration: stage === "opening" ? 0.5 : 0.5,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className="absolute inset-0 origin-left"
                style={{
                  width: "320px",
                  height: "420px",
                  transformStyle: "preserve-3d",
                }}
              >
                {/* Cover front face */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center p-8"
                  style={{
                    background: `linear-gradient(145deg, #2A2018 0%, #1A1410 50%, #0F0C08 100%)`,
                    borderRadius: "4px 8px 8px 4px",
                    border: `3px solid ${accentColor}`,
                    boxShadow: `
                      inset 0 2px 4px rgba(255,255,255,0.05),
                      inset 0 -2px 4px rgba(0,0,0,0.3),
                      0 10px 40px rgba(0,0,0,0.5),
                      0 0 0 1px rgba(0,0,0,0.3)
                    `,
                    backfaceVisibility: "hidden",
                  }}
                >
                  {/* Leather texture overlay */}
                  <div
                    className="absolute inset-0 opacity-30 pointer-events-none rounded-r-lg"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    }}
                  />

                  {/* Inner gold border */}
                  <div
                    className="absolute rounded-r-md"
                    style={{
                      inset: "16px",
                      border: `1px solid ${accentColor}40`,
                      borderRadius: "2px 4px 4px 2px",
                    }}
                  />

                  {/* Corner ornaments */}
                  {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => (
                    <div
                      key={pos}
                      className="absolute w-8 h-8"
                      style={{
                        [pos.includes("top") ? "top" : "bottom"]: "24px",
                        [pos.includes("left") ? "left" : "right"]: "24px",
                        borderTop: pos.includes("top") ? `2px solid ${accentColor}60` : "none",
                        borderBottom: pos.includes("bottom") ? `2px solid ${accentColor}60` : "none",
                        borderLeft: pos.includes("left") ? `2px solid ${accentColor}60` : "none",
                        borderRight: pos.includes("right") ? `2px solid ${accentColor}60` : "none",
                      }}
                    />
                  ))}

                  {/* Logo */}
                  <div className="relative z-10 flex flex-col items-center">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={firmName}
                        className="h-20 w-auto mb-6"
                        style={{
                          filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.5)) sepia(30%) saturate(150%) hue-rotate(15deg) brightness(0.9)`,
                        }}
                      />
                    ) : (
                      <div
                        className="p-5 rounded-lg mb-6"
                        style={{
                          background: `linear-gradient(135deg, ${accentColor}30 0%, ${accentColor}10 100%)`,
                          border: `2px solid ${accentColor}`,
                          boxShadow: `0 4px 12px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.1)`,
                        }}
                      >
                        <Scale size={48} style={{ color: accentColor }} />
                      </div>
                    )}

                    {/* Firm name */}
                    <h1
                      className="text-center font-serif text-xl font-semibold tracking-wide"
                      style={{
                        color: accentColor,
                        textShadow: `0 2px 4px rgba(0,0,0,0.5)`,
                        fontFamily: "Georgia, serif",
                      }}
                    >
                      {firmName}
                    </h1>

                    {/* Decorative line */}
                    <div
                      className="w-24 h-px mt-4"
                      style={{
                        background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
                      }}
                    />

                    {/* Subtitle */}
                    <p
                      className="mt-4 text-xs tracking-widest uppercase"
                      style={{ color: `${accentColor}80` }}
                    >
                      Case Management System
                    </p>
                  </div>
                </div>

                {/* Cover back face (inside of cover) */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, #3A3028 0%, #2A2018 100%)`,
                    borderRadius: "4px 8px 8px 4px",
                    transform: "rotateY(180deg)",
                    backfaceVisibility: "hidden",
                  }}
                />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
