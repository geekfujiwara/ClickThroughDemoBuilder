/**
 * Application Insights テレメトリサービス
 *
 * VITE_APPINSIGHTS_CONNECTION_STRING が設定されていない場合は noop。
 */

let _appInsights: {
  trackEvent: (event: { name: string }, properties?: Record<string, string>) => void;
  trackException: (exception: { exception: Error }) => void;
  trackPageView: (pageView: { name: string; uri?: string }) => void;
} | null = null;

export async function initTelemetry(): Promise<void> {
  const connStr = import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING;
  if (!connStr) return;

  try {
    const { ApplicationInsights } = await import('@microsoft/applicationinsights-web');
    const ai = new ApplicationInsights({
      config: {
        connectionString: connStr,
        enableAutoRouteTracking: true,
        autoTrackPageVisitTime: true,
        disableFetchTracking: false,
        enableCorsCorrelation: true,
        samplingPercentage: 50,
      },
    });
    ai.loadAppInsights();
    _appInsights = ai;
  } catch {
    // Application Insights SDK が未インストールの場合は無視
  }
}

export function trackEvent(name: string, properties?: Record<string, string>): void {
  _appInsights?.trackEvent({ name }, properties);
}

export function trackException(error: Error): void {
  _appInsights?.trackException({ exception: error });
}

export function trackPageView(name: string, uri?: string): void {
  _appInsights?.trackPageView({ name, uri });
}
