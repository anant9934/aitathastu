import assert from "node:assert/strict";
import dns from "node:dns/promises";
import https from "node:https";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { Readable } from "node:stream";
import { test } from "node:test";
import { fetchPortfolioMetadata } from "../lib/connectors/portfolio/client.ts";

for (const all of [true, false]) {
  test(`portfolio DNS pinning supports Node lookup all=${all}`, async (t) => {
    const pinned = { address: "93.184.216.34", family: 4 };
    t.mock.method(dns, "lookup", async () => [pinned]);
    syncBuiltinESMExports();
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });

    t.mock.method(https, "get", (_url, options, onResponse) => {
      // Node >=20 requests an array when autoSelectFamily is enabled.
      // The old callback returned a string, causing ERR_INVALID_IP_ADDRESS.
      options.lookup("portfolio.example", { all }, (err, address, family) => {
        assert.equal(err, null);
        if (all) assert.deepEqual(address, [pinned]);
        else {
          assert.equal(address, pinned.address);
          assert.equal(family, 4);
        }
      });
      const request = new EventEmitter();
      queueMicrotask(() => {
        const response = Readable.from([Buffer.from("<title>Student Portfolio</title><p>Python projects</p>")]);
        response.statusCode = 200;
        response.headers = { "content-type": "text/html" };
        onResponse(response);
      });
      return request;
    });

    const result = await fetchPortfolioMetadata("https://portfolio.example/");
    assert.equal(result.title, "Student Portfolio");
    assert.ok(result.technologies.includes("Python"));
  });
}

test("portfolio DNS pinning rejects mixed public/private answers before connecting", async (t) => {
  t.mock.method(dns, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ]);
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const request = t.mock.method(https, "get", () => { throw new Error("Must not connect"); });
  await assert.rejects(fetchPortfolioMetadata("https://portfolio.example/"), /exclusively to safe public IP addresses/);
  assert.equal(request.mock.callCount(), 0);
});
