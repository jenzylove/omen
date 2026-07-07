/**
 * Demo seed — loads three realistic forecasts into the store so the dashboard
 * and App Home look lived-in from the moment the demo starts.
 *
 * Only runs when the DB is empty, so real forecasts are never overwritten on restart.
 * Can also be run standalone: tsx src/seed.ts
 */
import { saveForecast, getForecastCount } from "./store.js";
import { SAMPLE_FORECAST, SEED_FORECAST_2, SEED_FORECAST_3 } from "./engine/fixtures.js";

export function seedDemoData(): void {
  if (getForecastCount() > 0) {
    console.log("[omen] DB already has forecasts — skipping demo seed.");
    return;
  }
  saveForecast(SEED_FORECAST_3); // oldest first so sort order is right
  saveForecast(SEED_FORECAST_2);
  saveForecast(SAMPLE_FORECAST);
  console.log("[omen] Demo seed loaded: 3 forecasts (28, 61, 79 readiness)");
}
