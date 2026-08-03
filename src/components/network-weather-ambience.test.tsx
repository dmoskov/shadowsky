import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NetworkWeatherState } from "../services/network-weather";
import { WEATHER_COLORS } from "../services/network-weather";
import { NetworkWeatherBackground } from "./NetworkWeatherBackground";
import { WeatherBar } from "./WeatherBar";

// The ambient layer must read as colour, never as movement. These pin both
// halves of that: no animation loop, and colour that actually varies.

function weatherState(
  overrides: Partial<NetworkWeatherState> = {},
): NetworkWeatherState {
  return {
    warmth: 0.5,
    energy: 0.5,
    energyReliable: true,
    conviction: 0.5,
    dominantHue: "indigo",
    secondaryHue: "sage",
    source: "pan",
    timestamp: 1_700_000_000_000,
    emergence: null,
    narratives: null,
    ...overrides,
  };
}

function opacityOf(weather: NetworkWeatherState): number {
  const { container } = render(<NetworkWeatherBackground weather={weather} />);
  const layer = container.firstElementChild as HTMLElement;
  return Number.parseFloat(layer.style.opacity);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ambient weather layer", () => {
  it("never schedules an animation frame, even with an emergent thread", () => {
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");

    render(
      <NetworkWeatherBackground
        weather={weatherState({
          emergence: {
            emergentThreads: [
              {
                token: "something",
                ageMinutes: 5,
                countRatio: 3,
                isEmergent: true,
                pulseIntensity: 1,
              },
            ],
          } as NetworkWeatherState["emergence"],
        })}
      />,
    );

    expect(raf).not.toHaveBeenCalled();
  });

  it("sits below the ceiling when energy is only a placeholder", () => {
    // A saturated/unavailable energy must not render as "maximum activity".
    const unknown = opacityOf(
      weatherState({ energy: 0.5, energyReliable: false }),
    );
    const busy = opacityOf(weatherState({ energy: 1, energyReliable: true }));

    expect(unknown).toBeLessThan(busy);
  });

  it("maps energy across the whole range instead of clamping it flat", () => {
    // The previous Math.min(0.07, ...) collapsed everything above ~0.17 energy
    // to one value, so a busy network looked identical to a quiet one.
    const quiet = opacityOf(weatherState({ energy: 0 }));
    const middling = opacityOf(weatherState({ energy: 0.5 }));
    const busy = opacityOf(weatherState({ energy: 1 }));

    expect(quiet).toBeLessThan(middling);
    expect(middling).toBeLessThan(busy);
  });

  it("expresses emergence as extra colour rather than a pulse", () => {
    const calm = opacityOf(weatherState({ energy: 0.5 }));
    const emergent = opacityOf(
      weatherState({
        energy: 0.5,
        emergence: {
          emergentThreads: [
            {
              token: "x",
              ageMinutes: 1,
              countRatio: 2,
              isEmergent: true,
              pulseIntensity: 1,
            },
          ],
        } as NetworkWeatherState["emergence"],
      }),
    );

    expect(emergent).toBeGreaterThan(calm);
  });
});

describe("weather bar tint", () => {
  it("carries the dominant hue instead of a fixed brand tint", () => {
    const { container } = render(
      <MemoryRouter>
        <WeatherBar weather={weatherState({ dominantHue: "rust" })} />
      </MemoryRouter>,
    );

    const bar = container.firstElementChild as HTMLElement;
    // Light theme is the jsdom default (no .dark on <html>).
    const { light } = WEATHER_COLORS.rust;
    const [r, g, b] = [1, 3, 5].map((i) =>
      parseInt(light.substring(i, i + 2), 16),
    );

    expect(bar.style.backgroundColor).toBe(`rgba(${r}, ${g}, ${b}, 0.14)`);
    expect(bar.style.backgroundColor).not.toContain("--asph-primary");
  });
});
