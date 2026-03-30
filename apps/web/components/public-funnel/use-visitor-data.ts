"use client";

import { useEffect, useMemo, useState } from "react";

type VisitorData = {
  ip: string;
  city: string;
  region: string;
  countryName: string;
  countryCode: string;
  timezone: string;
};

const VISITOR_STORAGE_KEY = "leadflow:visitor-data:v1";

function normalizeVisitorData(payload: unknown): VisitorData {
  const record =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};

  return {
    ip: typeof record.ip === "string" ? record.ip : "",
    city: typeof record.city === "string" ? record.city : "",
    region: typeof record.region === "string" ? record.region : "",
    countryName:
      typeof record.country_name === "string"
        ? record.country_name
        : typeof record.country === "string"
          ? record.country
          : "",
    countryCode:
      typeof record.country_code === "string"
        ? record.country_code.toUpperCase()
        : typeof record.country === "string" && record.country.length === 2
          ? record.country.toUpperCase()
          : "",
    timezone: typeof record.timezone === "string" ? record.timezone : "",
  };
}

export function useVisitorData(defaultCountry = "US") {
  const [visitorData, setVisitorData] = useState<VisitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadVisitorData = async () => {
      if (typeof window === "undefined") {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      const cached = window.sessionStorage.getItem(VISITOR_STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as VisitorData;
          if (isMounted) {
            setVisitorData(normalizeVisitorData(parsed));
            setIsLoading(false);
          }
          return;
        } catch {
          window.sessionStorage.removeItem(VISITOR_STORAGE_KEY);
        }
      }

      try {
        const response = await fetch("https://get.geojs.io/v1/ip/geo.json", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`GeoJS request failed with status ${response.status}`);
        }

        const payload = normalizeVisitorData(await response.json());

        window.sessionStorage.setItem(
          VISITOR_STORAGE_KEY,
          JSON.stringify(payload),
        );

        if (isMounted) {
          setVisitorData(payload);
        }
      } catch {
        if (isMounted) {
          setVisitorData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadVisitorData();

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedCountryCode = useMemo(() => {
    const detected = visitorData?.countryCode?.trim().toUpperCase();
    return detected || defaultCountry.trim().toUpperCase() || "US";
  }, [defaultCountry, visitorData?.countryCode]);

  return {
    visitorData,
    isLoading,
    resolvedCountryCode,
  };
}
