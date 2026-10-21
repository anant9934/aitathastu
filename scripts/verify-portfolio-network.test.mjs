import assert from "node:assert/strict";
import dns from "node:dns/promises";
import https from "node:https";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { Readable } from "node:stream";
import { test } from "node:test";
import { fetchPortfolioMetadata, fetchSafeHtml, isPublicIpv6 } from "../lib/connectors/portfolio/client.ts";

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

test("portfolio fetch has a total deadline: a server that never finishes is cut off", async (t) => {
  t.mock.method(dns, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  let destroyed = false;
  t.mock.method(https, "get", () => {
    const request = new EventEmitter();
    request.destroy = () => { destroyed = true; };
    return request; // headers never arrive
  });
  syncBuiltinESMExports();
  const started = Date.now();
  await assert.rejects(fetchSafeHtml("https://slow.example/", 3, Date.now() + 100), /timed out/);
  assert.ok(Date.now() - started < 2000, "rejected at the deadline, not at the socket idle timeout");
  assert.equal(destroyed, true, "the request is torn down");
  await assert.rejects(fetchSafeHtml("https://slow.example/", 3, Date.now() - 1), /timed out/, "an expired deadline stops a redirect chain before any lookup");
});

test("portfolio IPv6 check: NAT64 addresses are judged by the IPv4 address they reach", () => {
  assert.equal(isPublicIpv6("64:ff9b::10.0.0.1"), false);
  assert.equal(isPublicIpv6("64:ff9b::169.254.169.254"), false);
  assert.equal(isPublicIpv6("64:ff9b::7f00:1"), false);
  assert.equal(isPublicIpv6("64:ff9b::8.8.8.8"), true);
  assert.equal(isPublicIpv6("2606:4700::1111"), true);
});

test("portfolio DNS pinning prefers a public IPv4 answer over IPv6 (hosts without an IPv6 route)", async (t) => {
  t.mock.method(dns, "lookup", async () => [{ address: "2606:4700::6810:84e5", family: 6 }, { address: "93.184.216.34", family: 4 }]);
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  let pinned;
  t.mock.method(https, "get", (_url, options, onResponse) => {
    options.lookup("portfolio.example", { all: false }, (_err, address) => { pinned = address; });
    const request = new EventEmitter();
    request.destroy = () => {};
    queueMicrotask(() => {
      const response = Readable.from([Buffer.from("<title>Site</title>")]);
      Object.assign(response, { statusCode: 200, headers: { "content-type": "text/html" } });
      onResponse(response);
    });
    return request;
  });
  syncBuiltinESMExports();
  await fetchSafeHtml("https://portfolio.example/");
  assert.equal(pinned, "93.184.216.34");
});
