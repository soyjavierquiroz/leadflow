/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const VISITOR_STORAGE_KEY = 'visitor_data_v3';

export interface VisitorData {
  ip: string;
  city: string;
  region: string;
  country_name: string;
  country_code: string;
  timezone: string;
  currency: string;
  country_calling_code: string;
}

interface VisitorContextValue {
  visitorData: VisitorData | null;
  isLoading: boolean;
}

const VisitorContext = createContext<VisitorContextValue | undefined>(undefined);

function normalizeVisitorData(payload: any): VisitorData {
  return {
    ip: payload.ip ?? '',
    city: payload.city ?? '',
    region: payload.region ?? '',
    country_name: payload.country_name ?? '',
    // IPAPI a veces devuelve el código en 'country'
    country_code: payload.country_code || payload.country || '',
    timezone: payload.timezone ?? '',
    currency: payload.currency ?? '',
    country_calling_code: payload.country_calling_code ?? '',
  };
}

export function VisitorProvider({ children }: { children: ReactNode }) {
  const [visitorData, setVisitorData] = useState<VisitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadVisitorData = async () => {
      if (typeof window === 'undefined') {
        if (isMounted) setIsLoading(false);
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
        // Usamos GeoJS: es rápido, no requiere API key y rara vez es bloqueado por AdBlockers
        const response = await fetch('https://get.geojs.io/v1/ip/geo.json', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`GeoJS request failed with status ${response.status}`);
        }

        const payload = await response.json();

        // Mapeamos la respuesta de GeoJS a nuestra interfaz
        const normalized = normalizeVisitorData({
          ip: payload.ip,
          city: payload.city,
          region: payload.region,
          country_name: payload.country, // GeoJS devuelve el nombre en 'country'
          country_code: payload.country_code,
          timezone: payload.timezone,
          currency: '', // GeoJS no lo provee por defecto, pero no bloquea el input
          country_calling_code: '',
        });

        window.sessionStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(normalized));

        if (isMounted) {
          setVisitorData(normalized);
        }
      } catch (error) {
        console.error('🚀 Error detectando ubicación del visitante:', error);
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

  const contextValue = useMemo(
    () => ({
      visitorData,
      isLoading,
    }),
    [isLoading, visitorData],
  );

  return <VisitorContext.Provider value={contextValue}>{children}</VisitorContext.Provider>;
}

export function useVisitor() {
  const context = useContext(VisitorContext);

  if (!context) {
    throw new Error('useVisitor must be used inside a VisitorProvider');
  }

  return context;
}
