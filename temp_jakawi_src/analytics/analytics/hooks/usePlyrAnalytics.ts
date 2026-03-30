import { useEffect, useRef } from "react";
import type Plyr from "plyr";
import { useMetaPixel } from "./useMetaPixel";

const PROGRESS_MILESTONES = [25, 50, 75, 100] as const;

const toSafeNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return value;
};

const calculateProgressPercent = (
  currentTime: number,
  duration: number,
): number => {
  if (duration <= 0) {
    return 0;
  }

  const raw = (currentTime / duration) * 100;
  const bounded = Math.min(100, Math.max(0, raw));
  return Math.round(bounded * 100) / 100;
};

export const usePlyrAnalytics = (
  player: Plyr | null,
  videoId: string,
  title: string,
): void => {
  const { track } = useMetaPixel();
  const firedMilestonesRef = useRef<Set<number>>(new Set<number>());

  useEffect(() => {
    firedMilestonesRef.current.clear();
  }, [videoId, title]);

  useEffect(() => {
    if (player === null) {
      return;
    }

    const trackVideoPlay = (): void => {
      const currentTime = toSafeNumber(player.currentTime);
      const duration = toSafeNumber(player.duration);
      const progressPercent = calculateProgressPercent(currentTime, duration);

      if (currentTime <= 1) {
        firedMilestonesRef.current.clear();
      }

      void track("VideoPlay", {
        video_id: videoId,
        title,
        current_time_seconds: currentTime,
        duration_seconds: duration,
        progress_percent: progressPercent,
      });
    };

    const trackVideoPause = (): void => {
      const currentTime = toSafeNumber(player.currentTime);
      const duration = toSafeNumber(player.duration);
      const progressPercent = calculateProgressPercent(currentTime, duration);

      void track("VideoPause", {
        video_id: videoId,
        title,
        current_time_seconds: currentTime,
        duration_seconds: duration,
        progress_percent: progressPercent,
      });
    };

    const trackProgressMilestones = (): void => {
      const currentTime = toSafeNumber(player.currentTime);
      const duration = toSafeNumber(player.duration);
      const progressPercent = calculateProgressPercent(currentTime, duration);
      const firedMilestones = firedMilestonesRef.current;

      for (const milestone of PROGRESS_MILESTONES) {
        if (progressPercent >= milestone && !firedMilestones.has(milestone)) {
          firedMilestones.add(milestone);

          void track("VideoProgress", {
            video_id: videoId,
            title,
            current_time_seconds: currentTime,
            duration_seconds: duration,
            progress_percent: progressPercent,
            milestone_percent: milestone,
          });
        }
      }
    };

    const trackVideoComplete = (): void => {
      const currentTime = toSafeNumber(player.currentTime);
      const duration = toSafeNumber(player.duration);
      const progressPercent = 100;
      const firedMilestones = firedMilestonesRef.current;

      if (!firedMilestones.has(100)) {
        firedMilestones.add(100);

        void track("VideoProgress", {
          video_id: videoId,
          title,
          current_time_seconds: currentTime,
          duration_seconds: duration,
          progress_percent: progressPercent,
          milestone_percent: 100,
        });
      }
    };

    player.on("play", trackVideoPlay);
    player.on("pause", trackVideoPause);
    player.on("timeupdate", trackProgressMilestones);
    player.on("ended", trackVideoComplete);

    return () => {
      player.off("play", trackVideoPlay);
      player.off("pause", trackVideoPause);
      player.off("timeupdate", trackProgressMilestones);
      player.off("ended", trackVideoComplete);
    };
  }, [player, title, track, videoId]);
};
