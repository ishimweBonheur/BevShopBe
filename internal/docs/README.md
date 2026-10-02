# API documentation

Open http://localhost:8081/api/docs/ (or `/swagger/`) on the running API.
The API serves the same OpenAPI document at `/openapi.json` and
`/api/docs/openapi.json`. The document and HTML are embedded in the Go binary;
Swagger UI JavaScript and CSS load from jsDelivr, so the browser needs internet access.

To test protected endpoints:

1. Execute `POST /api/v1/auth/login`, or `auth/setup` if no owner exists.
2. Copy the response's `token` value.
3. Click **Authorize**, paste the token without `Bearer`, and authorize.
4. Use **Try it out** on the desired operation. Replace sample UUIDs with IDs
   returned by your API. Creating, updating and deleting records changes shop data.

The specification documents all currently registered business routes and health.
It uses the actual backend contract: errors are `{ "error": "message" }`,
purchase/sale pagination uses `limit` and `offset`, and date filters use RFC3339
timestamps. The dashboard is `/api/v1/reports/dashboard`.
Cancellation, `/api/v1/dashboard`, and separate product/low-stock/best-selling
report routes from the broader requirements are not implemented yet.

When changing a handler or model, update `openapi.json` and run `go test ./...`
and `go vet ./...`. Documentation tests check route coverage, schema references,
authentication declarations and public documentation access. Rebuild the API
with `docker compose up -d --build api` to publish embedded documentation changes.
