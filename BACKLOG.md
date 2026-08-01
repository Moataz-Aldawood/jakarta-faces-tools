# Jakarta Faces Tools Backlog & Roadmap

## ✅ Completed (v2.4.0)
- [x] **EL Semantic Validation (Diagnostics)**: Optional real-time semantic diagnostics to flag mistyped Java Managed Bean names or missing property names inside `#{...}` expressions (e.g., warning on `#{userController.naem}`), with deep recursive property chain resolution (`#{a.b.c.d}`), debounced document version checking for stable squigglies, and automatic whitelisting of standard implicit objects and keywords.

## ✅ Completed (v2.3.0)
- [x] **Component Linking & Navigation (`for="..."` ↔ `id="..."`)**: Auto-complete available `id="..."` values when typing inside `for="..."` or `target="..."`, interactive Hover summary cards for `id`/`for`, simultaneous Document Highlighting of declarations and references, and `Ctrl+Click` jump-to-definition.

## ✅ Completed (v2.2.0)
- [x] **Iteration Variable Support (`var="..."`)**: Deep resolution, standards-compliant auto-complete, and jump-to-definition for iteration variables (e.g., `var="u"` in `<ui:repeat>`, `<h:dataTable>`, `<p:dataTable>`).
- [x] **Standards-Compliant EL Autocomplete**: Enabled by default with method call snippet parens, JSF getter/setter filtering, and comment-stripped safe resolution.
- [x] **Rich Inline Data Types & API Cards**: Clean colon-prefixed type descriptions (` : String`) on autocomplete rows and interactive documentation cards.

## ✅ Completed (v2.1.0)
- [x] **EL Expression Highlighting**: Customizable syntax highlighting for JSF Expression Language `#{...}` blocks.
- [x] **EL Auto-Complete (IntelliSense) [Beta]**: Auto-complete for Java Managed Beans, properties, and methods inside `#{...}` blocks, with Status Bar cache management.

## 🚀 Next Up (v2.5.0 / Future Releases)
- [ ] **Incremental Bean Caching (File Watchers)**: Automatically update the in-memory Java Managed Bean cache whenever a `.java` file is created, modified, or deleted without requiring a manual cache rebuild.
- [ ] **Lombok Annotation Support**: Fully support `@Getter`, `@Setter`, and `@Data` from Lombok when inspecting Java Managed Beans for EL properties.
