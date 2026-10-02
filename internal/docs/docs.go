// Package docs serves the API specification and Swagger UI from the Go binary.
package docs

import (
	_ "embed"
	"net/http"
)

//go:embed openapi.json
var specification []byte

//go:embed swagger.html
var swaggerUI []byte

// Register exposes documentation without a separate server or runtime files.
func Register(mux *http.ServeMux) {
	serveSpec := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(specification)
	}
	serveUI := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(swaggerUI)
	}
	for _, path := range []string{"/openapi.json", "/api/docs/openapi.json"} {
		mux.HandleFunc("GET "+path, serveSpec)
	}
	for _, path := range []string{"/swagger", "/api/docs"} {
		mux.HandleFunc("GET "+path, func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, path+"/", http.StatusTemporaryRedirect)
		})
		mux.HandleFunc("GET "+path+"/", serveUI)
	}
}
