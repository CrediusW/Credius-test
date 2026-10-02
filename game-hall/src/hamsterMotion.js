// @ts-check

(function () {
  "use strict";

  const motion = globalThis.MotionDom;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const statePattern = /(?:^|\s)hamster-state-([\w-]+)/;
  const mounted = new Map();
  let refreshQueued = false;

  const profiles = {
    idle: {
      duration: 2.8,
      poses: [
        "translateY(0px) rotate(0deg) scale(1)",
        "translateY(-2px) rotate(0.6deg) scale(1.012, 0.994)",
        "translateY(-3px) rotate(-0.4deg) scale(1.016, 0.99)",
        "translateY(0px) rotate(0deg) scale(1)",
      ],
      shadow: ["scale(1)", "scale(0.97)", "scale(0.96)", "scale(1)"],
      spring: { stiffness: 210, damping: 19, mass: 0.9 },
    },
    walking: {
      duration: 0.62,
      poses: [
        "translate(-2px, 1px) rotate(-2.8deg) scale(1.025, 0.975)",
        "translate(0px, -5px) rotate(1.2deg) scale(0.99, 1.02)",
        "translate(2px, 1px) rotate(2.8deg) scale(1.025, 0.975)",
        "translate(0px, -5px) rotate(-1.2deg) scale(0.99, 1.02)",
      ],
      shadow: ["scale(1.04, 0.94)", "scale(0.91)", "scale(1.04, 0.94)", "scale(0.91)"],
      spring: { stiffness: 300, damping: 21, mass: 0.75 },
    },
    running: {
      duration: 0.4,
      poses: [
        "translate(-4px, 3px) rotate(-5deg) scale(1.075, 0.91)",
        "translate(1px, -11px) rotate(3deg) scale(0.94, 1.075)",
        "translate(5px, 2px) rotate(5deg) scale(1.06, 0.92)",
        "translate(-1px, -9px) rotate(-3deg) scale(0.95, 1.06)",
      ],
      shadow: ["scale(1.12, 0.86)", "scale(0.78)", "scale(1.08, 0.88)", "scale(0.8)"],
      spring: { stiffness: 390, damping: 22, mass: 0.65 },
    },
    playing: {
      duration: 0.96,
      poses: [
        "translateY(4px) rotate(-1deg) scale(1.08, 0.9)",
        "translateY(-7px) rotate(2deg) scale(0.97, 1.04)",
        "translateY(-24px) rotate(-3deg) scale(0.95, 1.07)",
        "translateY(-19px) rotate(3deg) scale(0.97, 1.045)",
        "translateY(-6px) rotate(-1deg) scale(1.01, 0.99)",
        "translateY(3px) rotate(0deg) scale(1.07, 0.91)",
      ],
      shadow: ["scale(1.12)", "scale(0.94)", "scale(0.72)", "scale(0.78)", "scale(0.96)", "scale(1.1)"],
      spring: { stiffness: 330, damping: 18, mass: 0.78 },
    },
    rolling: {
      duration: 1.08,
      poses: [
        "translate(-5px, 3px) rotate(-8deg) scale(1.05, 0.95)",
        "translate(-18px, -5px) rotate(92deg) scale(0.97, 1.03)",
        "translate(2px, -12px) rotate(205deg) scale(0.95, 1.05)",
        "translate(19px, -3px) rotate(318deg) scale(1.03, 0.97)",
        "translate(0px, 1px) rotate(360deg) scale(1.04, 0.96)",
      ],
      shadow: ["scale(1.08)", "scale(0.82)", "scale(0.72)", "scale(0.86)", "scale(1.08)"],
      spring: { stiffness: 280, damping: 18, mass: 0.82 },
    },
    sleeping: {
      duration: 3.8,
      poses: [
        "translateY(2px) rotate(-1deg) scale(1.02, 0.985)",
        "translateY(4px) rotate(-1.4deg) scale(1.035, 0.97)",
        "translateY(2px) rotate(-1deg) scale(1.02, 0.985)",
      ],
      shadow: ["scale(1.05)", "scale(1.08, 0.96)", "scale(1.05)"],
      spring: { stiffness: 150, damping: 24, mass: 1.15 },
    },
    eating: {
      duration: 0.7,
      poses: [
        "translateY(1px) rotate(-0.8deg) scale(1.018, 0.985)",
        "translateY(0px) rotate(0.9deg) scale(0.99, 1.018)",
        "translateY(2px) rotate(-0.4deg) scale(1.025, 0.98)",
        "translateY(0px) rotate(0deg) scale(1)",
      ],
      shadow: ["scale(1.03)", "scale(0.99)", "scale(1.035)", "scale(1)"],
      spring: { stiffness: 260, damping: 22, mass: 0.82 },
    },
    bathing: {
      duration: 0.54,
      poses: [
        "translateX(0px) rotate(0deg) scale(1.03, 0.98)",
        "translateX(-6px) rotate(-3deg) scale(0.98, 1.025)",
        "translateX(6px) rotate(3deg) scale(0.98, 1.025)",
        "translateX(0px) rotate(0deg) scale(1.03, 0.98)",
      ],
      shadow: ["scale(1.04)", "scale(0.97)", "scale(0.97)", "scale(1.04)"],
      spring: { stiffness: 360, damping: 20, mass: 0.7 },
    },
    petting: {
      duration: 0.9,
      poses: [
        "translateY(0px) rotate(0deg) scale(1)",
        "translateY(4px) rotate(-2deg) scale(1.055, 0.93)",
        "translateY(-5px) rotate(2deg) scale(0.97, 1.045)",
        "translateY(0px) rotate(0deg) scale(1)",
      ],
      shadow: ["scale(1)", "scale(1.08)", "scale(0.94)", "scale(1)"],
      spring: { stiffness: 250, damping: 17, mass: 0.8 },
    },
  };

  profiles.celebrating = profiles.playing;
  profiles.wiggling = profiles.bathing;
  profiles.outing = profiles.walking;
  profiles.working = profiles.walking;
  profiles.studying = profiles.idle;
  profiles.headtilt = profiles.petting;

  function getState(svg) {
    return svg.className.baseVal.match(statePattern)?.[1] ?? "idle";
  }

  function stopControls(controls) {
    controls.forEach((control) => control?.stop?.());
  }

  function stop(svg) {
    const record = mounted.get(svg);
    if (!record) return;
    stopControls(record.controls);
    record.observer?.disconnect();
    if (record.springRoot?.isConnected && record.character?.parentNode === record.springRoot) {
      record.springRoot.parentNode?.insertBefore(record.character, record.springRoot);
      record.springRoot.remove();
    }
    svg.classList.remove("hamster-motion-powered", "hamster-motion-paused");
    mounted.delete(svg);
  }

  function pause(svg, paused) {
    const record = mounted.get(svg);
    if (!record || record.paused === paused) return;
    record.paused = paused;
    svg.classList.toggle("hamster-motion-paused", paused);
    record.controls.forEach((control) => {
      if (paused) control?.pause?.();
      else control?.play?.();
    });
  }

  function mount(svg) {
    const state = getState(svg);
    const profile = profiles[state] ?? profiles.idle;
    const existing = mounted.get(svg);
    const motionDisabled =
      document.body.classList.contains("hamster-motion-off") ||
      document.body.classList.contains("hamster-motion-simple") ||
      !motion?.animateElement;

    if (motionDisabled) {
      stop(svg);
      return;
    }
    if (existing?.state === state) return;
    stop(svg);

    const character = svg.querySelector(".hamster-character");
    if (!character || !profile) return;

    const springRoot = document.createElementNS(SVG_NS, "g");
    springRoot.classList.add("hamster-motion-spring");
    character.parentNode.insertBefore(springRoot, character);
    springRoot.append(character);
    svg.classList.add("hamster-motion-powered");

    const controls = [
      ...motion.animateElement(
        springRoot,
        { transform: ["translateY(5px) scale(1.07, 0.91)", "translateY(0px) scale(1)"] },
        { type: "spring", ...profile.spring },
      ),
      ...motion.animateElement(
        character,
        { transform: profile.poses },
        { duration: profile.duration, ease: [0.42, 0, 0.22, 1], repeat: Infinity, repeatType: "loop" },
      ),
    ];

    const shadow = svg.querySelector(".hamster-raster-shadow");
    if (shadow) {
      controls.push(
        ...motion.animateElement(
          shadow,
          { transform: profile.shadow, opacity: profile.shadow.map((_, index) => (index % 2 ? 0.17 : 0.25)) },
          { duration: profile.duration, ease: "easeInOut", repeat: Infinity, repeatType: "loop" },
        ),
      );
    }

    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => pause(svg, !entry.isIntersecting), { rootMargin: "80px" })
        : null;
    observer?.observe(svg);
    mounted.set(svg, { state, controls, observer, paused: false, springRoot, character });
    pause(svg, document.visibilityState !== "visible");
  }

  function refresh() {
    refreshQueued = false;
    for (const svg of mounted.keys()) {
      if (!svg.isConnected) stop(svg);
    }
    document.querySelectorAll(".hamster-svg").forEach(mount);
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(refresh);
  }

  function stopAll() {
    [...mounted.keys()].forEach(stop);
  }

  globalThis.CrediusHamsterMotion = { refresh: queueRefresh, stopAll, profiles };

  if (typeof document !== "undefined") {
    new MutationObserver(queueRefresh).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") queueRefresh();
      else mounted.forEach((_, svg) => pause(svg, true));
    });
    queueRefresh();
  }
})();
