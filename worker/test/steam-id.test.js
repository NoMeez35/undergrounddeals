import { describe, expect, it } from "vitest";
import { lireSteamId } from "../src/steam-id.js";

describe("lireSteamId", () => {
  it("accepte un SteamID64 de 17 chiffres", () => {
    expect(lireSteamId("76561197960287930")).toBe("76561197960287930");
  });

  it.each([["7656119796028793"], ["765611979602879300"], ["7656119796028793a"], [""], [null], [undefined]])(
    "refuse %s",
    (texte) => {
      expect(lireSteamId(texte)).toBeNull();
    },
  );
});
