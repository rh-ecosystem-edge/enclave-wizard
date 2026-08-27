import { describe, expect, it } from "vitest";
import { isValidDnsZone } from "./dnsZone.ts";

describe("isValidDnsZone", () => {
  it.each([
    "example.com",
    "foo.bar.example.com",
    "lab.local",
    "example.com.",
    "xn--bcher-kva.example",
  ])("accepts %s", (zone) => {
    expect(isValidDnsZone(zone)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "example",
    "not a zone",
    "-bad.com",
    "foo..bar.com",
    ".example.com",
    "192.168.1.1",
    "has_underscore.com",
  ])("rejects %s", (zone) => {
    expect(isValidDnsZone(zone)).toBe(false);
  });
});
