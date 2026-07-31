# Jakarta Faces Tools Backlog & Roadmap

## ✅ Completed (v2.1.0)
- [x] **EL Expression Highlighting**: Customizable syntax highlighting for JSF Expression Language `#{...}` blocks.
- [x] **EL Auto-Complete (IntelliSense) [Beta]**: Auto-complete for Java Managed Beans, properties, and methods inside `#{...}` blocks, with Status Bar cache management.

## 🚀 Next Up (v2.2.0 / Future Releases)
- [ ] **Iteration Variable Support (`var="..."`)**: Deep resolution and auto-complete for iteration variables (e.g., `var="u"` in `<ui:repeat>`, `<h:dataTable>`, `<p:dataTable>`) so `#{u.name}` resolves to the element type of the collection!
- [ ] **Component Linking & Navigation (`for="..."` ↔ `id="..."`)**: Auto-complete available `id="..."` values when typing inside `for="..."`, and support `Ctrl+Click` to jump from a `for` attribute directly to the target component ID.
- [ ] **EL Semantic Validation (Diagnostics)**: Optional real-time diagnostics to flag mistyped Java bean names or missing property names inside `#{...}` expressions (e.g., warning on `#{userController.naem}`).
- [ ] **Incremental Bean Caching (File Watchers)**: Automatically update the in-memory Java Managed Bean cache whenever a `.java` file is created, modified, or deleted without requiring a manual cache rebuild.
- [ ] **Lombok Annotation Support**: Fully support `@Getter`, `@Setter`, and `@Data` from Lombok when inspecting Java Managed Beans for EL properties.
