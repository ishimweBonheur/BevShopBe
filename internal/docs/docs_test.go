package docs

import (
	"bevshop/internal/auth"
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestSpecificationCoversRegisteredRoutes(t *testing.T) {
	var spec struct {
		Paths map[string]map[string]json.RawMessage `json:"paths"`
	}
	if err := json.Unmarshal(specification, &spec); err != nil {
		t.Fatal(err)
	}
	files, err := filepath.Glob("../*/handler.go")
	if err != nil {
		t.Fatal(err)
	}
	files = append(files, "../../cmd/api/main.go")
	routes := map[string]bool{}
	for _, file := range files {
		root, err := parser.ParseFile(token.NewFileSet(), file, nil, 0)
		if err != nil {
			t.Fatal(err)
		}
		ast.Inspect(root, func(node ast.Node) bool {
			call, ok := node.(*ast.CallExpr)
			if !ok || len(call.Args) == 0 {
				return true
			}
			selector, ok := call.Fun.(*ast.SelectorExpr)
			if !ok || selector.Sel.Name != "HandleFunc" {
				return true
			}
			literal, ok := call.Args[0].(*ast.BasicLit)
			if !ok {
				return true
			}
			pattern, _ := strconv.Unquote(literal.Value)
			method, path, ok := strings.Cut(pattern, " ")
			if !ok || (path != "/health" && !strings.HasPrefix(path, "/api/v1/")) {
				return true
			}
			routes[pattern] = true
			if spec.Paths[path][strings.ToLower(method)] == nil {
				t.Errorf("missing documentation for %s", pattern)
			}
			return true
		})
	}
	for path, methods := range spec.Paths {
		for method := range methods {
			if !routes[strings.ToUpper(method)+" "+path] {
				t.Errorf("documented route is not implemented: %s %s", method, path)
			}
		}
	}
}

func TestSpecificationReferencesAndSecurity(t *testing.T) {
	var spec map[string]any
	if err := json.Unmarshal(specification, &spec); err != nil {
		t.Fatal(err)
	}
	var walk func(any)
	walk = func(value any) {
		switch value := value.(type) {
		case map[string]any:
			if ref, ok := value["$ref"].(string); ok {
				var target any = spec
				for _, key := range strings.Split(strings.TrimPrefix(ref, "#/"), "/") {
					object, ok := target.(map[string]any)
					if !ok || object[key] == nil {
						t.Errorf("unresolved reference: %s", ref)
						break
					}
					target = object[key]
				}
			}
			for _, child := range value {
				walk(child)
			}
		case []any:
			for _, child := range value {
				walk(child)
			}
		}
	}
	walk(spec)
	if security, ok := spec["security"].([]any); !ok || len(security) != 1 {
		t.Fatal("expected global bearer authentication")
	}
	ids := map[string]bool{}
	for path, methods := range spec["paths"].(map[string]any) {
		for _, raw := range methods.(map[string]any) {
			op := raw.(map[string]any)
			id, _ := op["operationId"].(string)
			if id == "" || ids[id] {
				t.Errorf("missing or duplicate operation ID: %s", id)
			}
			ids[id] = true
			public := path == "/health" || path == "/api/v1/auth/setup" || path == "/api/v1/auth/login"
			security, override := op["security"]
			if public && (!override || len(security.([]any)) != 0) {
				t.Errorf("public route requires authentication: %s", path)
			}
			if !public && override {
				t.Errorf("protected route overrides authentication: %s", path)
			}
			if strings.Contains(path, "{id}") {
				found := false
				for _, raw := range op["parameters"].([]any) {
					param := raw.(map[string]any)
					found = found || (param["name"] == "id" && param["in"] == "path" && param["required"] == true)
				}
				if !found {
					t.Errorf("missing required path parameter: %s", path)
				}
			}
		}
	}
}

func TestDocumentationAccessibleWithoutToken(t *testing.T) {
	mux := http.NewServeMux()
	Register(mux)
	handler := auth.NewMiddleware("test-secret", nil).Wrap(mux)
	for _, path := range []string{"/api/docs/", "/swagger/", "/swagger/index.html", "/openapi.json", "/api/docs/openapi.json"} {
		t.Run(path, func(t *testing.T) {
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
			if w.Code != http.StatusOK {
				t.Fatalf("status = %d", w.Code)
			}
			if strings.HasSuffix(path, ".json") {
				if !json.Valid(w.Body.Bytes()) || w.Header().Get("Content-Type") != "application/json" {
					t.Fatal("invalid JSON response")
				}
			} else if !strings.Contains(w.Body.String(), "SwaggerUIBundle({") {
				t.Fatal("missing Swagger initialization")
			}
		})
	}
	for _, path := range []string{"/api/docs", "/swagger"} {
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != http.StatusTemporaryRedirect || w.Header().Get("Location") != path+"/" {
			t.Errorf("incorrect redirect for %s", path)
		}
	}
}
