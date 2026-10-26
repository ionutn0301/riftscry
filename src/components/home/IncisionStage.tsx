import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import gsap from "gsap";
import {
  featuredIds,
  type ChampionId,
  type ExperienceState,
} from "./incision-data";

const mediaQuery = "(max-width: 760px)";
const subscribeMedia = (update: () => void) => {
  const query = matchMedia(mediaQuery);
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
};
const mobileSnapshot = () => matchMedia(mediaQuery).matches;
export default function IncisionStage({
  state,
  choose,
}: {
  state: ExperienceState;
  choose: (id: ChampionId) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const previous = useRef("");
  const mobile = useSyncExternalStore(
    subscribeMedia,
    mobileSnapshot,
    () => false,
  );
  useLayoutEffect(() => {
    const element = root.current!;
    for (const image of element.querySelectorAll<HTMLImageElement>(
      ".actor-silhouette img",
    )) {
      if (
        image.complete &&
        image.naturalWidth === 0 &&
        !image.dataset.fallback
      ) {
        image.dataset.fallback = "true";
        image.src = `/images/story/${image.closest<HTMLElement>("[data-actor]")!.dataset.actor}.jpg`;
        image.parentElement!.style.maskImage = "none";
      }
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const first = !previous.current;
    const duration = first || reduce || !history.state?.riftscry ? 0 : 0.62;
    const timeline = gsap.timeline({
      defaults: { duration, ease: "power3.inOut", overwrite: "auto" },
    });
    for (const id of featuredIds) {
      const actor = element.querySelector(`[data-actor="${id}"]`)!;
      const active = id === state.champion;
      const overview = state.view === "patch";
      const record = state.view === "record";
      const pool = state.view === "pool";
      const azir = id === "Azir";
      const target = mobile
        ? {
            left: overview
              ? azir
                ? "-48%"
                : "-27%"
              : active
                ? azir
                  ? "-82%"
                  : "-36%"
                : "75%",
            top: overview ? (azir ? "31%" : "44%") : "4%",
            width: overview ? (azir ? "125%" : "130%") : "142%",
            rotation: azir ? 0 : active ? -8 : 0,
            opacity: overview || (active && !pool) ? 1 : 0.12,
          }
        : {
            left: overview
              ? azir
                ? "-17%"
                : "22%"
              : active
                ? azir
                  ? record
                    ? "-30%"
                    : "-26%"
                  : record
                    ? "-29%"
                    : "-26%"
                : "-26%",
            top: overview
              ? azir
                ? "19%"
                : "24%"
              : azir
                ? record
                  ? "10%"
                  : "0%"
                : record
                  ? "14%"
                  : "8%",
            width: overview
              ? azir
                ? "70%"
                : "75%"
              : active
                ? record
                  ? "66%"
                  : "78%"
                : "43%",
            rotation: azir ? (record ? -4 : 0) : record ? -15 : active ? -7 : 7,
            opacity: overview || (active && !pool) ? 1 : 0.12,
          };
      if (record && active && state.change && state.change !== "Q-0") {
        const shift = state.change.startsWith("passive")
          ? 8
          : state.change === "W-1"
            ? -6
            : 0;
        target.rotation += shift;
        target.top = `${parseFloat(target.top) + Math.abs(shift)}%`;
      }
      gsap.set(actor, {
        width: "100%",
        left: 0,
        top: 0,
        transformOrigin: "0 0",
      });
      const pose = {
        x: (element.clientWidth * parseFloat(target.left)) / 100,
        y: (element.clientHeight * parseFloat(target.top)) / 100,
        scale: parseFloat(target.width) / 100,
        rotation: target.rotation,
        opacity: target.opacity,
      };
      if (duration && active && state.view === "champion" && !mobile) {
        timeline.to(
          actor,
          {
            y: pose.y - (azir ? 36 : -30),
            rotation: azir ? 2 : -12,
            duration: 0.2,
          },
          0,
        );
        timeline.to(actor, { ...pose, duration: 0.45 }, 0.2);
      } else timeline.to(actor, pose, 0);
    }
    const open = state.view === "record";
    const steel = state.champion === "Camille";
    timeline.to(
      element.querySelector(".incision-leaf-near"),
      {
        xPercent: open ? (steel ? -490 : -450) : 0,
        yPercent: open ? (steel ? 30 : -20) : 0,
        rotationY: open ? -24 : 0,
        rotationZ: open ? (steel ? -13 : 8) : steel ? -6 : 0,
        duration: duration ? 0.65 : 0,
      },
      0,
    );
    timeline.to(
      element.querySelector(".incision-leaf-far"),
      {
        xPercent: open ? 72 : 0,
        yPercent: open ? -16 : 0,
        rotationY: open ? 21 : 0,
        rotationZ: open ? (steel ? 9 : -7) : 0,
      },
      duration ? 0.08 : 0,
    );
    timeline.to(
      element.querySelector(".incision-seam"),
      {
        scaleY: open ? 1 : 0.45,
        opacity: open ? 0.7 : 0.18,
        x: open ? -60 : 0,
      },
      0,
    );
    previous.current = `${state.champion}:${state.view}:${state.change}`;
    return () => {
      timeline.kill();
    };
  }, [state.champion, state.view, state.change, mobile]);

  return (
    <div
      className="incision-stage"
      ref={root}
      aria-label="Featured champion artwork"
    >
      <div className="incision-atmosphere" aria-hidden="true" />
      <div className="incision-leaf incision-leaf-far" aria-hidden="true" />
      {featuredIds.map((id) => (
        <div key={id} className={`incision-actor actor-${id}`} data-actor={id}>
          <img
            className="actor-context"
            src={`/images/incision/${id}-context.webp`}
            alt=""
          />
          <button
            className="actor-silhouette"
            onClick={() => choose(id)}
            aria-label={`Explore ${id}'s changes`}
            style={{ maskImage: `url(/images/incision/${id}-figure.webp)` }}
            tabIndex={-1}
          >
            <img
              src={`/images/incision/${id}-figure.webp`}
              width="1215"
              height="717"
              alt=""
              fetchPriority="high"
              onError={(event) => {
                const image = event.currentTarget;
                if (!image.dataset.fallback) {
                  image.dataset.fallback = "true";
                  image.src = `/images/story/${id}.jpg`;
                  image.parentElement!.style.maskImage = "none";
                }
              }}
            />
          </button>
        </div>
      ))}
      <div className="incision-leaf incision-leaf-near" aria-hidden="true" />
      <div className="incision-seam" aria-hidden="true" />
    </div>
  );
}
