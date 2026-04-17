import Script from "next/script";

type PublicRuntimePixelScriptsProps = {
  metaPixelId?: string | null;
  tiktokPixelId?: string | null;
};

const normalizePixelId = (value?: string | null) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildMetaPixelScript = (pixelId: string) =>
  `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?` +
  `n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;` +
  `n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;` +
  `t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}` +
  `(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');` +
  `fbq('init', ${JSON.stringify(pixelId)});fbq('track', 'PageView');`;

const buildTikTokPixelScript = (pixelId: string) =>
  `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];` +
  `ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];` +
  `ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};` +
  `for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);` +
  `ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";` +
  `ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;` +
  `ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";` +
  `o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];` +
  `a.parentNode.insertBefore(o,a)};ttq.load(${JSON.stringify(pixelId)});ttq.page();}` +
  `(window, document, "ttq");`;

export function PublicRuntimePixelScripts({
  metaPixelId,
  tiktokPixelId,
}: PublicRuntimePixelScriptsProps) {
  const resolvedMetaPixelId = normalizePixelId(metaPixelId);
  const resolvedTikTokPixelId = normalizePixelId(tiktokPixelId);

  if (!resolvedMetaPixelId && !resolvedTikTokPixelId) {
    return null;
  }

  return (
    <>
      {resolvedMetaPixelId ? (
        <>
          <Script
            id={`meta-pixel-${resolvedMetaPixelId}`}
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: buildMetaPixelScript(resolvedMetaPixelId),
            }}
          />
          <noscript>
            <img
              alt=""
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${encodeURIComponent(
                resolvedMetaPixelId,
              )}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}
      {resolvedTikTokPixelId ? (
        <Script
          id={`tiktok-pixel-${resolvedTikTokPixelId}`}
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: buildTikTokPixelScript(resolvedTikTokPixelId),
          }}
        />
      ) : null}
    </>
  );
}
