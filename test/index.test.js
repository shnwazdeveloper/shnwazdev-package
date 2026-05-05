import test from "node:test";
import assert from "node:assert/strict";
import { greet, packageName, profile } from "../src/index.js";

test("exports package name", () => {
  assert.equal(packageName, "@shnwazdeveloper/shnwazdev");
});

test("greets by name", () => {
  assert.equal(greet("Shnwaz"), "Hello, Shnwaz! Welcome to shnwazdev.");
});

test("returns package profile", () => {
  assert.deepEqual(profile(), {
    owner: "shnwazdeveloper",
    brand: "shnwazdev",
    packageName: "@shnwazdeveloper/shnwazdev",
    registry: "GitHub Packages"
  });
});
