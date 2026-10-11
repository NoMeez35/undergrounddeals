import { describe, expect, it } from "vitest";
import { lireLienSteam } from "../src/lien-steam.js";

describe("lireLienSteam", () => {
  it.each([
    ["620", 620],
    ["https://store.steampowered.com/app/620/Portal_2/", 620],
    ["http://STORE.steampowered.com/app/620?snr=1_4_4__129", 620],
    ["https://steamcommunity.com/app/620/discussions/", 620],
    ["https://store.steampowered.com/agecheck/app/620/", 620],
  ])("lit l'AppID de %s", (texte, appId) => {
    expect(lireLienSteam(texte)).toEqual({ appId });
  });

  it.each([["https://store.steampowered.com/sub/7932/"], ["store.steampowered.com/bundle/232"]])(
    "reconnaît un pack : %s",
    (texte) => {
      expect(lireLienSteam(texte)).toEqual({ pack: true });
    },
  );

  it.each([
    ["https://store.steampowered.com/app/620abc"],
    ["https://store.steampowered.com.pirate.test/app/620"],
    ["https://store.steampowered.com/search/?term=portal"],
    ["-620"],
    ["12345678901"],
    [""],
    [null],
  ])("refuse %s", (texte) => {
    expect(lireLienSteam(texte)).toBeNull();
  });
});
